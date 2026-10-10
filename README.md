# BLaak — AKCIZUR project index

Production-oriented React + Vite catalog of public repositories owned by [@akcizur](https://github.com/akcizur).

## Features

- Loads public repositories from the GitHub REST API.
- Search, category filtering and sorting.
- GitHub Actions discovers each repository's configured GitHub Pages URL.
- Playwright/Chromium automatically visits configured URLs and captures screenshots.
- Screenshots are bundled into the deployed site; cards use static images rather than fragile cross-origin iframes.
- Scheduled daily refresh and screenshot capture, plus capture on every push to `main`.
- Responsive monochrome interface, direct live-site links and source links.
- Deploys the production Vite build to GitHub Pages.

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npx playwright install chromium
npm run screenshots
npm run dev
```

To make a production build locally:

```bash
npm run screenshots
npm run build
npm run preview
```

## Deployment

Push to `main` or run the **Build screenshots and deploy** workflow manually. A scheduled run refreshes screenshots daily. In repository Settings → Pages, select **GitHub Actions** as the deployment source.

Vite uses `/blaak/` as the base path. Screenshots and their manifest are generated into `public/previews/` during CI and copied into `dist/previews/` by Vite.

## Limits and failure handling

- Only repositories with GitHub Pages configured are screenshot targets.
- Each target has a navigation timeout; inaccessible sites are recorded as `capture-failed` and still retain a direct link.
- Sites that require authentication, block automation, or are temporarily unavailable may not produce a screenshot.
- The browser-facing repository list uses GitHub's unauthenticated API, so rate limits may temporarily affect the live catalog. The screenshot generation itself uses the workflow token.
