# Security

## Publication audit

The pre-publication review covered application source, configuration, dependency metadata, publishable files, and GitHub Pages deployment. It included a local scan for common credential/private-key patterns and environment files. No credentials or `.env` files were found in the publishable project. The repository was newly initialized, so there was no existing commit history to inspect.

This is a scoped review, not a guarantee that every vulnerability or possible secret has been detected. Review `git diff --cached` and enable GitHub secret scanning/push protection before publishing.

### Data boundaries

- Image selection, decoding, inference, and PNG export happen in the browser. There is no image-upload endpoint, analytics, account system, or application database.
- Model and runtime files are downloaded from IMG.LY’s CDN. Those requests disclose normal network metadata to the asset host. GitHub Pages also receives ordinary hosting requests; “local processing” does not mean no network traffic.
- Clipboard output is written only when the user clicks Copy PNG. Pasting uses the browser’s paste event; the app does not poll or automatically read the clipboard.
- Filenames and status strings use text APIs, not HTML interpolation. Pasted text URLs are not fetched. Inputs are limited to PNG/JPEG/WebP files of at most 25 MiB.
- File size limits are not decoded-pixel limits. Very large or malformed images may still exhaust browser resources; do not use this app as an untrusted-file validation boundary.

### Known dependency advisory

`npm audit` currently reports **two high-severity findings for one underlying advisory**: Zod and the dependent `@imgly/background-removal` package. [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) concerns memory exhaustion while validating oversized constrained collections.

IMG.LY 1.7.0 uses Zod 3; npm’s reported fixed Zod version is 4.6.6, a different major API. The app passes developer-defined options to the validator, not user-supplied schemas or arbitrary configurations, which limits exposure to this particular issue. It is nevertheless an unresolved dependency finding, not a clean audit.

Do not run `npm audit fix --force` blindly: npm proposes downgrading IMG.LY to an older version, not a compatible verified upgrade. Do not override Zod to version 4 without an upstream compatibility change and tests. Monitor upstream and re-run `npm audit` before releases. Dependabot is configured for npm packages and GitHub Actions.

### Hosting and supply chain

- Use HTTPS. Deploy the static `dist/` artifact, never a publicly exposed Vite development server.
- GitHub Pages cannot apply custom security headers. Real inference has been tested under a repository subpath without cross-origin isolation. On that host, the runtime falls back to single-threaded WASM; browsers and devices may vary.
- Cross-origin isolation on supported hosts is a performance feature here, not a requirement to keep images local.
- The model/runtime CDN and installed JavaScript dependencies are part of the trusted computing base. This project does not independently verify all CDN resource hashes against an application-owned trust root. Self-hosting matching assets can reduce that external dependency.
- CI uses `npm ci`, a committed lockfile, commit-pinned GitHub Actions, read-only default permissions, and deployment-only Pages/OIDC permissions. Pull requests do not deploy. No persistent deployment token or application secret is needed.
- `.gitignore` excludes `.env*`, local config, common private-key files, logs, build output, dependencies, and test artifacts. Ignoring files is not a substitute for reviewing commits; once committed, a secret must be rotated even if it is later removed.

## Reporting a vulnerability

Use the repository’s **Security → Report a vulnerability** feature when available. Maintainers should enable private vulnerability reporting and secret scanning in GitHub’s security settings. Do not post credentials, private images, or working exploit details in a public issue. For dependency issues, notify the upstream maintainers as appropriate.
