import './style.css';
import { outputFilename, validateImage } from './image';

type RemovalProgress = (key: string, current: number, total: number) => void;
type RemoveBackground = (
  image: Blob,
  config: {
    model: 'isnet_fp16';
    output: { format: 'image/png'; quality: number };
    progress: RemovalProgress;
  },
) => Promise<Blob>;

type PendingJob = {
  file: File;
  id: number;
};

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const uploadView = element<HTMLElement>('upload-view');
const editorView = element<HTMLElement>('editor-view');
const dropZone = element<HTMLButtonElement>('drop-zone');
const uploadFeedback = element<HTMLParagraphElement>('upload-feedback');
const fileInput = element<HTMLInputElement>('file-input');
const fileName = element<HTMLElement>('file-name');
const fileSize = element<HTMLElement>('file-size');
const resetButton = element<HTMLButtonElement>('reset-button');
const originalPreview = element<HTMLImageElement>('original-preview');
const resultPreview = element<HTMLImageElement>('result-preview');
const previewStage = element<HTMLElement>('preview-stage');
const progressPanel = element<HTMLElement>('progress-panel');
const progressTitle = element<HTMLElement>('progress-title');
const progressDetail = element<HTMLElement>('progress-detail');
const progressBar = element<HTMLProgressElement>('progress-bar');
const errorPanel = element<HTMLElement>('error-panel');
const errorMessage = element<HTMLElement>('error-message');
const retryButton = element<HTMLButtonElement>('retry-button');
const compareControl = element<HTMLElement>('compare-control');
const showOriginalButton = element<HTMLButtonElement>('show-original');
const showResultButton = element<HTMLButtonElement>('show-result');
const resultActions = element<HTMLElement>('result-actions');
const copyButton = element<HTMLButtonElement>('copy-button');
const downloadButton = element<HTMLButtonElement>('download-button');
const editorStatus = element<HTMLElement>('editor-status');
const announcer = element<HTMLElement>('announcer');

let sourceFile: File | null = null;
let sourceUrl: string | null = null;
let resultBlob: Blob | null = null;
let resultUrl: string | null = null;
let selectionId = 0;
let pendingJob: PendingJob | null = null;
let inferenceRunning = false;
let modulePromise: Promise<RemoveBackground> | null = null;
let dragDepth = 0;

function announce(message: string): void {
  announcer.textContent = '';
  window.setTimeout(() => {
    announcer.textContent = message;
  }, 30);
}

function setUploadFeedback(message: string, isError = false): void {
  uploadFeedback.textContent = message;
  uploadFeedback.classList.toggle('is-error', isError);
  if (message) announce(message);
}

function readableSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revoke(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

function clearResult(): void {
  revoke(resultUrl);
  resultUrl = null;
  resultBlob = null;
  resultPreview.removeAttribute('src');
  resultPreview.hidden = true;
  originalPreview.hidden = false;
  compareControl.hidden = true;
  resultActions.hidden = true;
}

function showPreview(which: 'original' | 'result'): void {
  const showingResult = which === 'result' && Boolean(resultUrl);
  originalPreview.hidden = showingResult;
  resultPreview.hidden = !showingResult;
  showOriginalButton.setAttribute('aria-pressed', String(!showingResult));
  showResultButton.setAttribute('aria-pressed', String(showingResult));
}

function showProgress(title: string, detail: string): void {
  errorPanel.hidden = true;
  editorStatus.textContent = '';
  progressTitle.textContent = title;
  progressDetail.textContent = detail;
  progressBar.removeAttribute('value');
  progressPanel.hidden = false;
  progressPanel.setAttribute('aria-hidden', 'false');
  previewStage.setAttribute('aria-busy', 'true');
}

function hideProgress(): void {
  progressPanel.hidden = true;
  progressPanel.setAttribute('aria-hidden', 'true');
  previewStage.removeAttribute('aria-busy');
}

function showError(error: unknown): void {
  hideProgress();
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = /fetch|network|load|failed/i.test(rawMessage)
    ? 'The removal model could not be downloaded. Check your connection and try again.'
    : 'Your browser could not process this image. Try again or choose a different image.';

  errorMessage.textContent = message;
  errorPanel.hidden = false;
}

function resetApp(): void {
  selectionId += 1;
  pendingJob = null;
  sourceFile = null;
  revoke(sourceUrl);
  sourceUrl = null;
  originalPreview.removeAttribute('src');
  clearResult();
  hideProgress();
  errorPanel.hidden = true;
  editorStatus.textContent = '';
  uploadFeedback.textContent = '';
  fileInput.value = '';
  editorView.hidden = true;
  uploadView.hidden = false;
  announce('Ready for a new image.');
  dropZone.focus();
}

function displaySource(file: File): number {
  selectionId += 1;
  const id = selectionId;
  sourceFile = file;
  revoke(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  clearResult();
  errorPanel.hidden = true;
  fileName.textContent = file.name || 'Pasted image';
  fileName.title = file.name;
  fileSize.textContent = readableSize(file.size);
  originalPreview.src = sourceUrl;
  originalPreview.hidden = false;
  uploadView.hidden = true;
  editorView.hidden = false;
  showProgress(
    inferenceRunning ? 'Image queued…' : 'Preparing image…',
    inferenceRunning
      ? 'Finishing the previous request before starting this one.'
      : 'The first run may need to download the removal model.',
  );
  editorView.focus({ preventScroll: true });
  announce(`${file.name || 'Image'} selected. Removing background.`);
  return id;
}

function selectFile(file: File): void {
  const validationError = validateImage(file);
  if (validationError) {
    if (editorView.hidden) setUploadFeedback(validationError, true);
    else {
      editorStatus.textContent = validationError;
      announce(validationError);
    }
    return;
  }

  setUploadFeedback('');
  const id = displaySource(file);
  pendingJob = { file, id };
  void drainJobs();
}

async function loadRemovalModule(): Promise<RemoveBackground> {
  modulePromise ??= import('@imgly/background-removal')
    .then((module) => module.removeBackground as RemoveBackground)
    .catch((error: unknown) => {
      modulePromise = null;
      throw error;
    });
  return modulePromise;
}

function updateProgress(
  key: string,
  current: number,
  total: number,
  jobId: number,
): void {
  if (jobId !== selectionId) return;

  const hasTotal = Number.isFinite(total) && total > 0;
  if (hasTotal) progressBar.value = Math.min(1, Math.max(0, current / total));
  else progressBar.removeAttribute('value');

  if (key.startsWith('fetch:')) {
    const percent = hasTotal ? ` ${Math.round((current / total) * 100)}%` : '';
    progressTitle.textContent = `Downloading removal model…${percent}`;
    progressDetail.textContent = 'Preparing the removal model.';
    return;
  }

  const stage = key.split(':')[1];
  const labels: Record<string, string> = {
    decode: 'Reading image…',
    inference: 'Removing background…',
    mask: 'Refining edges…',
    encode: 'Creating transparent PNG…',
  };
  progressTitle.textContent = labels[stage] ?? 'Removing background…';
  progressDetail.textContent = 'Please wait…';
}

async function drainJobs(): Promise<void> {
  if (inferenceRunning) return;
  inferenceRunning = true;

  try {
    while (pendingJob) {
      const job = pendingJob;
      pendingJob = null;

      if (job.id !== selectionId) continue;
      showProgress('Loading remover…', 'The first run may need to download the removal model.');

      try {
        const removeBackground = await loadRemovalModule();
        if (job.id !== selectionId) continue;

        const blob = await removeBackground(job.file, {
          model: 'isnet_fp16',
          output: { format: 'image/png', quality: 1 },
          progress: (key, current, total) =>
            updateProgress(key, current, total, job.id),
        });

        if (job.id !== selectionId) continue;
        revoke(resultUrl);
        resultBlob = blob;
        resultUrl = URL.createObjectURL(blob);
        resultPreview.src = resultUrl;
        hideProgress();
        errorPanel.hidden = true;
        compareControl.hidden = false;
        resultActions.hidden = false;
        showPreview('result');
        editorStatus.textContent = 'Background removed. Your transparent PNG is ready.';
        announce('Background removed. Your transparent PNG is ready.');
      } catch (error) {
        if (job.id === selectionId) showError(error);
      }
    }
  } finally {
    inferenceRunning = false;
    if (pendingJob) void drainJobs();
  }
}

function retry(): void {
  if (!sourceFile) return;
  errorPanel.hidden = true;
  showProgress('Trying again…', 'Preparing the removal model.');
  pendingJob = { file: sourceFile, id: selectionId };
  void drainJobs();
}

function downloadResult(): void {
  if (!resultBlob || !resultUrl || !sourceFile) return;
  const link = document.createElement('a');
  link.href = resultUrl;
  link.download = outputFilename(sourceFile.name);
  document.body.append(link);
  link.click();
  link.remove();
  editorStatus.textContent = 'PNG downloaded.';
  announce('Transparent PNG downloaded.');
}

async function copyResult(): Promise<void> {
  if (!resultBlob) return;

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Image clipboard is unsupported');
    }

    const pngBlob =
      resultBlob.type === 'image/png'
        ? resultBlob
        : new Blob([resultBlob], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    editorStatus.textContent = 'PNG copied to clipboard.';
    announce('Transparent PNG copied to clipboard.');
  } catch {
    editorStatus.textContent = 'Copy was blocked or is unavailable. Use Download PNG instead.';
    announce('Copy was blocked or is unavailable. Use Download PNG instead.');
  }
}

function extensionForType(type: string): string {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  return 'png';
}

function pastedImage(event: ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
  const file = imageItem?.getAsFile();
  if (!file) return null;

  return new File(
    [file],
    file.name || `pasted-image.${extensionForType(file.type)}`,
    { type: file.type, lastModified: Date.now() },
  );
}

dropZone.addEventListener('click', () => fileInput.click());
resetButton.addEventListener('click', resetApp);
retryButton.addEventListener('click', retry);
showOriginalButton.addEventListener('click', () => showPreview('original'));
showResultButton.addEventListener('click', () => showPreview('result'));
copyButton.addEventListener('click', () => void copyResult());
downloadButton.addEventListener('click', downloadResult);

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) selectFile(file);
});

window.addEventListener('paste', (event) => {
  const file = pastedImage(event);
  if (!file) return;
  event.preventDefault();
  selectFile(file);
});

window.addEventListener('keydown', (event) => {
  if (editorView.hidden || event.defaultPrevented || event.repeat) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
  if (event.key !== 'Escape' && event.key.toLowerCase() !== 'r') return;
  event.preventDefault();
  resetApp();
});

window.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  dragDepth += 1;
  document.body.classList.add('is-dragging');
});

window.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('is-dragging');
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
  const file = event.dataTransfer?.files[0];
  if (file) selectFile(file);
});

window.addEventListener('beforeunload', () => {
  revoke(sourceUrl);
  revoke(resultUrl);
});
