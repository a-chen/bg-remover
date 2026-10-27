# Image background remover

A minimal, paste-first background remover inspired by [LoneTools](https://lonetools.com/remove-background), with a few quality-of-life additions. Uses [IMG.LY’s background-removal library](https://github.com/imgly/background-removal-js).

- Paste with **⌘V / Ctrl+V** to process immediately.
- Click the box to choose a file, or drag and drop.
- Compare the original and result, copy the transparent PNG, or download it.
- Press **Esc** or **R** to reset for the next image.

Free to use, with no account, API key, backend, or usage limit. Images are processed in your browser and aren’t uploaded. Model/runtime assets are fetched from IMG.LY on first use and cached when possible. The first run downloads tens of megabytes; processing speed depends on your device.

Clipboard copying requires HTTPS or localhost and browser permission. If copying is blocked, use Download PNG. Pasting text URLs does not fetch images.

## Run locally

Requires Node.js **22.12+**; CI uses Node.js 24.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No `.env` file or secrets are needed.

## Publish on GitHub Pages

1. Create a **public** GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages**. The initial push should start it; if necessary, choose **Run workflow** after enabling Pages.
4. The deployment job publishes the site URL, usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The workflow runs the tests, builds the site, and deploys only `dist/`. Pull requests run checks but cannot deploy. No manually configured tokens or repository secrets are required: deployment uses GitHub’s built-in short-lived credentials. Actions are pinned to commit hashes, with Dependabot configured to propose updates.

The Vite build uses relative asset URLs, so it works under any repository name, at a user-site root, or on a custom domain. The workflow also adds a source-code link to the footer using GitHub’s public `GITHUB_REPOSITORY` identifier. Keep the repository public so deployed users can access the source under the AGPL license.

**GitHub Pages cannot set custom COOP/COEP headers.** The app works there using the runtime’s single-threaded fallback, which may be slower than an isolated host. There is no image-processing server to maintain. Model assets still require a network connection on first use.

For other static hosts, run `npm run build` and serve `dist/` over HTTPS. `public/_headers` enables isolation on hosts that support that format; GitHub Pages ignores it. Vite dev/preview also enable isolation. Self-hosted model assets must match the installed library version; see [upstream instructions](https://github.com/imgly/background-removal-js/tree/main/packages/web#custom-asset-serving).

## Checks

```sh
npx playwright install chromium
npm test
npm run test:e2e
npm run build
npm run test:pages
```

The UI tests mock inference for reliable, fast interaction checks. The Pages smoke test serves the actual production build under `/pages-smoke/` without isolation headers. To additionally test real inference against downloaded model assets:

```sh
RUN_MODEL_TEST=1 npm run test:pages
```

This opt-in test downloads the model; it is not required in CI. `RUN_MODEL_TEST` is a nonsecret test flag, not an application setting.

## Security and publication

See [SECURITY.md](SECURITY.md) for the audit scope, known dependency advisory, privacy boundaries, and reporting guidance. Generated output, dependencies, `.env*`, local configuration, logs, and common private-key files are ignored. The lockfile is intentionally committed for reproducible installs.

## License

[AGPL-3.0-only](LICENSE.md), consistent with the background-removal library’s open-source license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the dependency packages for their notices. Publishing or modifying this app does not remove the AGPL source-availability obligations. Alternative IMG.LY licensing is available from its authors.
