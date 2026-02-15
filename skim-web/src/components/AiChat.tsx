'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { post } from '@/lib/api';

interface AiChatProps {
  paperId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  border: '#E0DFDA',
  cornerRadius: '14px',
  cornerRadiusSm: '8px',
};

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 0' }}>
      <style>{`
        @keyframes pulseDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: colors.textTertiary,
            animation: `pulseDot 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function AiChat({ paperId, isOpen, onClose }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await post<{ response: string }>(`/papers/${paperId}/chat`, {
        messages: updatedMessages,
      });
      const assistantMessage: ChatMessage = { role: 'assistant', content: res.response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Overlay - visible on mobile */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1099,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '440px',
          background: colors.background,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.1)' : 'none',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: colors.surface,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentSecondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            AI Assistant
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              fontSize: '22px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceElevated;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            &times;
          </button>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {messages.length === 0 && !loading && (
            <div
              style={{
                textAlign: 'center',
                color: colors.textTertiary,
                fontSize: '14px',
                marginTop: '40px',
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#9672;</div>
              <p style={{ margin: 0 }}>Ask me anything about this paper.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                I can explain concepts, summarize sections, or answer questions.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'messageIn 0.25s ease',
              }}
            >
              <style>{`
                @keyframes messageIn {
                  from { opacity: 0; transform: translateY(8px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius:
                    msg.role === 'user'
                      ? '14px 14px 4px 14px'
                      : '14px 14px 14px 4px',
                  background:
                    msg.role === 'user' ? colors.accent : colors.surfaceElevated,
                  color: msg.role === 'user' ? '#FFFFFF' : colors.textPrimary,
                  fontSize: '14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '14px 14px 14px 4px',
                  background: colors.surfaceElevated,
                }}
              >
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface,
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this paper..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '24px',
              border: `1px solid ${colors.border}`,
              fontSize: '14px',
              color: colors.textPrimary,
              background: colors.background,
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: 'none',
              background:
                loading || !input.trim() ? `${colors.accent}55` : colors.accent,
              color: '#FFFFFF',
              fontSize: '18px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease, transform 0.1s ease',
              flexShrink: 0,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.background = '#B54E2F';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.background = colors.accent;
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
