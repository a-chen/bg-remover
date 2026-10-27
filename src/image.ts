const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateImage(file: File): string | null {
  if (file.size === 0) {
    return 'This image is empty. Choose a different file.';
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return 'Choose a PNG, JPEG, or WebP image.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'Choose an image smaller than 25 MB.';
  }

  return null;
}

export function outputFilename(name: string): string {
  const trimmed = name.trim();
  const withoutExtension = trimmed.replace(/\.[^.]+$/, '');
  const base = withoutExtension || 'image';

  return `${base}-transparent.png`;
}
