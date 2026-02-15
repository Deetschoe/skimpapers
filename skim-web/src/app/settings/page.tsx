'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import API, { getToken, getUser, clearToken } from '@/lib/api';
import type { UsageInfo } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const user = typeof window !== 'undefined' ? getUser() : null;

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) {
      router.replace('/signin');
    }
  }, [router]);

  // ── Fetch usage ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) return;
    (async () => {
      try {
        const data = await API.get<UsageInfo>('/papers/usage');
        setUsage(data);
      } catch {
        // Usage not critical; silently fail
      } finally {
        setLoadingUsage(false);
      }
    })();
  }, []);

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    clearToken();
    router.replace('/signin');
  };

  // ── Format date ─────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (typeof window !== 'undefined' && !getToken()) return null;

  // ── Shared row style ───────────────────────────────────────────────────────
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: '15px',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontWeight: 400,
  };

  const valueStyle: React.CSSProperties = {
    color: 'var(--text-primary)',
    fontWeight: 500,
    textAlign: 'right',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
    marginBottom: '4px',
    marginTop: '36px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          className="btn-icon"
          onClick={() => router.push('/dashboard')}
          aria-label="Back to dashboard"
          style={{ fontSize: '20px', marginRight: '16px' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Settings</h2>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '8px 24px 64px' }}>
        {/* ── Profile section ─────────────────────────────────────────── */}
        <p style={sectionHeaderStyle}>Profile</p>
        <div style={rowStyle}>
          <span style={labelStyle}>Email</span>
          <span style={valueStyle}>{user?.email || '---'}</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Member since</span>
          <span style={valueStyle}>{formatDate(user?.createdAt)}</span>
        </div>

        {/* ── Usage section ───────────────────────────────────────────── */}
        <p style={sectionHeaderStyle}>Usage</p>
        {loadingUsage ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <span className="spinner" />
          </div>
        ) : (
          <>
            <div style={rowStyle}>
              <span style={labelStyle}>Papers saved</span>
              <span style={valueStyle}>
                {usage?.totalPapers != null ? usage.totalPapers.toLocaleString() : '---'}
              </span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>AI queries</span>
              <span style={valueStyle}>
                {usage?.totalQueries != null ? usage.totalQueries.toLocaleString() : '---'}
              </span>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Monthly cost</span>
              <span style={valueStyle}>
                {usage?.monthlyCost != null
                  ? `$${usage.monthlyCost.toFixed(4)}`
                  : '---'}
              </span>
            </div>
          </>
        )}

        {/* ── Account section ─────────────────────────────────────────── */}
        <p style={sectionHeaderStyle}>Account</p>
        <div style={{ paddingTop: '16px' }}>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '14px',
              background: 'transparent',
              border: '1px solid var(--destructive)',
              borderRadius: 'var(--corner-radius-sm)',
              color: 'var(--destructive)',
              fontSize: '15px',
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--destructive)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--destructive)';
            }}
          >
            Sign Out
          </button>
        </div>
      </main>
    </div>
  );
}
