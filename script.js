const OWNER = 'akcizur';
const API = 'https://api.github.com';
const GH = `https://github.com/${OWNER}`;
const PAGES = `https://${OWNER}.github.io`;

const state = { repos: [], filtered: [] };
const $ = (s) => document.querySelector(s);
const pagesCache = new Map();

function typeOf(repo) {
  const text = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (/(game|phaser|three|r3f|godot|unity|engine)/.test(text)) return 'Game';
  if (/(docs|doc|documentation|fumadocs|mkdocs|docus)/.test(text)) return 'Docs';
  if (/(template|starter|boilerplate|kit)/.test(text)) return 'Template';
  if (/(font|css|tailwind|ui|component)/.test(text)) return 'UI';
  if (repo.language) return repo.language;
  return 'Other';
}

function pagesUrl(repo) {
  return repo.name.toLowerCase() === `${OWNER}.github.io`.toLowerCase()
    ? PAGES + '/'
    : `${PAGES}/${encodeURIComponent(repo.name)}/`;
}

function pagesThumb(url) {
  return `https://image.thum.io/get/width/1000/crop/620/noanimate/${url}`;
}

async function apiJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) throw new Error('GitHub API limit reached');
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function getAllRepos() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await apiJson(`${API}/users/${OWNER}/repos?per_page=100&page=${page}&sort=updated`);
    if (!batch) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter(r => !r.fork && !r.archived && r.visibility === 'public');
}

// GitHub's Pages endpoint is the source of truth for whether Pages is configured.
// Check only likely frontend repos to avoid exhausting the unauthenticated API quota.
function isLikelyWebProject(repo) {
  const text = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')} ${repo.language || ''}`.toLowerCase();
  return repo.name.toLowerCase() === `${OWNER}.github.io`.toLowerCase() ||
    /(html|css|javascript|typescript|react|vite|next|astro|vue|svelte|three|phaser|game|web|site|pages|frontend|ui|docs|dashboard|tool|app)/.test(text);
}

async function detectPages(repos) {
  const candidates = repos.filter(isLikelyWebProject);
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < candidates.length) {
      const repo = candidates[cursor++];
      try {
        const data = await apiJson(`${API}/repos/${OWNER}/${encodeURIComponent(repo.name)}/pages`);
        pagesCache.set(repo.id, data ? {
          enabled: true,
          url: data.html_url || pagesUrl(repo),
          status: data.status || 'configured'
        } : { enabled: false });
      } catch (error) {
        pagesCache.set(repo.id, { enabled: null, error: error.message });
      }
    }
  });
  await Promise.all(workers);
}

function setupFilters() {
  const types = [...new Set(state.repos.map(r => r.type))].sort();
  $('#typeFilter').innerHTML = '<option value="all">Všechny typy</option>' +
    types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  ['search', 'typeFilter', 'sort'].forEach(id => $('#' + id).addEventListener('input', render));
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const type = $('#typeFilter').value;
  const sort = $('#sort').value;

  state.filtered = state.repos.filter(r => {
    const hay = `${r.name} ${r.description || ''} ${r.language || ''} ${r.type}`.toLowerCase();
    return (!q || hay.includes(q)) && (type === 'all' || r.type === type);
  });

  state.filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'stars') return b.stargazers_count - a.stargazers_count;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  $('#count').textContent = state.filtered.length;
  $('#repos').innerHTML = state.filtered.length ? state.filtered.map(row).join('') :
    '<tr><td colspan="5" class="loading">Nic nenalezeno.</td></tr>';
}

function row(repo) {
  const repoUrl = `${GH}/${repo.name}`;
  const pages = pagesCache.get(repo.id);
  const enabled = pages?.enabled === true;
  const deploy = enabled ? pages.url : null;
  const desc = repo.description ? escapeHtml(repo.description) : 'Bez popisu';
  const lang = repo.language ? ` · ${escapeHtml(repo.language)}` : '';
  const preview = enabled
    ? `<a href="${escapeAttr(deploy)}" target="_blank" rel="noopener" title="Otevřít live preview">
        <img class="preview" loading="lazy" src="${escapeAttr(pagesThumb(deploy))}" alt="Live preview ${escapeAttr(repo.name)}"
          onerror="this.outerHTML='<div class=\\'preview placeholder\\'>preview unavailable</div>'">
      </a>`
    : '<div class="preview placeholder">no live preview</div>';
  const status = enabled
    ? `<a class="link live" href="${escapeAttr(deploy)}" target="_blank" rel="noopener">Live ↗</a>`
    : pages?.enabled === null
      ? '<span class="muted">Neověřeno (API limit)</span>'
      : '<span class="muted">— No Pages</span>';

  return `<tr>
    <td>${preview}</td>
    <td>
      <a class="name" href="${escapeAttr(repoUrl)}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a>
      <span class="desc">${desc}${lang}</span>
    </td>
    <td><span class="badge">${escapeHtml(repo.type)}</span></td>
    <td><a class="link" href="${escapeAttr(repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a></td>
    <td><div class="links">${status}</div></td>
  </tr>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const escapeAttr = escapeHtml;

(async function init() {
  try {
    const repos = await getAllRepos();
    state.repos = repos.map(r => ({ ...r, type: typeOf(r) }));
    render();
    $('#updated').textContent = 'Ověřuji GitHub Pages…';
    await detectPages(state.repos);
    setupFilters();
    render();
    $('#updated').textContent = `Ověřeno ${new Date().toLocaleString('cs-CZ')}`;
  } catch (error) {
    console.error(error);
    $('#repos').innerHTML = `<tr><td colspan="5" class="loading">Nepodařilo se načíst data: ${escapeHtml(error.message)}</td></tr>`;
  }
})();
