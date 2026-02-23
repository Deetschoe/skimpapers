'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Paper, getToken, get, post } from '@/lib/api';

const colors = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F3EE',
  accent: '#C75B38',
  accentSecondary: '#4D8570',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#9E9E99',
  border: '#E0DFDA',
  cornerRadius: '14px',
  cornerRadiusSm: '8px',
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

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      // If paper has a summary, show it as the first assistant message
      if (data.summary) {
        setMessages([{ role: 'assistant', content: data.summary }]);
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
  }, [paperId, fetchPaper]);

  // Scroll chat to bottom when messages change
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

  const pdfSrc = `/api/papers/${paperId}/pdf`;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: colors.background }}>
      {/* Top bar */}
      <header
        style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '0 20px',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexShrink: 0,
        }}
      >
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
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            transition: 'background 0.15s',
            padding: 0,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceElevated; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: '14px',
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

        {paper.authors.length > 0 && (
          <span
            style={{
              fontSize: '12px',
              color: colors.textTertiary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '300px',
              flexShrink: 1,
            }}
          >
            {paper.authors.length <= 2 ? paper.authors.join(' & ') : `${paper.authors[0]} et al.`}
          </span>
        )}
      </header>

      {/* Split view */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: PDF viewer */}
        <div style={{ flex: '1 1 60%', minWidth: 0, background: '#525659' }}>
          <iframe
            src={pdfSrc}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="PDF viewer"
          />
        </div>

        {/* Right: Chat panel */}
        <div
          style={{
            width: '380px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: `1px solid ${colors.border}`,
            background: colors.surface,
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>
              Chat
            </span>
            {paper.category && (
              <span
                style={{
                  fontSize: '11px',
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
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 16px',
                  color: colors.textTertiary,
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                Ask a question about this paper
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
                  }}
                >
                  Thinking...
                </div>
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
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                fontSize: '13px',
                color: colors.textPrimary,
                background: colors.background,
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = colors.accent; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: chatLoading || !chatInput.trim() ? `${colors.accent}66` : colors.accent,
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
