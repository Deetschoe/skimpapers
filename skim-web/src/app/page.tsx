'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

const features = [
  {
    icon: '\u2728',
    title: 'AI-Powered Summaries',
    description:
      'Claude analyzes every paper you add, extracting key findings, methods, and contributions into clear, readable summaries.',
  },
  {
    icon: '\uD83C\uDFAF',
    title: 'Smart Ratings',
    description:
      'Each paper receives a 1\u201310 quality score based on methodology, novelty, and impact to help you prioritize what to read.',
  },
  {
    icon: '\uD83D\uDCC2',
    title: 'Organize & Collect',
    description:
      'Create custom collections to group related papers. Tag, filter, and find exactly what you need in seconds.',
  },
  {
    icon: '\uD83D\uDD04',
    title: 'Sync Everywhere',
    description:
      'Access your library from the iOS app or the web. Your papers, annotations, and collections stay in sync.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 24px 80px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Linndale Square NF', Georgia, serif",
            fontSize: 'clamp(3rem, 8vw, 5rem)',
            fontWeight: 400,
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
            marginBottom: '12px',
          }}
        >
          skim
        </h1>
        <p
          style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            color: 'var(--text-secondary)',
            fontWeight: 400,
            marginBottom: '48px',
          }}
        >
          Research, distilled.
        </p>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/signup" className="btn btn-primary btn-lg">
            Get Started
          </a>
          <a href="/signin" className="btn btn-ghost btn-lg">
            Sign In
          </a>
        </div>
      </header>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '0 24px 120px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '28px 24px',
              }}
            >
              <span style={{ fontSize: '32px', lineHeight: 1 }}>{f.icon}</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          borderTop: '1px solid var(--border)',
        }}
      >
        skim &mdash; Your AI research companion
      </footer>
    </div>
  );
}
