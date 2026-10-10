# BLaak — akcizur project index

Responsive React + Vite catalog of public repositories owned by [@akcizur](https://github.com/akcizur).

## Features
- Loads public repositories from the GitHub REST API.
- Search, project-type filtering and sorting.
- Detects GitHub Pages configuration through the Pages API.
- Embeds configured Pages URLs directly in iframe previews; no screenshot service or image proxy.
- Responsive monochrome interface with live deployment and source links.
- GitHub Actions deployment to GitHub Pages.

## Local development
Requires Node.js 22 or newer.

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Deployment
Push to `main` to trigger `.github/workflows/deploy.yml`. In repository Settings → Pages, set the deployment source to **GitHub Actions**. Vite uses `/blaak/` as the base path.

Some deployed sites block iframe embedding through security headers. Their direct **Otevřít web** link remains available. GitHub's unauthenticated API rate limit can temporarily prevent repository or Pages detection.
