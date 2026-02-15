'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Paper, Annotation, getToken, get, post } from '@/lib/api';
import AiChat from '@/components/AiChat';

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
  ratingGreen: '#38A666',
  ratingYellow: '#D1A626',
  ratingRed: '#D94032',
  cornerRadius: '14px',
  cornerRadiusSm: '8px',
};

type TabName = 'summary' | 'fullpaper' | 'annotations';

function getRatingColor(rating: number): string {
  if (rating >= 7) return colors.ratingGreen;
  if (rating >= 5) return colors.ratingYellow;
  return colors.ratingRed;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Renders markdown content to HTML.
 * Supports headings, bold, italic, inline code, lists, and paragraphs.
 */
function renderMarkdown(md: string): string {
  if (!md) return '';

  let html = md;

  // Escape HTML entities first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings (must be at start of line)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // List items (unordered)
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs from double newlines (for remaining text not in h/ul)
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // If already wrapped in a block element, leave it
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<pre')
      ) {
        return trimmed;
      }
      // Replace single newlines with <br>
      return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
    })
    .join('\n');

  return html;
}

export default function PaperPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('summary');
  const [chatOpen, setChatOpen] = useState(false);

  // Annotation form state
  const [annotationNote, setAnnotationNote] = useState('');
  const [annotationLoading, setAnnotationLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (!getToken()) {
      router.replace('/signin');
    }
  }, [router]);

  // Fetch paper
  const fetchPaper = useCallback(async () => {
    try {
      setLoading(true);
      const data = await get<Paper>(`/papers/${paperId}`);
      setPaper(data);
    } catch {
      // API client handles 401
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  // Fetch annotations
  const fetchAnnotations = useCallback(async () => {
    try {
      const data = await get<Annotation[]>(`/papers/${paperId}/annotations`);
      setAnnotations(data);
    } catch {
      // Silently fail
    }
  }, [paperId]);

  useEffect(() => {
    if (getToken() && paperId) {
      fetchPaper();
      fetchAnnotations();
    }
  }, [paperId, fetchPaper, fetchAnnotations]);

  // Submit annotation
  async function handleAnnotationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!annotationNote.trim()) return;
    setAnnotationLoading(true);
    try {
      await post(`/papers/${paperId}/annotations`, {
        note: annotationNote.trim(),
      });
      setAnnotationNote('');
      await fetchAnnotations();
    } catch {
      // Silently fail
    } finally {
      setAnnotationLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textTertiary,
          fontSize: '15px',
        }}
      >
        Loading paper...
      </div>
    );
  }

  if (!paper) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary,
          fontSize: '15px',
        }}
      >
        Paper not found
      </div>
    );
  }

  const ratingColor = getRatingColor(paper.rating);

  const tabs: { key: TabName; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'fullpaper', label: 'Full Paper' },
    { key: 'annotations', label: 'Annotations' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      {/* Top bar */}
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Back button */}
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              transition: 'background 0.15s ease',
              flexShrink: 0,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceElevated;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          {/* Paper title */}
          <h1
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: colors.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {paper.title}
          </h1>
        </div>

        {/* Ask AI button */}
        <button
          onClick={() => setChatOpen(true)}
          style={{
            padding: '8px 20px',
            borderRadius: '24px',
            border: 'none',
            background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentSecondary})`,
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.1s ease, box-shadow 0.15s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: '16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(199,91,56,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Ask AI
        </button>
      </header>

      {/* Tab row */}
      <div
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          padding: '0 24px',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 24px',
                background: 'none',
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${colors.accent}`
                  : '2px solid transparent',
                color: isActive ? colors.accent : colors.textSecondary,
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = colors.accent;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = colors.textSecondary;
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* ── Summary Tab ── */}
        {activeTab === 'summary' && (
          <div style={{ animation: 'tabFadeIn 0.3s ease' }}>
            <style>{`
              @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* Title */}
            <h1
              style={{
                margin: '0 0 20px 0',
                fontSize: '28px',
                fontWeight: 700,
                color: colors.textPrimary,
                lineHeight: 1.35,
              }}
            >
              {paper.title}
            </h1>

            {/* Meta row: source, category, date */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: 'rgba(77,133,112,0.12)',
                  color: colors.accentSecondary,
                }}
              >
                {paper.source}
              </span>
              <span
                style={{
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: colors.surfaceElevated,
                  color: colors.textSecondary,
                }}
              >
                {paper.category}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: colors.textTertiary,
                }}
              >
                Published {formatDate(paper.publishedDate)}
              </span>
            </div>

            {/* Authors */}
            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '14px',
                color: colors.textSecondary,
                lineHeight: 1.6,
              }}
            >
              {paper.authors.join(', ')}
            </p>

            {/* Rating circle + Tags row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '32px',
                flexWrap: 'wrap',
              }}
            >
              {/* Rating circle */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: `${ratingColor}18`,
                  border: `2px solid ${ratingColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: ratingColor,
                  }}
                >
                  {paper.rating}
                </span>
              </div>

              {/* Tags */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                {paper.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: 'rgba(199,91,56,0.1)',
                      color: colors.accent,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: '1px',
                background: colors.border,
                marginBottom: '28px',
              }}
            />

            {/* AI Summary */}
            <div
              style={{
                fontSize: '15px',
                lineHeight: 1.8,
                color: colors.textPrimary,
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(paper.summary) }}
            />
          </div>
        )}

        {/* ── Full Paper Tab ── */}
        {activeTab === 'fullpaper' && (
          <div style={{ animation: 'tabFadeIn 0.3s ease' }}>
            <style>{`
              @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {paper.markdownContent ? (
              <div
                style={{
                  maxWidth: '800px',
                  margin: '0 auto',
                  fontSize: '16px',
                  lineHeight: 1.8,
                  color: colors.textPrimary,
                }}
              >
                <style>{`
                  .paper-content h1 {
                    font-size: 26px;
                    font-weight: 700;
                    margin: 32px 0 16px 0;
                    color: ${colors.textPrimary};
                    line-height: 1.3;
                  }
                  .paper-content h2 {
                    font-size: 22px;
                    font-weight: 600;
                    margin: 28px 0 14px 0;
                    color: ${colors.textPrimary};
                    line-height: 1.3;
                  }
                  .paper-content h3 {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 24px 0 12px 0;
                    color: ${colors.textPrimary};
                    line-height: 1.4;
                  }
                  .paper-content p {
                    margin: 0 0 16px 0;
                  }
                  .paper-content ul {
                    margin: 0 0 16px 0;
                    padding-left: 24px;
                  }
                  .paper-content li {
                    margin-bottom: 8px;
                  }
                  .paper-content strong {
                    font-weight: 600;
                    color: ${colors.textPrimary};
                  }
                  .paper-content em {
                    font-style: italic;
                  }
                  .paper-content code {
                    background: ${colors.surfaceElevated};
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                  }
                `}</style>
                <div
                  className="paper-content"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(paper.markdownContent),
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '80px 0',
                  color: colors.textTertiary,
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>&#128196;</div>
                <p
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '16px',
                    color: colors.textSecondary,
                  }}
                >
                  Full paper content not available
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: colors.textTertiary }}>
                  The full text could not be extracted from this paper.
                </p>
                {paper.pdfUrl && (
                  <a
                    href={paper.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '20px',
                      padding: '10px 24px',
                      borderRadius: colors.cornerRadiusSm,
                      background: colors.accent,
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#B54E2F';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.accent;
                    }}
                  >
                    View PDF
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Annotations Tab ── */}
        {activeTab === 'annotations' && (
          <div style={{ animation: 'tabFadeIn 0.3s ease' }}>
            <style>{`
              @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* Annotations list */}
            {annotations.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 0 40px',
                  color: colors.textTertiary,
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>&#9998;</div>
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '15px',
                    color: colors.textSecondary,
                  }}
                >
                  No annotations yet
                </p>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  Ask a question about this paper below.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  marginBottom: '32px',
                }}
              >
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    style={{
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: colors.cornerRadius,
                      padding: '20px',
                    }}
                  >
                    {/* Selected text quote */}
                    {ann.selectedText && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderLeft: `3px solid ${colors.accentSecondary}`,
                          background: 'rgba(77,133,112,0.06)',
                          borderRadius: `0 ${colors.cornerRadiusSm} ${colors.cornerRadiusSm} 0`,
                          marginBottom: '14px',
                          fontSize: '13px',
                          color: colors.textSecondary,
                          lineHeight: 1.6,
                          fontStyle: 'italic',
                        }}
                      >
                        {ann.selectedText}
                      </div>
                    )}

                    {/* Note / question */}
                    {ann.note && (
                      <p
                        style={{
                          margin: '0 0 14px 0',
                          fontSize: '14px',
                          color: colors.textPrimary,
                          lineHeight: 1.6,
                          fontWeight: 500,
                        }}
                      >
                        {ann.note}
                      </p>
                    )}

                    {/* AI response */}
                    {ann.aiResponse && (
                      <div
                        style={{
                          padding: '14px 16px',
                          background: colors.surfaceElevated,
                          borderRadius: colors.cornerRadiusSm,
                          fontSize: '14px',
                          color: colors.textPrimary,
                          lineHeight: 1.7,
                          marginBottom: '10px',
                        }}
                      >
                        {ann.aiResponse}
                      </div>
                    )}

                    {/* Date */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: colors.textTertiary,
                      }}
                    >
                      {formatDate(ann.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Add annotation form */}
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: colors.cornerRadius,
                padding: '20px',
              }}
            >
              <form onSubmit={handleAnnotationSubmit}>
                <textarea
                  value={annotationNote}
                  onChange={(e) => setAnnotationNote(e.target.value)}
                  placeholder="Ask a question about this paper or add a note..."
                  disabled={annotationLoading}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: colors.cornerRadiusSm,
                    border: `1px solid ${colors.border}`,
                    fontSize: '14px',
                    color: colors.textPrimary,
                    background: colors.background,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    transition: 'border-color 0.2s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '12px',
                  }}
                >
                  <button
                    type="submit"
                    disabled={annotationLoading || !annotationNote.trim()}
                    style={{
                      padding: '10px 24px',
                      borderRadius: colors.cornerRadiusSm,
                      border: 'none',
                      background:
                        annotationLoading || !annotationNote.trim()
                          ? `${colors.accent}88`
                          : colors.accent,
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor:
                        annotationLoading || !annotationNote.trim()
                          ? 'not-allowed'
                          : 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!annotationLoading && annotationNote.trim()) {
                        e.currentTarget.style.background = '#B54E2F';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!annotationLoading && annotationNote.trim()) {
                        e.currentTarget.style.background = colors.accent;
                      }
                    }}
                  >
                    {annotationLoading ? 'Submitting...' : 'Ask AI'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* AI Chat sidebar */}
      <AiChat
        paperId={paperId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
