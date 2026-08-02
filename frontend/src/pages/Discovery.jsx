import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/axios'

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function HighlightMatch({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return <span>{text}</span>

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)

  return (
    <span>
      {before}
      <strong className="text-primary font-bold">{match}</strong>
      {after}
    </span>
  )
}

const CAMPUS_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1564981797816-1043664bf78d?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1525921429624-479b6a26d84d?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1548625361-e88cfa8b8869?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&h=350&fit=crop',
  'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&h=350&fit=crop',
]

function getCollegeCampusImage(college) {
  if (college?.image_url && college.image_url.startsWith('http') && !college.image_url.includes('upload.wikimedia.org') && college.image_url !== '/default-college.jpg') {
    return college.image_url
  }
  const str = ((college?.name || college?.domain || 'college') + '').toLowerCase()
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return CAMPUS_FALLBACK_IMAGES[Math.abs(hash) % CAMPUS_FALLBACK_IMAGES.length]
}

// ── Main Discovery Component ────────────────────────────────────────

export default function Discovery() {
  const [tab, setTab] = useState('colleges')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const autocompleteDebounced = useDebounce(search, 150)

  // Data states
  const [colleges, setColleges] = useState([])
  const [internships, setInternships] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // Autocomplete combobox states
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const comboboxRef = useRef(null)

  // Live Scraping states
  const [discovering, setDiscovering] = useState(false)
  const [scrapeSteps, setScrapeSteps] = useState([])
  const [scrapeError, setScrapeError] = useState(null)

  // Sidebar
  const [crawlerStatus, setCrawlerStatus] = useState(null)
  const [crawling, setCrawling] = useState(false)
  const [manualLogs, setManualLogs] = useState([])
  const terminalRef = useRef(null)

  // Detail Modals
  const [selectedCollege, setSelectedCollege] = useState(null)
  const [selectedInternship, setSelectedInternship] = useState(null)

  // ── Fetch colleges or internships on tab/search change ─────────────
  useEffect(() => {
    setLoadingData(true)
    const params = debouncedSearch ? { search: debouncedSearch } : {}
    const endpoint = tab === 'colleges' ? '/colleges' : '/internships'

    api.get(endpoint, { params })
      .then(res => {
        if (tab === 'colleges') setColleges(res.data)
        else setInternships(res.data)
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [tab, debouncedSearch])

  // ── Autocomplete fetch (150ms debounce) ─────────────────────────
  useEffect(() => {
    if (tab !== 'colleges' || autocompleteDebounced.trim().length < 2) {
      setSuggestions([])
      setLoadingSuggestions(false)
      return
    }

    setLoadingSuggestions(true)
    api.get('/colleges/autocomplete', { params: { q: autocompleteDebounced.trim() } })
      .then(res => {
        setSuggestions(res.data || [])
        setDropdownOpen(true)
        setSelectedIndex(-1)
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false))
  }, [tab, autocompleteDebounced])

  // ── Poll crawler status ─────────────────────────────────────────
  const fetchCrawlerStatus = useCallback(() => {
    api.get('/internships/crawler-status')
      .then(res => setCrawlerStatus(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCrawlerStatus()
    const id = setInterval(fetchCrawlerStatus, 30000)
    return () => clearInterval(id)
  }, [fetchCrawlerStatus])

  // ── Close combobox on click outside ──────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Scroll terminal to bottom ───────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [crawlerStatus?.logs, manualLogs, scrapeSteps])

  // ── Live Discover Handler ────────────────────────────────────────
  const handleLiveDiscover = async (queryToScrape) => {
    const q = (queryToScrape || search).trim()
    if (!q) return

    setDropdownOpen(false)
    setDiscovering(true)
    setScrapeError(null)

    // Initial progressive UI steps
    const initialSteps = [
      { message: `🔍 Searching the web for "${q}"...`, timestamp: new Date().toISOString() },
    ]
    setScrapeSteps(initialSteps)

    try {
      // Step 2 indicator
      setTimeout(() => {
        setScrapeSteps(prev => [
          ...prev,
          { message: `🌐 Resolving official college website...`, timestamp: new Date().toISOString() },
        ])
      }, 800)

      // Step 3 indicator
      setTimeout(() => {
        setScrapeSteps(prev => [
          ...prev,
          { message: `📄 Reading placement & program data...`, timestamp: new Date().toISOString() },
        ])
      }, 1600)

      const res = await api.post('/colleges/discover', { query: q })
      const { college, cached, logs } = res.data

      const doneMessage = cached
        ? `✓ Cache hit: Loaded profile for '${college.name}'`
        : college.lpa_verified
        ? `✓ Live scrape completed: Verified placement data (${college.highest_package})`
        : `✓ Live scrape completed: Profile registered`

      setScrapeSteps(prev => [
        ...prev,
        { message: doneMessage, timestamp: new Date().toISOString() },
      ])

      // Push logs to sidebar terminal
      if (logs && logs.length > 0) {
        setManualLogs(logs)
      }

      // Refresh colleges list & open modal
      api.get('/colleges').then(r => setColleges(r.data)).catch(() => {})
      setSelectedCollege(college)
    } catch (err) {
      console.error('Live discovery error:', err)
      setScrapeError('⚠ Couldn\'t verify live data — showing basic profile only')
      setScrapeSteps(prev => [
        ...prev,
        { message: '⚠ Scraping failed — using fallback template', timestamp: new Date().toISOString() },
      ])
    } finally {
      setDiscovering(false)
    }
  }

  // ── Keyboard support for combobox ────────────────────────────────
  const handleKeyDown = (e) => {
    if (!dropdownOpen) return
    const maxIdx = suggestions.length // includes "Search the web" option at index === suggestions.length

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < maxIdx ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIdx))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        const item = suggestions[selectedIndex]
        handleSelectSuggestion(item)
      } else if (selectedIndex === suggestions.length || suggestions.length === 0) {
        handleLiveDiscover(search)
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
    }
  }

  const handleSelectSuggestion = (item) => {
    setSearch(item.name)
    setDropdownOpen(false)
    // Check if college exists in database
    const existing = colleges.find(c => c.name.toLowerCase() === item.name.toLowerCase() || c.domain === item.domain)
    if (existing) {
      openCollegeDetail(existing)
    } else {
      handleLiveDiscover(item.name)
    }
  }

  // ── Manual crawl trigger ────────────────────────────────────────
  const handleTriggerCrawl = async () => {
    setCrawling(true)
    setManualLogs([])
    try {
      const res = await api.post('/internships/crawl')
      setManualLogs(res.data.logs || [])
      fetchCrawlerStatus()
      if (tab === 'internships') {
        const params = debouncedSearch ? { search: debouncedSearch } : {}
        api.get('/internships', { params }).then(r => setInternships(r.data)).catch(() => {})
      }
    } catch {
      setManualLogs([{ message: '⚠ Crawl trigger failed', college: 'system', timestamp: new Date().toISOString() }])
    } finally {
      setCrawling(false)
    }
  }

  // ── Modals ──────────────────────────────────────────────────────
  const openCollegeDetail = async (college) => {
    try {
      const res = await api.get(`/colleges/${college.id}`)
      setSelectedCollege(res.data)
    } catch {
      setSelectedCollege(college)
    }
  }

  const openInternshipDetail = async (internship) => {
    try {
      const res = await api.get(`/internships/${internship.id}`)
      setSelectedInternship(res.data)
    } catch {
      setSelectedInternship(internship)
    }
  }

  const allLogs = [
    ...(scrapeSteps.length > 0 ? [{ message: '> live_discovery_engine.sh', college: '', timestamp: scrapeSteps[0]?.timestamp, isHeader: true }, ...scrapeSteps] : []),
    ...(manualLogs.length > 0 ? [{ message: '> manual_aggregation_sync.sh', college: '', timestamp: manualLogs[0]?.timestamp, isHeader: true }, ...manualLogs] : []),
    ...(crawlerStatus?.logs || []),
  ]

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* ── Left: Main Content ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Discovery
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Real-time college lookup & live website scraping engine matched with research internships.
          </p>
        </div>

        {/* Tab switcher + Search Combobox */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-white rounded-xl border border-border-dim p-1 shadow-card flex-shrink-0">
            {['colleges', 'internships'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(''); setDropdownOpen(false) }}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  tab === t
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t === 'colleges' ? '🏛 Colleges' : '🔬 Internships'}
              </button>
            ))}
          </div>

          {/* Combobox Search Input */}
          <div className="flex-1 relative" ref={comboboxRef}>
            <div className="relative">
              <input
                type="text"
                placeholder={tab === 'colleges' ? 'Type college name (e.g. IIT Bombay, RVCE, BITS)...' : 'Search by title, college, or skill...'}
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
                onFocus={() => { if (tab === 'colleges' && suggestions.length > 0) setDropdownOpen(true) }}
                onKeyDown={handleKeyDown}
                className="input pl-10 pr-10"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
              </svg>

              {/* Inline spinner for instant autocomplete */}
              {loadingSuggestions && tab === 'colleges' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Google-Style Autocomplete Dropdown */}
            {tab === 'colleges' && dropdownOpen && search.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border-dim rounded-xl shadow-2xl overflow-hidden z-40 animate-in fade-in duration-150">
                {suggestions.length > 0 && (
                  <div className="py-1 max-h-[300px] overflow-y-auto">
                    {suggestions.map((item, index) => {
                      const isSelected = selectedIndex === index
                      return (
                        <div
                          key={item.id || index}
                          onClick={() => handleSelectSuggestion(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-accent-pill text-primary font-semibold' : 'hover:bg-page text-text-primary'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {item.name[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-text-primary truncate">
                              <HighlightMatch text={item.name} query={search} />
                            </p>
                            <p className="text-[10px] text-text-secondary truncate">
                              📍 {item.location} · <span className="font-mono text-gray-400">{item.domain}</span>
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* "Search the web for '<query>'" Option */}
                <div
                  onClick={() => handleLiveDiscover(search)}
                  onMouseEnter={() => setSelectedIndex(suggestions.length)}
                  className={`px-4 py-3 border-t border-border-dim flex items-center gap-3 cursor-pointer text-xs font-bold transition-colors ${
                    selectedIndex === suggestions.length
                      ? 'bg-primary text-white'
                      : 'bg-page text-primary hover:bg-primary/10'
                  }`}
                >
                  <span className="text-base">🌐</span>
                  <span>Search the web for "{search}"</span>
                  <span className="ml-auto text-[10px] opacity-80">Live Scrape →</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progressive Scrape Progress Card */}
        {discovering && (
          <div className="mb-6 card border-primary/30 bg-accent-pill/40 animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <h3 className="font-extrabold text-sm text-text-primary">Live Scraping Official Website...</h3>
            </div>
            <div className="space-y-1 pl-8 text-xs font-mono text-text-secondary">
              {scrapeSteps.map((step, idx) => (
                <p key={idx} className={step.message.startsWith('✓') ? 'text-emerald-600 font-bold' : 'text-text-primary'}>
                  {step.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {scrapeError && (
          <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{scrapeError}</span>
          </div>
        )}

        {/* Main Content Skeleton (skeleton cards instead of blank/spinner) */}
        {loadingData && !discovering && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="w-full h-32 rounded-lg bg-gray-200 mb-3" />
                <div className="h-4 w-3/4 rounded-lg bg-gray-200 mb-2" />
                <div className="h-3 w-1/2 rounded bg-gray-100 mb-3" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-gray-200" />
                  <div className="h-5 w-24 rounded-full bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Colleges Grid ──────────────────────────────────────── */}
        {!loadingData && tab === 'colleges' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {colleges.length === 0 ? (
              <div className="col-span-full text-center py-16 text-text-secondary text-sm">
                No colleges found in local cache. Type in the box above to trigger live search.
              </div>
            ) : (
              colleges.map(college => (
                <button
                  key={college.id}
                  onClick={() => openCollegeDetail(college)}
                  className="card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left group cursor-pointer"
                >
                  <div className="w-full h-32 rounded-lg overflow-hidden mb-3 bg-page relative">
                    <img
                      src={getCollegeCampusImage(college)}
                      alt={college.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => { e.target.src = getCollegeCampusImage(college) }}
                    />
                    {college.lpa_verified && (
                      <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow">
                        ✓ Live Scraped
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-text-primary text-sm leading-snug truncate">{college.name}</h3>
                  <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                    <span>📍</span> {college.location}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="badge badge-primary text-[10px]">{college.degree_type}</span>
                    {college.lpa_verified ? (
                      <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px]">
                        ✓ {college.highest_package}
                      </span>
                    ) : (
                      <span className="badge bg-gray-50 text-gray-500 border border-gray-100 text-[10px]">
                        Data Not Available
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Internships List ───────────────────────────────────── */}
        {!loadingData && tab === 'internships' && (
          <div className="space-y-3">
            {internships.length === 0 ? (
              <div className="text-center py-16 text-text-secondary text-sm">
                No internships found. Try triggering the aggregation engine.
              </div>
            ) : (
              internships.map(intern => (
                <button
                  key={intern.id}
                  onClick={() => openInternshipDetail(intern)}
                  className="card w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg flex-shrink-0 border border-border-dim">
                      {intern.professor_image ? (
                        <img src={intern.professor_image} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-primary font-bold text-sm">{intern.professor_name?.[0]}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-text-primary text-sm leading-snug truncate">{intern.project_title}</h3>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {intern.professor_name} · {intern.college_name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {intern.match_score >= 80 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              🔥 Top Match ({intern.match_score}%)
                            </span>
                          )}
                          {intern.match_score >= 60 && intern.match_score < 80 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                              Strong Match ({intern.match_score}%)
                            </span>
                          )}

                          <div className="relative w-10 h-10 flex-shrink-0" title={`Opportunity Score: ${intern.opportunity_score}`}>
                            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="15" fill="none" stroke="#e8e2dc" strokeWidth="3" />
                              <circle
                                cx="18" cy="18" r="15" fill="none"
                                stroke={intern.opportunity_score >= 70 ? '#10b981' : intern.opportunity_score >= 50 ? '#f59e0b' : '#94a3b8'}
                                strokeWidth="3"
                                strokeDasharray={`${intern.opportunity_score * 0.94} 100`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-text-primary">
                              {intern.opportunity_score}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {(intern.skills_required || []).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-page text-text-secondary border border-border-dim">
                            {skill}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-text-secondary">
                        <span>⏱ {intern.duration}</span>
                        <span className={intern.mode === 'remote' ? 'text-blue-600' : 'text-amber-600'}>
                          {intern.mode === 'remote' ? '🌐 Remote' : '🏢 On-site'}
                        </span>
                        <span className="font-semibold text-text-primary">{intern.stipend}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Right Sidebar: Aggregation Engine ──────────────────────── */}
      <div className="w-[320px] flex-shrink-0 space-y-4">
        <button
          onClick={handleTriggerCrawl}
          disabled={crawling}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          {crawling ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Crawling Portals...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Trigger Aggregation
            </>
          )}
        </button>

        {/* Live status card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-40" />
            </div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Running</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-page rounded-lg p-3 text-center">
              <p className="text-2xl font-extrabold text-text-primary">{crawlerStatus?.colleges_monitored ?? '—'}</p>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mt-0.5">Colleges</p>
            </div>
            <div className="bg-page rounded-lg p-3 text-center">
              <p className="text-2xl font-extrabold text-text-primary">{crawlerStatus?.active_opportunities ?? '—'}</p>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mt-0.5">Placements</p>
            </div>
          </div>
          {crawlerStatus?.last_sync && (
            <p className="text-[10px] text-text-secondary mt-2 text-center">Last sync: {timeAgo(crawlerStatus.last_sync)}</p>
          )}
        </div>

        {/* Terminal Console */}
        <div className="rounded-xl overflow-hidden border border-[#2a2a2a] shadow-lg">
          <div className="bg-[#1e1e1e] px-4 py-2.5 flex items-center gap-2 border-b border-[#333]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-[10px] text-[#888] font-mono">aggregation-engine</span>
          </div>

          <div
            ref={terminalRef}
            className="bg-[#1a1a1a] p-3 h-[340px] overflow-y-auto font-mono text-xs leading-relaxed"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#444 #1a1a1a' }}
          >
            {allLogs.length === 0 ? (
              <p className="text-[#555]">Waiting for crawler activity...</p>
            ) : (
              allLogs.map((log, i) => {
                if (log.isHeader) {
                  return (
                    <div key={`h-${i}`} className="text-[#61dafb] mt-2 mb-1">
                      {log.message}
                    </div>
                  )
                }
                const isSuccess = log.message?.startsWith('✓')
                const isError = log.message?.startsWith('⚠')
                const color = isSuccess ? 'text-[#28c840]' : isError ? 'text-[#ff5f57]' : 'text-[#777]'
                return (
                  <div key={`l-${i}`} className={`${color} leading-5`}>
                    <span className="text-[#555] mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    {log.message}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── College Detail Modal ───────────────────────────────────── */}
      {selectedCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCollege(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="h-40 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-t-2xl relative overflow-hidden">
              <img
                src={getCollegeCampusImage(selectedCollege)}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { e.target.src = getCollegeCampusImage(selectedCollege) }}
              />
              <button onClick={() => setSelectedCollege(null)} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/90 text-text-primary flex items-center justify-center hover:bg-gray-100 shadow-md">✕</button>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-text-primary">{selectedCollege.name}</h2>
                  <p className="text-sm text-text-secondary mt-0.5">📍 {selectedCollege.location} · {selectedCollege.degree_type}</p>
                </div>
                {selectedCollege.lpa_verified ? (
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                    ✓ Live Scraped & Verified
                  </span>
                ) : (
                  <span className="badge bg-gray-50 text-gray-500 border border-gray-200 font-semibold text-xs">
                    Unverified Profile
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-sm font-extrabold text-text-primary">{selectedCollege.highest_package}</p>
                  <p className="text-[10px] text-text-secondary font-bold uppercase mt-0.5">Highest Pkg</p>
                  {selectedCollege.lpa_verified && <span className="text-[9px] text-emerald-600 font-bold">✓ Official Website</span>}
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-sm font-extrabold text-text-primary">{selectedCollege.average_package}</p>
                  <p className="text-[10px] text-text-secondary font-bold uppercase mt-0.5">Average Pkg</p>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-sm font-extrabold text-text-primary">{selectedCollege.placement_rate}</p>
                  <p className="text-[10px] text-text-secondary font-bold uppercase mt-0.5">Placement Rate</p>
                </div>
              </div>

              {selectedCollege.about && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">About</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{selectedCollege.about}</p>
                </div>
              )}

              {selectedCollege.courses?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Courses Offered</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCollege.courses.map((c, i) => (
                      <span key={i} className="badge badge-primary text-[10px]">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCollege.recruiters?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Notable Recruiters</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCollege.recruiters.map((r, i) => (
                      <span key={i} className="badge badge-amber text-[10px]">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCollege.facilities?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Facilities</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCollege.facilities.map((f, i) => (
                      <span key={i} className="badge bg-blue-50 text-blue-600 border border-blue-100 text-[10px]">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCollege.source && (
                <a href={selectedCollege.source} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-xs text-primary hover:underline font-semibold">
                  🔗 Official Website Source ({selectedCollege.source}) →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Internship Detail Modal ────────────────────────────────── */}
      {selectedInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedInternship(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-text-primary">{selectedInternship.project_title}</h2>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {selectedInternship.professor_name} · {selectedInternship.college_name}
                  </p>
                </div>
                <button onClick={() => setSelectedInternship(null)} className="w-8 h-8 rounded-lg bg-page text-text-primary flex items-center justify-center hover:bg-gray-100 flex-shrink-0">✕</button>
              </div>

              <div className="mt-4 p-4 bg-page rounded-xl border border-border-dim">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#e8e2dc" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15" fill="none"
                        stroke={selectedInternship.match_score >= 80 ? '#10b981' : selectedInternship.match_score >= 60 ? '#f59e0b' : '#94a3b8'}
                        strokeWidth="3"
                        strokeDasharray={`${selectedInternship.match_score * 0.94} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-text-primary">
                      {selectedInternship.match_score}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">Your Match Score</p>
                    <div className="mt-1 space-y-0.5">
                      {(selectedInternship.recommendation_reasons || []).map((r, i) => (
                        <p key={i} className="text-xs text-text-secondary">• {r}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-xs font-extrabold text-text-primary">{selectedInternship.duration}</p>
                  <p className="text-[10px] text-text-secondary uppercase mt-0.5">Duration</p>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-xs font-extrabold text-text-primary">{selectedInternship.mode}</p>
                  <p className="text-[10px] text-text-secondary uppercase mt-0.5">Mode</p>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-xs font-extrabold text-text-primary">{selectedInternship.stipend}</p>
                  <p className="text-[10px] text-text-secondary uppercase mt-0.5">Stipend</p>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <p className="text-xs font-extrabold text-text-primary">{selectedInternship.opportunity_score}</p>
                  <p className="text-[10px] text-text-secondary uppercase mt-0.5">Opp. Score</p>
                </div>
              </div>

              {selectedInternship.skills_required?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInternship.skills_required.map((s, i) => (
                      <span key={i} className="badge badge-primary text-[10px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedInternship.description && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Description</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{selectedInternship.description}</p>
                </div>
              )}

              {selectedInternship.application_process && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">How to Apply</h3>
                  <p className="text-sm text-emerald-800">{selectedInternship.application_process}</p>
                </div>
              )}

              <div className="flex items-center gap-4 mt-4 text-xs text-text-secondary">
                {selectedInternship.deadline && (
                  <span>📅 Deadline: <strong className="text-text-primary">{selectedInternship.deadline}</strong></span>
                )}
                {selectedInternship.professor_email && (
                  <a href={`mailto:${selectedInternship.professor_email}`} className="text-primary hover:underline font-semibold">
                    ✉ {selectedInternship.professor_email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
