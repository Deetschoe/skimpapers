'use client';

import { useState, useEffect } from 'react';
import { Paper, post } from '@/lib/api';

interface AddPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (paper: Paper) => void;
}

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

function detectSource(url: string): string {
  if (!url) return '';
  const lower = url.toLowerCase();
  if (lower.includes('arxiv.org')) return 'arXiv detected';
  if (lower.includes('pubmed') || lower.includes('ncbi.nlm.nih.gov')) return 'PubMed detected';
  if (lower.includes('doi.org')) return 'DOI link detected';
  if (lower.includes('biorxiv.org')) return 'bioRxiv detected';
  if (lower.includes('medrxiv.org')) return 'medRxiv detected';
  if (lower.includes('nature.com')) return 'Nature detected';
  if (lower.includes('science.org') || lower.includes('sciencemag.org')) return 'Science detected';
  if (lower.includes('ieee.org')) return 'IEEE detected';
  if (lower.includes('springer.com')) return 'Springer detected';
  if (lower.endsWith('.pdf') || lower.includes('.pdf?')) return 'PDF link detected';
  if (url.length > 10) return 'Web link detected';
  return '';
}

export default function AddPaperModal({ isOpen, onClose, onAdded }: AddPaperModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, loading, onClose]);

  const detectedSource = detectSource(url);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const paper = await post<Paper>('/papers', { url: url.trim() });
      onAdded(paper);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add paper';
      setError(message);
    } finally {
      setLoading(false);
    }
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
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
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
          animation: 'slideUp 0.25s ease',
        }}
      >
        <h2
          style={{
            margin: '0 0 24px 0',
            fontSize: '22px',
            fontWeight: 700,
            color: colors.textPrimary,
          }}
        >
          Add Paper
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '8px' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              placeholder="Paste paper URL (arXiv, PubMed, any PDF link)..."
              disabled={loading}
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
              }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = colors.accent;
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = colors.border;
              }}
              autoFocus
            />
          </div>

          {/* Source detection */}
          {detectedSource && !error && (
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '13px',
                color: colors.accentSecondary,
                fontWeight: 500,
              }}
            >
              {detectedSource}
            </p>
          )}

          {/* Error display */}
          {error && (
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '13px',
                color: colors.destructive,
                fontWeight: 500,
              }}
            >
              {error}
            </p>
          )}

          {!detectedSource && !error && <div style={{ height: '32px' }} />}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: colors.cornerRadiusSm,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.textSecondary,
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = colors.surfaceElevated;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surface;
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              style={{
                padding: '12px 28px',
                borderRadius: colors.cornerRadiusSm,
                border: 'none',
                background: loading || !url.trim() ? `${colors.accent}88` : colors.accent,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease, transform 0.1s ease',
                minWidth: '140px',
              }}
              onMouseEnter={(e) => {
                if (!loading && url.trim()) e.currentTarget.style.background = '#B54E2F';
              }}
              onMouseLeave={(e) => {
                if (!loading && url.trim()) e.currentTarget.style.background = colors.accent;
              }}
            >
              {loading ? 'Processing... This may take a moment' : 'Add Paper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
