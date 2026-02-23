'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Paper, Collection, getToken, get, del, post, uploadFile } from '@/lib/api';
import PaperCard from '@/components/PaperCard';
import CollectionCard from '@/components/CollectionCard';

const colors = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F3EE',
  accent: '#C75B38',
  accentSecondary: '#4D8570',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#9E9E99',
  destructive: '#D94032',
  border: '#E0DFDA',
  cornerRadius: '14px',
  cornerRadiusSm: '8px',
};

const CATEGORIES = [
  'All',
  'Neuroscience',
  'Computer Science',
  'Biology',
  'Physics',
  'Mathematics',
  'Medicine',
  'Chemistry',
  'Engineering',
  'Psychology',
  'Economics',
  'Other',
];

type DashboardView = 'papers' | 'collections';

interface SearchResult {
  title: string;
  authors: string[];
  url: string;
  pdfUrl: string | null;
  source: string;
  publishedDate: string;
  abstract: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('papers');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionPapers, setCollectionPapers] = useState<Paper[]>([]);
  const [collectionPapersLoading, setCollectionPapersLoading] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [showDeleteCollectionConfirm, setShowDeleteCollectionConfirm] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState(false);

  const [selectedUrl, setSelectedUrl] = useState('');

  // Auth check
  useEffect(() => {
    if (!getToken()) {
      router.replace('/signin');
    }
  }, [router]);

  // Fetch papers
  const fetchPapers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await get<Paper[]>('/papers');
      setPapers(data);
    } catch {
      // Error handled by API client (redirects on 401)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      fetchPapers();
    }
  }, [fetchPapers]);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      setCollectionsLoading(true);
      const data = await get<Collection[]>('/collections');
      setCollections(data);
    } catch {
      // handled
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken() && dashboardView === 'collections') {
      fetchCollections();
    }
  }, [fetchCollections, dashboardView]);

  // Search papers (arXiv + PubMed)
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setShowSearchResults(true);
    try {
      const data = await get<{ results: SearchResult[]; total: number }>(
        `/papers/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  // Delete paper
  async function handleDelete(paperId: string) {
    if (!confirm('Delete this paper?')) return;
    try {
      await del(`/papers/${paperId}`);
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch {
      // Silently fail
    }
  }

  // Filter papers by category
  const filteredPapers =
    activeCategory === 'All'
      ? papers
      : papers.filter((p) => p.category === activeCategory);

  // Paper added callback
  function handlePaperAdded(paper: Paper) {
    setPapers((prev) => [paper, ...prev]);
    setDashboardView('papers');
  }

  // Click on search result to prefill add modal URL
  function handleSearchResultClick(result: SearchResult) {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
    setShowAddModal(true);
    setSelectedUrl(result.url);
  }

  // Collections handlers
  async function handleSelectCollection(collection: Collection) {
    setSelectedCollection(collection);
    setCollectionPapersLoading(true);
    setCollectionPapers([]);
    try {
      const data = await get<Paper[]>(`/collections/${collection.id}/papers`);
      setCollectionPapers(data);
    } catch {
      setCollectionPapers([]);
    } finally {
      setCollectionPapersLoading(false);
    }
  }

  function handleBackFromCollection() {
    setSelectedCollection(null);
    setCollectionPapers([]);
  }

  async function handleCreateCollection(e: FormEvent) {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    setCreatingCollection(true);
    try {
      await post('/collections', { name: newCollectionName.trim() });
      setNewCollectionName('');
      setShowCreateCollection(false);
      await fetchCollections();
    } catch {
      // handled
    } finally {
      setCreatingCollection(false);
    }
  }

  async function handleDeleteCollection() {
    if (!selectedCollection) return;
    setDeletingCollection(true);
    try {
      await del(`/collections/${selectedCollection.id}`);
      setSelectedCollection(null);
      setCollectionPapers([]);
      setShowDeleteCollectionConfirm(false);
      await fetchCollections();
    } catch {
      // handled
    } finally {
      setDeletingCollection(false);
    }
  }

  const ratingClass = (r: number) => {
    if (r >= 7) return '#38A666';
    if (r >= 5) return '#D1A626';
    return '#D94032';
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      {/* Top Bar */}
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '0 32px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: 400,
            color: colors.accent,
            fontFamily: "'Linndale Square NF', Georgia, serif",
            letterSpacing: '-0.5px',
          }}
        >
          skim
        </h1>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <button
            onClick={() => {
              setDashboardView('papers');
              setSelectedCollection(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: dashboardView === 'papers' ? colors.accent : colors.textSecondary,
              fontSize: '14px',
              fontWeight: dashboardView === 'papers' ? 600 : 500,
              cursor: 'pointer',
              transition: 'color 0.15s ease',
              padding: 0,
            }}
          >
            Papers
          </button>
          <button
            onClick={() => {
              setDashboardView('collections');
              setSelectedCollection(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: dashboardView === 'collections' ? colors.accent : colors.textSecondary,
              fontSize: '14px',
              fontWeight: dashboardView === 'collections' ? 600 : 500,
              cursor: 'pointer',
              transition: 'color 0.15s ease',
              padding: 0,
            }}
          >
            Collections
          </button>
          <a
            href="/settings"
            style={{
              color: colors.textSecondary,
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            Settings
          </a>
          {/* User icon */}
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.textSecondary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </nav>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 32px' }}>
        {dashboardView === 'papers' && (
          <>
            {/* Search + Add Paper row */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                alignItems: 'stretch',
                position: 'relative',
              }}
            >
              <form
                onSubmit={handleSearch}
                style={{ flex: 1, position: 'relative' }}
              >
                <div style={{ position: 'relative' }}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textTertiary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search papers (arXiv, PubMed)..."
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 46px',
                      borderRadius: colors.cornerRadius,
                      border: `1px solid ${colors.border}`,
                      fontSize: '15px',
                      color: colors.textPrimary,
                      background: colors.surface,
                      outline: 'none',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}18`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Search results dropdown */}
                {showSearchResults && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: colors.cornerRadius,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      zIndex: 50,
                    }}
                  >
                    {searchLoading ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: colors.textTertiary, fontSize: '14px' }}>
                        Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: colors.textTertiary, fontSize: '14px' }}>
                        No results found
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: colors.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Search Results
                          </span>
                          <button
                            onClick={() => { setShowSearchResults(false); setSearchResults([]); }}
                            style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: '13px', padding: '2px 8px' }}
                          >
                            Close
                          </button>
                        </div>
                        {searchResults.map((result, i) => (
                          <div
                            key={i}
                            onClick={() => handleSearchResultClick(result)}
                            style={{ padding: '14px 16px', cursor: 'pointer', borderTop: `1px solid ${colors.border}`, transition: 'background 0.1s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceElevated; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: colors.textPrimary, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {result.title}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: result.source === 'pubmed' ? '#4D8570' : colors.accent, background: result.source === 'pubmed' ? 'rgba(77,133,112,0.1)' : 'rgba(199,91,56,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                {result.source || 'arxiv'}
                              </span>
                              <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {result.authors?.join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </form>

              <button
                onClick={() => { setSelectedUrl(''); setShowAddModal(true); }}
                style={{
                  padding: '0 28px',
                  borderRadius: colors.cornerRadius,
                  border: 'none',
                  background: colors.accent,
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, transform 0.1s ease',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#B54E2F'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = colors.accent; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Paper
              </button>
            </div>

            {/* Category filter chips */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '28px',
                overflowX: 'auto',
                paddingBottom: '4px',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
              }}
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '24px',
                      border: isActive ? 'none' : `1px solid ${colors.border}`,
                      background: isActive ? colors.accent : colors.surface,
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = colors.surfaceElevated; e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textSecondary; } }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Paper grid */}
            {loading ? (
              <div style={{ textAlign: 'center', color: colors.textTertiary, padding: '60px 0', fontSize: '15px' }}>
                Loading papers...
              </div>
            ) : filteredPapers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', color: colors.textTertiary }}>
                  &#9776;
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: colors.textSecondary, fontWeight: 500 }}>
                  {activeCategory === 'All' ? 'No papers yet' : `No ${activeCategory} papers`}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: colors.textTertiary }}>
                  {activeCategory === 'All' ? 'Add your first paper above.' : 'Try a different category or add a new paper.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {filteredPapers.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    onClick={(p) => router.push(`/paper/${p.id}`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Collections view (inline) */}
        {dashboardView === 'collections' && (
          <>
            {!selectedCollection ? (
              <>
                {/* Collections header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: colors.textPrimary }}>
                    Collections
                  </h2>
                  <button
                    onClick={() => setShowCreateCollection(true)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: colors.cornerRadiusSm,
                      border: 'none',
                      background: colors.accent,
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New
                  </button>
                </div>

                {collectionsLoading ? (
                  <div style={{ textAlign: 'center', color: colors.textTertiary, padding: '60px 0', fontSize: '15px' }}>
                    Loading collections...
                  </div>
                ) : collections.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128194;</div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: colors.textSecondary, fontWeight: 500 }}>
                      No collections yet
                    </p>
                    <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: colors.textTertiary }}>
                      Create one to organize your papers.
                    </p>
                    <button
                      onClick={() => setShowCreateCollection(true)}
                      style={{
                        padding: '12px 24px',
                        borderRadius: colors.cornerRadiusSm,
                        border: 'none',
                        background: colors.accent,
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Create Collection
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    {collections.map((c) => (
                      <CollectionCard key={c.id} collection={c} onClick={handleSelectCollection} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selected collection view */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={handleBackFromCollection}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: colors.textSecondary,
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: colors.textPrimary }}>
                      {selectedCollection.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowDeleteCollectionConfirm(true)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: colors.cornerRadiusSm,
                      border: `1px solid ${colors.destructive}`,
                      background: 'transparent',
                      color: colors.destructive,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>

                {collectionPapersLoading ? (
                  <div style={{ textAlign: 'center', color: colors.textTertiary, padding: '60px 0', fontSize: '15px' }}>
                    Loading papers...
                  </div>
                ) : collectionPapers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128221;</div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: colors.textSecondary, fontWeight: 500 }}>
                      No papers in this collection
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: colors.textTertiary }}>
                      Add papers from your library to organize them here.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {collectionPapers.map((paper) => (
                      <div
                        key={paper.id}
                        onClick={() => router.push(`/paper/${paper.id}`)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          padding: '20px',
                          background: colors.surface,
                          border: `1px solid ${colors.border}`,
                          borderRadius: colors.cornerRadius,
                          transition: 'box-shadow 200ms ease, transform 200ms ease',
                          boxSizing: 'border-box',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: ratingClass(paper.rating), background: `${ratingClass(paper.rating)}18`, padding: '3px 10px', borderRadius: '20px' }}>
                            {paper.rating}/10
                          </span>
                          {paper.source && (
                            <span style={{ fontSize: '11px', fontWeight: 500, color: colors.accentSecondary, background: 'rgba(77,133,112,0.12)', padding: '2px 8px', borderRadius: '20px' }}>
                              {paper.source}
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4, color: colors.textPrimary, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                          {paper.title}
                        </h4>
                        <p style={{ fontSize: '12px', color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                          {paper.authors?.join(', ') || 'Unknown authors'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Add Paper Modal with drag-and-drop */}
      <AddPaperModalWithUpload
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setSelectedUrl(''); }}
        onAdded={handlePaperAdded}
        prefillUrl={selectedUrl}
      />

      {/* Create collection modal */}
      {showCreateCollection && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
          onClick={() => { setShowCreateCollection(false); setNewCollectionName(''); }}
        >
          <div
            style={{ background: colors.surface, borderRadius: colors.cornerRadius, padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>New Collection</h3>
            <form onSubmit={handleCreateCollection}>
              <input
                type="text"
                placeholder="e.g. Machine Learning"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: colors.cornerRadiusSm, border: `1px solid ${colors.border}`,
                  fontSize: '15px', color: colors.textPrimary, background: colors.surface, outline: 'none', boxSizing: 'border-box', marginBottom: '16px',
                }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowCreateCollection(false); setNewCollectionName(''); }}
                  style={{ padding: '10px 20px', borderRadius: colors.cornerRadiusSm, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.textSecondary, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creatingCollection || !newCollectionName.trim()}
                  style={{ padding: '10px 20px', borderRadius: colors.cornerRadiusSm, border: 'none', background: colors.accent, color: '#FFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: creatingCollection || !newCollectionName.trim() ? 0.5 : 1 }}>
                  {creatingCollection ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete collection confirm modal */}
      {showDeleteCollectionConfirm && selectedCollection && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
          onClick={() => setShowDeleteCollectionConfirm(false)}
        >
          <div
            style={{ background: colors.surface, borderRadius: colors.cornerRadius, padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>Delete Collection</h3>
            <p style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Are you sure you want to delete &ldquo;{selectedCollection.name}&rdquo;? Papers will not be deleted from your library.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteCollectionConfirm(false)}
                style={{ padding: '10px 20px', borderRadius: colors.cornerRadiusSm, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.textSecondary, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDeleteCollection} disabled={deletingCollection}
                style={{ padding: '10px 20px', borderRadius: colors.cornerRadiusSm, border: 'none', background: colors.destructive, color: '#FFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: deletingCollection ? 0.5 : 1 }}>
                {deletingCollection ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Add Paper Modal with URL input + drag-and-drop PDF upload
 */
function AddPaperModalWithUpload({
  isOpen,
  onClose,
  onAdded,
  prefillUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (paper: Paper) => void;
  prefillUrl: string;
}) {
  const [url, setUrl] = useState('');
  const [loadingState, setLoadingState] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(prefillUrl || '');
      setError('');
      setLoadingState(false);
      setDragOver(false);
      setUploadProgress('');
    }
  }, [isOpen, prefillUrl]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !loadingState) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, loadingState, onClose]);

  function detectSource(u: string): string {
    if (!u) return '';
    const lower = u.toLowerCase();
    if (lower.includes('arxiv.org')) return 'arXiv detected';
    if (lower.includes('pubmed') || lower.includes('ncbi.nlm.nih.gov')) return 'PubMed detected';
    if (lower.includes('doi.org')) return 'DOI link detected';
    if (lower.includes('biorxiv.org')) return 'bioRxiv detected';
    if (lower.includes('medrxiv.org')) return 'medRxiv detected';
    if (lower.endsWith('.pdf') || lower.includes('.pdf?')) return 'PDF link detected';
    if (u.length > 10) return 'Web link detected';
    return '';
  }

  const detectedSource = detectSource(url);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }
    setLoadingState(true);
    setError('');
    try {
      const paper = await post<Paper>('/papers', { url: url.trim() });
      onAdded(paper);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add paper';
      setError(message);
    } finally {
      setLoadingState(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum size is 100 MB.');
      return;
    }
    setLoadingState(true);
    setError('');
    setUploadProgress(`Uploading ${file.name}...`);
    try {
      const paper = await uploadFile<Paper>('/papers/upload', file);
      setUploadProgress('');
      onAdded(paper);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload PDF';
      setError(message);
      setUploadProgress('');
    } finally {
      setLoadingState(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeInModal 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loadingState) onClose();
      }}
    >
      <style>{`
        @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpModal { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        style={{
          background: colors.surface,
          borderRadius: colors.cornerRadius,
          padding: '32px',
          width: '100%',
          maxWidth: '520px',
          margin: '0 16px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
          animation: 'slideUpModal 0.25s ease',
        }}
      >
        <h2 style={{ margin: '0 0 24px 0', fontSize: '22px', fontWeight: 700, color: colors.textPrimary }}>
          Add Paper
        </h2>

        {/* Drag and drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !loadingState && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? colors.accent : colors.border}`,
            borderRadius: colors.cornerRadiusSm,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: loadingState ? 'not-allowed' : 'pointer',
            background: dragOver ? 'rgba(199,91,56,0.05)' : colors.surfaceElevated,
            transition: 'all 0.2s ease',
            marginBottom: '20px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragOver ? colors.accent : colors.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 500, color: dragOver ? colors.accent : colors.textSecondary }}>
            {uploadProgress || 'Drop a PDF here or click to browse'}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: colors.textTertiary }}>
            PDF files up to 100 MB
          </p>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: colors.border }} />
          <span style={{ fontSize: '12px', color: colors.textTertiary, fontWeight: 500 }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: colors.border }} />
        </div>

        {/* URL input */}
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            placeholder="Paste paper URL (arXiv, PubMed, any PDF link)..."
            disabled={loadingState}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: colors.cornerRadiusSm,
              border: `1px solid ${error ? colors.destructive : colors.border}`,
              fontSize: '15px',
              color: colors.textPrimary,
              background: colors.surface,
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box',
              marginBottom: '8px',
            }}
            onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = colors.accent; }}
            onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = colors.border; }}
          />
          {detectedSource && !error && (
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: colors.accentSecondary, fontWeight: 500 }}>
              {detectedSource}
            </p>
          )}
          {error && (
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: colors.destructive, fontWeight: 500 }}>
              {error}
            </p>
          )}
          {!detectedSource && !error && <div style={{ height: '24px' }} />}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loadingState}
              style={{
                padding: '12px 24px',
                borderRadius: colors.cornerRadiusSm,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.textSecondary,
                fontSize: '14px',
                fontWeight: 500,
                cursor: loadingState ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loadingState || !url.trim()}
              style={{
                padding: '12px 28px',
                borderRadius: colors.cornerRadiusSm,
                border: 'none',
                background: loadingState || !url.trim() ? `${colors.accent}88` : colors.accent,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loadingState || !url.trim() ? 'not-allowed' : 'pointer',
                minWidth: '140px',
              }}
            >
              {loadingState ? 'Processing...' : 'Add Paper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
