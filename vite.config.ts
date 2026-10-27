import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// GitHub Actions supplies this public identifier; no .env file or secret is needed.
const repository = process.env.GITHUB_REPOSITORY;
const sourceUrl = repository && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
  ? `https://github.com/${repository}`
  : null;

export default defineConfig({
  plugins: [{
    name: 'public-source-link',
    transformIndexHtml: (html) => html.replace(
      '<!-- source-link -->',
      sourceUrl ? `<p class="about-credit"><a href="${sourceUrl}">Source code · AGPL-3.0</a></p>` : '',
    ),
  }],
  // Relative URLs work on both user pages and /repository-name/ project pages.
  base: './',
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
});
