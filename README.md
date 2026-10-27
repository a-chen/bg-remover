# Image background remover

**[Open the app →](https://a-chen.github.io/bg-remover/)**

A minimal, paste-first background remover. Free, no account needed, and images are processed in your browser—not uploaded to a server.

## Use

- **⌘V / Ctrl+V** to paste and start processing, or click to upload or drag and drop.
- Compare the original and result, then **Copy PNG** or **Download PNG**.
- Press **Esc** or **R** to reset.

The first run downloads the removal model. If clipboard copying is blocked, use the download button.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Pushes to `main` deploy automatically to GitHub Pages.

## Credits & license

Inspired by [LoneTools](https://lonetools.com/remove-background), customized with a few quality-of-life features. Powered by [IMG.LY’s background-removal library](https://github.com/imgly/background-removal-js).

[AGPL-3.0-only](LICENSE.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Security & known dependency advisory](SECURITY.md)
