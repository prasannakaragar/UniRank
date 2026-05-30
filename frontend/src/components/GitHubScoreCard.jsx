/**
 * GitHubScoreCard.jsx
 * Display-only component for GitHub scores, fed by backend data.
 */

import React from 'react'

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

/* ─── Main Component ────────────────────────────────────────────────── */
export default function GitHubScoreCard({ profile }) {
  const hasGitHubData = profile && (profile.github_total_score !== undefined || profile.github_repos !== undefined);
  
  const containerStyle = {
    fontFamily: 'Sora, Inter, "DM Sans", sans-serif',
    background: T.card,
    border: `1px solid ${T.cardBorder}`,
    borderRadius: 16,
    padding: 24,
    color: T.textPrimary,
  }

  if (!hasGitHubData) {
    return (
      <div id="github-score-card" style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={T.accent1}>
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            GitHub Score
          </span>
        </div>
        <p style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          No GitHub score analyzed yet. Click "Refresh Profile" to calculate.
        </p>
      </div>
    )
  }

  const final = profile.github_total_score || 0
  const impl = profile.github_impl_score || 0
  const working = profile.github_work_score || 0
  const impact = profile.github_imp_score || 0
  const username = profile.github_username || ''
  
  return (
    <div id="github-score-card" style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={T.accent1}>
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          GitHub Score
        </span>
      </div>

      <div style={{ marginTop: 20 }}>
        {/* User header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {username && (
              <a
                href={`https://github.com/${username}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 15, color: T.accent1, fontWeight: 800, textDecoration: 'none' }}
              >
                @{username}
              </a>
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
          <StatChip label="Repos"  value={profile.github_repos || 0} />
          <StatChip label="Stars"  value={profile.github_stars || 0} />
          <StatChip label="Commits"  value={profile.github_commits || 0} />
        </div>

      </div>
    </div>
  )
}
