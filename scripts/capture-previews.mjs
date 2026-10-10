import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const owner = process.env.SCREENSHOT_OWNER || 'akcizur';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const api = 'https://api.github.com';
const outputDir = path.resolve('public/previews');
const baseHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function getJson(url) {
  const response = await fetch(url, { headers: baseHeaders });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub API ${response.status} for ${url}: ${detail.slice(0, 180)}`);
  }
  return response.json();
}

async function mapLimit(items, limit, task) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await task(items[index], index);
    }
  }));
}

function filename(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

await mkdir(outputDir, { recursive: true });
for (const entry of await (await import('node:fs/promises')).readdir(outputDir)) {
  if (/\.(png|json)$/.test(entry)) await rm(path.join(outputDir, entry), { force: true });
}

const repositories = [];
for (let page = 1; page <= 10; page++) {
  const batch = await getJson(`${api}/users/${owner}/repos?type=owner&per_page=100&page=${page}&sort=updated`);
  repositories.push(...batch.filter(repo => !repo.fork && !repo.archived && repo.private !== true));
  if (batch.length < 100) break;
}

const manifest = { generatedAt: new Date().toISOString(), owner, projects: {} };
const eligible = repositories.filter(repo => repo.name.toLowerCase() !== `${owner}.github.io` || repo.name);
console.log(`Found ${eligible.length} public repositories; checking GitHub Pages URLs…`);

await mapLimit(eligible, 5, async repo => {
  try {
    const pages = await getJson(`${api}/repos/${owner}/${encodeURIComponent(repo.name)}/pages`);
    const url = pages.html_url || (repo.name.toLowerCase() === `${owner}.github.io`
      ? `https://${owner}.github.io/`
      : `https://${owner}.github.io/${repo.name}/`);
    manifest.projects[repo.name] = { url, screenshot: null, status: 'configured' };
  } catch (error) {
    if (String(error.message).includes('GitHub API 404')) {
      manifest.projects[repo.name] = { url: null, screenshot: null, status: 'not-configured' };
    } else {
      console.warn(`Pages lookup failed for ${repo.name}: ${error.message}`);
      manifest.projects[repo.name] = { url: null, screenshot: null, status: 'lookup-error' };
    }
  }
});

const targets = eligible.filter(repo => manifest.projects[repo.name]?.url);
const browser = await chromium.launch({ headless: true });
try {
  await mapLimit(targets, 3, async repo => {
    const item = manifest.projects[repo.name];
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1200);
      const file = `${filename(repo.name)}.png`;
      await page.screenshot({ path: path.join(outputDir, file), type: 'png', animations: 'disabled', timeout: 15000 });
      item.screenshot = `previews/${file}`;
      item.status = 'captured';
      console.log(`Captured ${repo.name}: ${item.url}`);
    } catch (error) {
      item.status = 'capture-failed';
      item.error = String(error.message || error).slice(0, 200);
      console.warn(`Screenshot failed for ${repo.name} (${item.url}): ${item.error}`);
    } finally {
      await page.close().catch(() => {});
    }
  });
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
const captured = Object.values(manifest.projects).filter(item => item.screenshot).length;
console.log(`Screenshot job complete: ${captured}/${targets.length} pages captured. Manifest: public/previews/index.json`);
