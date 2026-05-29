/**
 * GitHubScoreCard.jsx
 * Self-contained GitHub Score Card for UniRank student profiles.
 * Uses only GitHub public REST API (no auth required for public repos).
 * Props:
 *   - initialUsername  {string}    — pre-fills & auto-triggers analysis
 *   - onScoreCalculated {function} — called with { score, rank, username }
 *   - isOwnProfile      {boolean}  — shows input/analyze UI only to owner
 */

import { useState, useEffect, useCallback } from 'react'

/* ─── Design tokens (dark, self-contained) ──────────────────────────── */
const T = {
  bg:         '#0a0a0f',
  card:       '#0e0e18',
  cardBorder: '#1e1e2e',
  inputBg:    '#12121c',
  inputBorder:'#2a2a3f',
  accent1:    '#6366f1',
  accent2:    '#8b5cf6',
  textPrimary:'#e8e8f0',
  textMuted:  '#9090a8',
  textDim:    '#666680',
  barFill:    '#6366f1',
  barEmpty:   '#1e1e2e',
  success:    '#22c55e',
  warn:       '#f59e0b',
}

const RANK_THRESHOLDS = [
  { min: 9,   label: 'Elite',        color: '#ffd700' },
  { min: 7,   label: 'Advanced',     color: '#6366f1' },
  { min: 5,   label: 'Intermediate', color: '#22c55e' },
  { min: 3,   label: 'Beginner',     color: '#f59e0b' },
  { min: 0,   label: 'Starter',      color: '#9090a8' },
]

function getRank(score) {
  return RANK_THRESHOLDS.find(r => score >= r.min) || RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1]
}

/* ─── Scoring helpers ───────────────────────────────────────────────── */
function scoreImplementation(repo, languages, commitCount) {
  let s = 0
  if (Object.keys(languages).length > 1) s += 2
  if (commitCount > 10) s += 3
  else if (commitCount > 5) s += 2
  else if (commitCount > 1) s += 1
  if (repo.topics && repo.topics.length > 0) s += 1
  if (repo.size > 100) s += 2
  else if (repo.size > 50) s += 1
  if (!repo.fork) s += 1
  return Math.min(s, 10)
}

function scoreWorking(repo) {
  let s = 0
  if (repo.has_readme || repo.description) {
    // README check done separately; description as proxy if readme unavailable
  }
  if (repo.has_readme) s += 3
  if (repo.description) s += 2
  if (repo.homepage) s += 2
  const sixMonthsAgo = Date.now() - 1000 * 60 * 60 * 24 * 180
  if (repo.pushed_at && new Date(repo.pushed_at).getTime() > sixMonthsAgo) s += 2
  if (repo.open_issues_count > 0) s += 1
  return Math.min(s, 10)
}

function scoreImpact(repo) {
  let s = 0
  if (repo.stargazers_count > 50) s += 4
  else if (repo.stargazers_count > 10) s += 3
  else if (repo.stargazers_count > 5) s += 2
  else if (repo.stargazers_count > 0) s += 1
  if (repo.forks_count > 10) s += 3
  else if (repo.forks_count > 3) s += 2
  else if (repo.forks_count > 0) s += 1
  if (repo.watchers_count > 2) s += 2
  if (!repo.archived) s += 1
  if (repo.topics && repo.topics.length > 0) s += 1
  return Math.min(s, 10)
}

/* ─── GitHub API fetch ──────────────────────────────────────────────── */
async function fetchGitHubData(username) {
  const base = 'https://api.github.com'
  const headers = { Accept: 'application/vnd.github.mercy-preview+json' }

  const [userRes, reposRes] = await Promise.all([
    fetch(`${base}/users/${username}`, { headers }),
    fetch(`${base}/users/${username}/repos?per_page=100&sort=stars`, { headers }),
  ])

  if (userRes.status === 404) throw new Error('USER_NOT_FOUND')
  if (userRes.status === 403 || reposRes.status === 403) throw new Error('RATE_LIMITED')
  if (!userRes.ok) throw new Error('NETWORK_ERROR')

  const userData = await userRes.json()
  const repos = await reposRes.json()

  if (!Array.isArray(repos) || repos.length === 0) {
    return { userData, repos: [], analyzed: [] }
  }

  // Take top 10 by stars
  const top10 = repos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10)

  // Parallel fetch: languages + commit count for each repo
  const analyzed = await Promise.all(
    top10.map(async (repo) => {
      try {
        const [langRes, commitRes] = await Promise.all([
          fetch(`${base}/repos/${username}/${repo.name}/languages`, { headers }),
          fetch(`${base}/repos/${username}/${repo.name}/commits?per_page=1`, { headers }),
        ])

        if (langRes.status === 403 || commitRes.status === 403) throw new Error('RATE_LIMITED')

        const languages = langRes.ok ? await langRes.json() : {}

        // Extract total commits from Link header
        let commitCount = 0
        const linkHeader = commitRes.headers.get('Link') || ''
        const match = linkHeader.match(/&page=(\d+)>; rel="last"/)
        if (match) {
          commitCount = parseInt(match[1], 10)
        } else if (commitRes.ok) {
          const commits = await commitRes.json()
          commitCount = Array.isArray(commits) ? commits.length : 0
        }

        // Check README via topics field (topics endpoint returns has_readme proxy)
        // We'll use description existence + homepage as indicators
        const has_readme = Boolean(repo.description) || repo.size > 10

        const enriched = { ...repo, has_readme }
        return {
          repo: enriched,
          languages,
          commitCount,
          impl:   scoreImplementation(enriched, languages, commitCount),
          working: scoreWorking(enriched),
          impact: scoreImpact(enriched),
        }
      } catch {
        const has_readme = Boolean(repo.description) || repo.size > 10
        const enriched = { ...repo, has_readme }
        return {
          repo: enriched,
          languages: {},
          commitCount: 0,
          impl:    scoreImplementation(enriched, {}, 0),
          working: scoreWorking(enriched),
          impact:  scoreImpact(enriched),
        }
      }
    })
  )

  return { userData, repos, analyzed }
}

/* ─── Sub-components ────────────────────────────────────────────────── */
function CircularScore({ score }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const pct = Math.min(score / 10, 1)
  const dash = pct * circ
  const rank = getRank(score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="gh-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={T.accent1} />
              <stop offset="100%" stopColor={T.accent2} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="70" cy="70" r={r} fill="none" stroke={T.barEmpty} strokeWidth="10" />
          {/* Fill */}
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke="url(#gh-ring-grad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        {/* Center text */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: T.textPrimary, lineHeight: 1, fontFamily: 'Sora, Inter, sans-serif' }}>
            {score.toFixed(1)}
          </span>
          <span style={{ fontSize: 11, color: T.textDim, fontWeight: 700, marginTop: 2 }}>/ 10</span>
        </div>
      </div>
      {/* Rank badge */}
      <div style={{
        background: `${rank.color}22`,
        border: `1px solid ${rank.color}55`,
        color: rank.color,
        borderRadius: 20,
        padding: '4px 16px',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {rank.label}
      </div>
    </div>
  )
}

function ScoreBar({ label, score }) {
  const pct = (score / 10) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 110, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 6, background: T.barEmpty, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: `linear-gradient(90deg, ${T.accent1}, ${T.accent2})`,
          borderRadius: 99,
          transition: 'width 1s ease',
        }} />
      </div>
      <span style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 800, color: T.textPrimary, flexShrink: 0 }}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

function StatChip({ label, value }) {
  return (
    <div style={{
      background: T.inputBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 10,
      padding: '10px 16px',
      textAlign: 'center',
      flex: 1,
    }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: T.textPrimary, fontFamily: 'Sora, Inter, sans-serif' }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function LangDot({ lang }) {
  const colors = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8',
    Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95', Swift: '#ffac45',
    Kotlin: '#A97BFF', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
    Vue: '#41b883', Dart: '#00B4AB', R: '#198CE7', Scala: '#c22d40',
  }
  const c = colors[lang] || T.accent1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />
      {lang}
    </span>
  )
}

function RepoCard({ item }) {
  const { repo, languages, impl, working, impact } = item
  const repoScore = ((impl + working + impact) / 3).toFixed(1)
  const topLang = Object.keys(languages)[0] || null

  return (
    <div style={{
      background: T.inputBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      position: 'relative',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, fontWeight: 800, color: T.accent1, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {repo.name}
          </a>
          {repo.fork && (
            <span style={{ fontSize: 9, color: T.textDim, border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>FORK</span>
          )}
        </div>
        {repo.description && (
          <p style={{ fontSize: 11, color: T.textDim, margin: '0 0 8px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {repo.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {topLang && <LangDot lang={topLang} />}
          <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600 }}>⭐ {repo.stargazers_count}</span>
          <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600 }}>🍴 {repo.forks_count}</span>
          {repo.homepage && (
            <a href={repo.homepage} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: T.accent2, fontWeight: 600, textDecoration: 'none' }}>
              🔗 Demo
            </a>
          )}
        </div>
      </div>
      {/* Score pill */}
      <div style={{
        background: `${T.accent1}22`,
        border: `1px solid ${T.accent1}44`,
        color: T.accent1,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 800,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}>
        {repoScore}
      </div>
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────────────────── */
export default function GitHubScoreCard({ initialUsername = '', onScoreCalculated, isOwnProfile = true }) {
  const [username, setUsername] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [errorType, setErrorType] = useState(null) // USER_NOT_FOUND | RATE_LIMITED | NETWORK_ERROR | EMPTY_REPOS
  const [result, setResult] = useState(null)

  // Extract username from a possible full GitHub URL
  function parseUsername(raw) {
    const trimmed = raw.trim()
    try {
      const url = new URL(trimmed)
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(Boolean)
        return parts[0] || ''
      }
    } catch {
      // not a URL — use as-is
    }
    return trimmed
  }

  const analyze = useCallback(async (uname) => {
    const parsed = parseUsername(uname)
    if (!parsed) return
    setUsername(parsed)
    setStatus('loading')
    setErrorType(null)
    setResult(null)

    try {
      const { userData, repos, analyzed } = await fetchGitHubData(parsed)

      if (repos.length === 0) {
        setStatus('error')
        setErrorType('EMPTY_REPOS')
        return
      }

      // Aggregate scores across top repos
      const avgImpl    = analyzed.reduce((s, r) => s + r.impl, 0) / analyzed.length
      const avgWorking = analyzed.reduce((s, r) => s + r.working, 0) / analyzed.length
      const avgImpact  = analyzed.reduce((s, r) => s + r.impact, 0) / analyzed.length
      const finalScore = parseFloat(((avgImpl + avgWorking + avgImpact) / 3).toFixed(1))

      const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0)
      const totalForks = repos.reduce((s, r) => s + r.forks_count, 0)

      const resultData = {
        userData,
        analyzed: analyzed.slice(0, 3),
        scores: { impl: avgImpl, working: avgWorking, impact: avgImpact, final: finalScore },
        stats: { repos: repos.length, stars: totalStars, forks: totalForks },
      }

      setResult(resultData)
      setStatus('done')

      if (onScoreCalculated) {
        onScoreCalculated({
          score:   finalScore,
          rank:    getRank(finalScore).label,
          username: parsed,
          impl:    parseFloat(avgImpl.toFixed(1)),
          working: parseFloat(avgWorking.toFixed(1)),
          impact:  parseFloat(avgImpact.toFixed(1)),
        })
      }
    } catch (err) {
      setStatus('error')
      setErrorType(err.message || 'NETWORK_ERROR')
    }
  }, [onScoreCalculated])

  // Auto-trigger if initialUsername provided
  useEffect(() => {
    if (initialUsername) {
      const parsed = parseUsername(initialUsername)
      setInputVal(parsed)
      analyze(parsed)
    }
  }, [initialUsername]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyze = () => {
    const parsed = parseUsername(inputVal)
    if (parsed) analyze(parsed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAnalyze()
  }

  /* ── styles ── */
  const containerStyle = {
    fontFamily: 'Sora, Inter, "DM Sans", sans-serif',
    background: T.card,
    border: `1px solid ${T.cardBorder}`,
    borderRadius: 16,
    padding: 24,
    color: T.textPrimary,
  }

  /* ── Render: input section ── */
  const InputSection = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={T.accent1}>
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          GitHub Score
        </span>
      </div>
      {isOwnProfile && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={T.textDim}>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </div>
            <input
              id="github-username-input"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter GitHub username..."
              style={{
                width: '100%',
                background: T.inputBg,
                border: `1px solid ${T.inputBorder}`,
                borderRadius: 10,
                padding: '10px 14px 10px 36px',
                color: T.textPrimary,
                fontSize: 14,
                fontFamily: 'Sora, Inter, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            id="github-analyze-btn"
            onClick={handleAnalyze}
            disabled={status === 'loading' || !inputVal.trim()}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              cursor: status === 'loading' || !inputVal.trim() ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' || !inputVal.trim() ? 0.6 : 1,
              fontFamily: 'Sora, Inter, sans-serif',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
            }}
          >
            {status === 'loading' ? '...' : 'Analyze'}
          </button>
        </div>
      )}
      {!isOwnProfile && status === 'idle' && (
        <p style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          No GitHub score analyzed yet.
        </p>
      )}
    </div>
  )

  /* ── Render: loading ── */
  const LoadingSection = (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 10, height: 10,
            borderRadius: '50%',
            background: T.accent1,
            animation: `gh-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: T.textDim, fontWeight: 600 }}>Scanning repositories...</p>
      <style>{`
        @keyframes gh-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )

  /* ── Render: error ── */
  const ErrorSection = () => {
    const msgs = {
      USER_NOT_FOUND: { icon: '🔍', title: 'GitHub user not found', sub: `"${username}" doesn't exist on GitHub.` },
      RATE_LIMITED:   { icon: '⚠️', title: 'GitHub rate limit reached', sub: 'GitHub rate limit reached. Add a free token in Settings to continue.' },
      EMPTY_REPOS:    { icon: '📭', title: 'No public repositories found', sub: `${username} has no public repos to analyze.` },
      NETWORK_ERROR:  { icon: '🌐', title: 'Failed to fetch', sub: 'Check your internet connection and try again.' },
    }
    const m = msgs[errorType] || msgs.NETWORK_ERROR
    return (
      <div style={{
        background: '#1a0a0a',
        border: '1px solid #3f1515',
        borderRadius: 12,
        padding: '20px 24px',
        textAlign: 'center',
        marginTop: 16,
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
        <p style={{ fontSize: 14, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>{m.title}</p>
        <p style={{ fontSize: 12, color: T.textDim }}>{m.sub}</p>
        {isOwnProfile && (
          <button
            onClick={() => { setStatus('idle'); setErrorType(null) }}
            style={{
              marginTop: 14,
              background: T.inputBg,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 8,
              color: T.textMuted,
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 16px',
              cursor: 'pointer',
              fontFamily: 'Sora, Inter, sans-serif',
            }}
          >
            Try Again
          </button>
        )}
      </div>
    )
  }

  /* ── Render: result ── */
  const ResultSection = () => {
    if (!result) return null
    const { userData, analyzed, scores, stats } = result
    const { final, impl, working, impact } = scores

    return (
      <div style={{ marginTop: 20 }}>
        {/* User header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <img
            src={userData.avatar_url}
            alt={userData.login}
            style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${T.accent1}`, flexShrink: 0, objectFit: 'cover' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userData.name || userData.login}
            </p>
            <a
              href={`https://github.com/${userData.login}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: T.accent1, fontWeight: 600, textDecoration: 'none' }}
            >
              @{userData.login}
            </a>
            {userData.bio && (
              <p style={{ fontSize: 11, color: T.textDim, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userData.bio}
              </p>
            )}
          </div>
        </div>

        {/* Score ring + sub-bars */}
        <div style={{
          background: T.inputBg,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 14,
          padding: 20,
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <CircularScore score={final} />
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ScoreBar label="Implementation" score={impl} />
              <ScoreBar label="Working"        score={working} />
              <ScoreBar label="Impact"         score={impact} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <StatChip label="Repos"  value={stats.repos} />
          <StatChip label="Stars"  value={stats.stars} />
          <StatChip label="Forks"  value={stats.forks} />
        </div>

        {/* Top repos */}
        {analyzed.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Top Repositories
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {analyzed.map(item => <RepoCard key={item.repo.id} item={item} />)}
            </div>
          </div>
        )}

        {/* Re-analyze button (own profile only) */}
        {isOwnProfile && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              id="github-reanalyze-btn"
              onClick={() => { setStatus('idle'); setResult(null); setErrorType(null) }}
              style={{
                background: T.inputBg,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 8,
                color: T.textMuted,
                fontSize: 11,
                fontWeight: 700,
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'Sora, Inter, sans-serif',
              }}
            >
              ↺ Re-analyze
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div id="github-score-card" style={containerStyle}>
      {/* Input always shown when idle/error and own profile */}
      {(status === 'idle' || (status === 'error' && isOwnProfile)) && InputSection}
      {status === 'loading' && (
        <>
          {/* Show input above loader too */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={T.accent1}>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                GitHub Score
              </span>
              <span style={{ marginLeft: 8, fontSize: 11, color: T.textDim, fontWeight: 600 }}>
                @{username}
              </span>
            </div>
          </div>
          {LoadingSection}
        </>
      )}
      {status === 'error' && <ErrorSection />}
      {status === 'done' && (
        <>
          {/* Show header label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={T.accent1}>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              GitHub Score
            </span>
          </div>
          <ResultSection />
        </>
      )}
    </div>
  )
}
