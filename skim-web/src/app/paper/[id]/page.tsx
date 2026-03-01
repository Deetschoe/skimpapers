'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Paper, getToken, get, post, fetchBlob } from '@/lib/api';

const colors = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F3EE',
  accent: '#C75B38',
  accentHover: '#B54E2E',
  accentSecondary: '#4D8570',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#9E9E99',
  border: '#E0DFDA',
  pdfBackground: '#4A4A4A',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function PaperPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Panel state
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  const fetchPaper = useCallback(async () => {
    try {
      setLoading(true);
      const data = await get<Paper>(`/papers/${paperId}`);
      setPaper(data);
      if (data.summary) {
        setMessages([{ role: 'assistant', content: data.summary }]);
      }
      try {
        const blob = await fetchBlob(`/papers/${paperId}/pdf`);
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      } catch {
        console.warn('Could not load PDF for paper', paperId);
      }
    } catch {
      // API client handles 401
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    if (getToken() && paperId) {
      fetchPaper();
    }
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [paperId, fetchPaper]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await post<{ response: string }>(`/papers/${paperId}/chat`, {
        messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...updatedMessages, { role: 'assistant', content: res.response }]);
    } catch {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // Format authors for display
  function formatAuthors(authors: string[]): string {
    if (authors.length === 0) return '';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return authors.join(' & ');
    return `${authors[0]} et al.`;
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
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: `2px solid ${colors.border}`,
            borderTopColor: colors.accent,
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
        <span style={{ color: colors.textTertiary, fontSize: '14px' }}>
          Loading paper...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ color: colors.textSecondary, fontSize: '15px' }}>
          Paper not found
        </span>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            marginTop: '8px',
            padding: '8px 20px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.textPrimary,
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: colors.pdfBackground }}>
      {/* ── Minimal top bar ──────────────────────────────────────────── */}
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '0 16px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          zIndex: 10,
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
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            transition: 'all 0.15s',
            padding: 0,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.surfaceElevated;
            e.currentTarget.style.color = colors.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = colors.textSecondary;
          }}
          title="Back to library"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        {/* Separator */}
        <div style={{ width: '1px', height: '20px', background: colors.border, flexShrink: 0 }} />

        {/* Paper title and authors */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '1.3',
            }}
            title={paper.title}
          >
            {paper.title}
          </h1>
          {paper.authors.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: colors.textTertiary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: '1.3',
              }}
            >
              {formatAuthors(paper.authors)}
            </span>
          )}
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {/* Source badge */}
          {paper.source && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(77, 133, 112, 0.1)',
                color: colors.accentSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              {paper.source}
            </span>
          )}

          {/* Rating badge */}
          {paper.rating > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px',
                background: paper.rating >= 7
                  ? 'rgba(56, 166, 102, 0.1)'
                  : paper.rating >= 4
                  ? 'rgba(209, 166, 38, 0.1)'
                  : 'rgba(217, 64, 50, 0.1)',
                color: paper.rating >= 7
                  ? '#38A666'
                  : paper.rating >= 4
                  ? '#D1A626'
                  : '#D94032',
              }}
            >
              {paper.rating}/10
            </span>
          )}

          {/* Open original link */}
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                color: colors.textTertiary,
                transition: 'all 0.15s',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceElevated;
                e.currentTarget.style.color = colors.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = colors.textTertiary;
              }}
              title="Open original paper"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}

          {/* Separator */}
          <div style={{ width: '1px', height: '20px', background: colors.border, margin: '0 4px' }} />

          {/* Chat toggle */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: `1px solid ${chatOpen ? colors.accent : colors.border}`,
              background: chatOpen ? 'rgba(199, 91, 56, 0.06)' : 'transparent',
              color: chatOpen ? colors.accent : colors.textSecondary,
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!chatOpen) {
                e.currentTarget.style.background = colors.surfaceElevated;
                e.currentTarget.style.borderColor = colors.textTertiary;
              }
            }}
            onMouseLeave={(e) => {
              if (!chatOpen) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = colors.border;
              }
            }}
            title={chatOpen ? 'Hide chat panel' : 'Show chat panel'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </button>
        </div>
      </header>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* PDF viewer */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: colors.pdfBackground,
            position: 'relative',
          }}
        >
          {pdfBlobUrl ? (
            <iframe
              src={`${pdfBlobUrl}#toolbar=0`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
              title="PDF viewer"
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                PDF not available for this paper
              </span>
              {paper.url && (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: '4px',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }}
                >
                  View on {paper.source || 'source'}
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Chat panel (collapsible) ───────────────────────────────── */}
        <div
          style={{
            width: chatOpen ? '380px' : '0px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: chatOpen ? `1px solid ${colors.border}` : 'none',
            background: colors.surface,
            transition: 'width 0.25s ease',
            overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '380px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
              Ask about this paper
            </span>
            {paper.category && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: colors.surfaceElevated,
                  color: colors.textTertiary,
                  marginLeft: 'auto',
                }}
              >
                {paper.category}
              </span>
            )}
            <button
              onClick={() => setChatOpen(false)}
              style={{
                marginLeft: paper.category ? '0' : 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.textTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                transition: 'all 0.15s',
                padding: 0,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceElevated;
                e.currentTarget.style.color = colors.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = colors.textTertiary;
              }}
              title="Close chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minWidth: '380px',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  color: colors.textTertiary,
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.textTertiary}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: '12px', opacity: 0.5 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>Ask a question about this paper</div>
                <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.7 }}>
                  AI has full context of the paper content
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                }}
              >
                {msg.role === 'assistant' && i === 0 && messages.length > 0 && (
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.5px',
                    color: colors.textTertiary,
                    marginBottom: '4px',
                    paddingLeft: '2px',
                  }}>
                    Summary
                  </div>
                )}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user' ? colors.accent : colors.surfaceElevated,
                    color: msg.role === 'user' ? '#FFFFFF' : colors.textPrimary,
                    fontSize: '13px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '90%' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '14px 14px 14px 4px',
                    background: colors.surfaceElevated,
                    color: colors.textTertiary,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      border: `1.5px solid ${colors.border}`,
                      borderTopColor: colors.accent,
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                  Thinking...
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <form
            onSubmit={handleChatSubmit}
            style={{
              padding: '12px 16px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              gap: '8px',
              minWidth: '380px',
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about this paper..."
              disabled={chatLoading}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                fontSize: '13px',
                color: colors.textPrimary,
                background: colors.background,
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(199, 91, 56, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: 'none',
                background: chatLoading || !chatInput.trim() ? `${colors.accent}44` : colors.accent,
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!chatLoading && chatInput.trim()) {
                  e.currentTarget.style.background = colors.accentHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!chatLoading && chatInput.trim()) {
                  e.currentTarget.style.background = colors.accent;
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
