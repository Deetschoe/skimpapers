'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Linndale Square NF', Georgia, serif",
            fontSize: 'clamp(3.5rem, 10vw, 6rem)',
            fontWeight: 400,
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}
        >
          skim
        </h1>
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            color: 'var(--text-secondary)',
            fontWeight: 400,
            marginBottom: '48px',
          }}
        >
          research distilled all in one app
        </p>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/login" className="btn btn-primary btn-lg">
            Get Started
          </a>
          <a href="/login" className="btn btn-ghost btn-lg">
            Sign In
          </a>
        </div>
      </header>

      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <a
          href="https://github.com/Deetschoe/skimpapers"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
        >
          we&apos;re open source
        </a>
        <span style={{ margin: '0 12px', color: 'var(--border)' }}>|</span>
        <a
          href="mailto:dieter@serenidad.app"
          style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
        >
          need support? dieter@serenidad.app
        </a>
      </footer>
    </div>
  );
}
