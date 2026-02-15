'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import API, { getToken } from '@/lib/api';
import type { Collection, Paper } from '@/lib/api';
import CollectionCard from '@/components/CollectionCard';

export default function CollectionsPage() {
  const router = useRouter();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected collection state
  const [selected, setSelected] = useState<Collection | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoading, setPapersLoading] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) {
      router.replace('/signin');
    }
  }, [router]);

  // ── Fetch collections ───────────────────────────────────────────────────────
  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await API.get<Collection[]>('/collections');
      setCollections(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load collections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      fetchCollections();
    }
  }, [fetchCollections]);

  // ── Select a collection ─────────────────────────────────────────────────────
  const handleSelect = async (collection: Collection) => {
    setSelected(collection);
    setPapersLoading(true);
    setPapers([]);
    try {
      const data = await API.get<Paper[]>(`/collections/${collection.id}/papers`);
      setPapers(data);
    } catch {
      setPapers([]);
    } finally {
      setPapersLoading(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setPapers([]);
  };

  // ── Create collection ───────────────────────────────────────────────────────
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await API.post('/collections', { name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      await fetchCollections();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create collection.');
    } finally {
      setCreating(false);
    }
  };

  // ── Delete collection ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await API.del(`/collections/${selected.id}`);
      setSelected(null);
      setPapers([]);
      setShowDeleteConfirm(false);
      await fetchCollections();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete collection.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Rating badge helper ─────────────────────────────────────────────────────
  const ratingClass = (r: number) => {
    if (r >= 7) return 'badge badge-rating badge-rating-high';
    if (r >= 4) return 'badge badge-rating badge-rating-medium';
    return 'badge badge-rating badge-rating-low';
  };

  // ── Auth not ready ──────────────────────────────────────────────────────────
  if (typeof window !== 'undefined' && !getToken()) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn-icon"
            onClick={() => (selected ? handleBack() : router.push('/dashboard'))}
            aria-label="Go back"
            style={{ fontSize: '20px' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {selected ? selected.name : 'Collections'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selected && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </button>
          )}
          {!selected && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              New
            </button>
          )}
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <div className="error-message" style={{ marginBottom: '24px' }}>
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && !selected && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <span className="spinner" />
          </div>
        )}

        {/* ── Collection grid (no collection selected) ───────────────── */}
        {!loading && !selected && (
          <>
            {collections.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">{'\uD83D\uDCC2'}</span>
                <h3>No collections yet</h3>
                <p>Create one to organize your papers.</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '20px' }}
                  onClick={() => setShowCreate(true)}
                >
                  Create Collection
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px',
                }}
              >
                {collections.map((c) => (
                  <CollectionCard key={c.id} collection={c} onClick={handleSelect} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Selected collection papers ──────────────────────────────── */}
        {selected && (
          <>
            {papersLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <span className="spinner" />
              </div>
            ) : papers.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">{'\uD83D\uDCDD'}</span>
                <h3>No papers in this collection</h3>
                <p>Add papers from your library to organize them here.</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {papers.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => router.push(`/paper/${paper.id}`)}
                    className="card card-clickable"
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '20px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--corner-radius)',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'box-shadow 200ms ease, transform 200ms ease',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Header: rating + source */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={ratingClass(paper.rating)}>{paper.rating}/10</span>
                      {paper.source && (
                        <span className="badge badge-source">{paper.source}</span>
                      )}
                    </div>

                    {/* Title */}
                    <h4
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        lineHeight: 1.4,
                        color: 'var(--text-primary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {paper.title}
                    </h4>

                    {/* Authors */}
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {paper.authors?.join(', ') || 'Unknown authors'}
                    </p>

                    {/* Tags */}
                    {paper.tags && paper.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {paper.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '100px',
                              background: 'var(--surface-elevated)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Create collection modal ──────────────────────────────────────── */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
          onClick={() => { setShowCreate(false); setNewName(''); }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--corner-radius)',
              padding: '32px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px' }}>New Collection</h3>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label htmlFor="collection-name">Name</label>
                <input
                  id="collection-name"
                  className="input"
                  type="text"
                  placeholder="e.g. Machine Learning"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowCreate(false); setNewName(''); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !newName.trim()}
                >
                  {creating ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="spinner" /> Creating...
                    </span>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {showDeleteConfirm && selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--corner-radius)',
              padding: '32px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '12px' }}>Delete Collection</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Are you sure you want to delete <strong>&ldquo;{selected.name}&rdquo;</strong>? This
              action cannot be undone. Papers in this collection will not be deleted from your library.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="spinner" /> Deleting...
                  </span>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
