import { useEffect, useMemo, useState } from 'react';

const OWNER = 'akcizur';
const API = 'https://api.github.com';
const GH = 'https://github.com/akcizur';

function typeOf(repo) {
  const value = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (/game|phaser|three|r3f|godot|unity|engine/.test(value)) return 'Game';
  if (/docs|documentation|fumadocs|mkdocs|docus/.test(value)) return 'Docs';
  if (/template|starter|boilerplate|kit/.test(value)) return 'Template';
  if (/font|css|tailwind|ui|component|design/.test(value)) return 'UI';
  return repo.language || 'Other';
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (response.status === 403 || response.status === 429) throw new Error('GitHub API limit reached. Wait a moment or retry.');
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json();
}

async function loadRepos() {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await fetchJson(`${API}/users/${OWNER}/repos?type=owner&per_page=100&page=${page}&sort=updated`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all
    .filter(repo => !repo.fork && !repo.archived && repo.private !== true)
    .map(repo => ({ ...repo, type: typeOf(repo), pages: null, preview: null }));
}

async function loadManifest() {
  const response = await fetch(`${import.meta.env.BASE_URL}previews/index.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Screenshot manifest is not available yet');
  return response.json();
}

function Link({ href, children, className = '' }) {
  return <a className={className} href={href} target="_blank" rel="noreferrer noopener">{children}</a>;
}

function Card({ repo, index }) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = repo.pages?.url || null;
  const screenshot = repo.preview?.screenshot
    ? `${import.meta.env.BASE_URL}${repo.preview.screenshot}`
    : null;
  const captured = Boolean(screenshot && !imageFailed);

  return (
    <article className="project-card" style={{ '--card-index': index }}>
      <div className="preview-frame">
        {captured ? (
          <Link className="screenshot-link" href={url || repo.html_url}>
            <img src={screenshot} alt={`Automatický screenshot projektu ${repo.name}`} loading="lazy" onError={() => setImageFailed(true)} />
            <span className="preview-open">Otevřít web ↗</span>
          </Link>
        ) : (
          <div className="preview-empty">
            <span className="preview-mark">{repo.name.slice(0, 2).toUpperCase()}</span>
            <span>{url ? 'Screenshot čeká na další build' : 'GitHub Pages není nakonfigurované'}</span>
          </div>
        )}
        <span className={'live-indicator ' + (url ? 'is-live' : '')}><i />{captured ? 'SCREENSHOT' : url ? 'LIVE URL' : 'SOURCE'}</span>
      </div>
      <div className="project-content">
        <div className="project-topline"><span className="project-type">{repo.type}</span><span className="stars">★ {repo.stargazers_count}</span></div>
        <h2><Link href={repo.html_url}>{repo.name}<span className="arrow"> ↗</span></Link></h2>
        <p className="description">{repo.description || 'Bez popisu projektu.'}</p>
        <div className="project-meta"><span>{repo.language || 'Mixed stack'}</span><span>Updated {new Date(repo.updated_at).toLocaleDateString('cs-CZ')}</span></div>
        <div className="project-actions">
          <Link className="action-primary" href={url || repo.html_url}>{url ? 'Live preview ↗' : 'Repository ↗'}</Link>
          <Link className="action-secondary" href={repo.html_url}>Source code</Link>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [repos, setRepos] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All types');
  const [sort, setSort] = useState('updated');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    Promise.all([loadRepos(), loadManifest().catch(() => ({ projects: {} }))])
      .then(([list, manifest]) => {
        if (!active) return;
        const projects = manifest.projects || {};
        const merged = list.map(repo => {
          const preview = projects[repo.name] || null;
          return {
            ...repo,
            preview,
            pages: preview?.url ? { url: preview.url } : null,
          };
        });
        setRepos(merged);
        setStatus('ready');
      })
      .catch(err => {
        if (active) {
          setError(err.message || 'Unknown error');
          setStatus('error');
        }
      });
    return () => { active = false; };
  }, [refresh]);

  const types = useMemo(() => ['All types', ...new Set(repos.map(repo => repo.type).sort())], [repos]);
  const filtered = useMemo(() => repos
    .filter(repo => `${repo.name} ${repo.description || ''} ${repo.language || ''} ${repo.type}`.toLowerCase().includes(query.toLowerCase())
      && (type === 'All types' || repo.type === type))
    .sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name)
      : sort === 'stars'
        ? b.stargazers_count - a.stargazers_count
        : new Date(b.updated_at) - new Date(a.updated_at)), [repos, query, type, sort]);

  const live = repos.filter(repo => repo.pages).length;
  const captured = repos.filter(repo => repo.preview?.screenshot).length;

  return (
    <main className="app-shell">
      <nav className="nav">
        <Link href={GH + '?tab=repositories'} className="brand"><span className="brand-symbol">A.</span><span>AKCIZUR<span className="brand-muted"> / PROJECT INDEX</span></span></Link>
        <Link href={GH} className="nav-link">GitHub profile ↗</Link>
      </nav>
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> AUTOMATIC PROJECT PREVIEWS</p>
          <h1>Built in public.<br /><span>One place.</span></h1>
          <p className="hero-description">A live index of public projects. GitHub Actions automatically visits configured Pages URLs and captures screenshots on every deployment.</p>
        </div>
        <div className="hero-aside">
          <span className="aside-label">PUBLIC PROJECTS</span>
          <strong>{status === 'loading' ? '—' : String(repos.length).padStart(2, '0')}</strong>
          <span className="aside-foot">{captured} screenshots · {live} live URLs</span>
        </div>
      </header>
      <section className="control-row" aria-label="Project filters">
        <label className="search-box"><span>⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects…" aria-label="Search projects" /></label>
        <select value={type} onChange={event => setType(event.target.value)} aria-label="Filter by type">{types.map(item => <option key={item}>{item}</option>)}</select>
        <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort projects"><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="stars">Most stars</option></select>
        <button className="refresh-button" onClick={() => setRefresh(value => value + 1)} title="Refresh repository data" aria-label="Refresh repository data">↻</button>
      </section>
      <div className="results-bar"><span>{filtered.length} PROJECTS</span><span>{status === 'loading' ? 'FETCHING GITHUB DATA' : status === 'error' ? 'API ERROR' : 'SCREENSHOTS FROM LAST DEPLOY'}</span></div>
      {status === 'error' && <div className="error-panel">Unable to load GitHub repositories: {error}. <button onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {status === 'loading'
        ? <div className="loading-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index}><div /><span /></div>)}</div>
        : <section className="project-grid" aria-label="GitHub repositories">{filtered.map((repo, index) => <Card key={repo.id} repo={repo} index={index} />)}</section>}
      {status !== 'loading' && filtered.length === 0 && status !== 'error' && <div className="empty-state">No projects match this search.</div>}
      <footer className="footer"><span>AKCIZUR / OPEN SOURCE INDEX</span><span>React · Vite · Playwright</span><Link href={GH + '?tab=repositories'}>View all repositories ↗</Link></footer>
    </main>
  );
}
