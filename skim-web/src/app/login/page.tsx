'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  getToken, setToken, setUser,
  checkEmail, requestCode, verifyCode,
} from '@/lib/api';
import type { AuthResponse } from '@/lib/api';

type Step = 'email' | 'access-code' | 'verify-code';

const colors = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  accent: '#C75B38',
  accentSecondary: '#4D8570',
  textPrimary: '#1A1A1A',
  textSecondary: '#5C5C58',
  textTertiary: '#9E9E99',
  destructive: '#C0392B',
  border: '#E0DFDA',
};

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // PIN input
  const [pinDigits, setPinDigits] = useState<string[]>(Array(6).fill(''));
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  function goTo(next: Step, dir: 'forward' | 'back' = 'forward') {
    setDirection(dir);
    setError('');
    setPinDigits(Array(6).fill(''));
    setStep(next);
  }

  function handleAuth(res: AuthResponse) {
    setToken(res.token);
    setUser(res.user);
    router.push('/dashboard');
  }

  // Step 1: Email
  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { exists } = await checkEmail(email.trim().toLowerCase());
      if (exists) {
        setIsNewUser(false);
        await requestCode(email.trim().toLowerCase());
        goTo('verify-code');
      } else {
        setIsNewUser(true);
        goTo('access-code');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // Step 1b: Access code (new users)
  async function handleAccessCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessCodeInput.trim()) return;
    setError('');
    setLoading(true);
    try {
      await requestCode(email.trim().toLowerCase(), accessCodeInput.trim());
      goTo('verify-code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid access code');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify 6-digit code
  async function handleVerify(code: string) {
    setError('');
    setLoading(true);
    try {
      const res = await verifyCode(email.trim().toLowerCase(), code);
      handleAuth(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setPinDigits(Array(6).fill(''));
      pinRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // Resend code
  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      await requestCode(email.trim().toLowerCase(), isNewUser ? accessCodeInput.trim() : undefined);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setLoading(false);
    }
  }

  // PIN input handlers
  function handlePinChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);

    if (digit && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== '')) {
      handleVerify(next.join(''));
    }
  }

  function handlePinKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  }

  function handlePinPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const digits = pasted.split('');
      setPinDigits(digits);
      pinRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  }

  function renderPinInput() {
    return (
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '24px 0' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { pinRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={pinDigits[i] || ''}
            onChange={(e) => handlePinChange(i, e.target.value)}
            onKeyDown={(e) => handlePinKeyDown(i, e)}
            onPaste={i === 0 ? handlePinPaste : undefined}
            autoFocus={i === 0}
            style={{
              width: '48px',
              height: '56px',
              textAlign: 'center',
              fontSize: '22px',
              fontWeight: 600,
              border: `1.5px solid ${pinDigits[i] ? colors.accent : colors.border}`,
              borderRadius: '10px',
              outline: 'none',
              color: colors.textPrimary,
              background: colors.surface,
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}18`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = pinDigits[i] ? colors.accent : colors.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        ))}
      </div>
    );
  }

  function renderContent() {
    switch (step) {
      case 'email':
        return (
          <form onSubmit={handleEmailSubmit}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Welcome to skim
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '15px', textAlign: 'center', marginBottom: '28px' }}>
              Enter your email to continue
            </p>
            {error && <ErrorBanner message={error} />}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="input"
                style={{ width: '100%', padding: '14px 16px', fontSize: '15px' }}
              />
            </div>
            <PrimaryButton loading={loading} text="Continue" />
          </form>
        );

      case 'access-code':
        return (
          <form onSubmit={handleAccessCodeSubmit}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Access code required
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>
              Enter the invite code to get started
            </p>
            {error && <ErrorBanner message={error} />}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Invite code"
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                className="input"
                style={{ width: '100%', padding: '14px 16px', fontSize: '15px' }}
              />
            </div>
            <PrimaryButton loading={loading} text="Continue" />
            <div style={{ marginTop: '16px' }}>
              <BackLink onClick={() => goTo('email', 'back')} />
            </div>
          </form>
        );

      case 'verify-code':
        return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Check your email
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '14px', textAlign: 'center', marginBottom: '8px' }}>
              We sent a 6-digit code to {email}
            </p>
            {error && <ErrorBanner message={error} />}
            {renderPinInput()}
            {loading && (
              <p style={{ textAlign: 'center', fontSize: '14px', color: colors.textTertiary }}>Verifying...</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <BackLink onClick={() => goTo('email', 'back')} />
              <button
                type="button"
                onClick={handleResend}
                style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                Resend code
              </button>
            </div>
          </div>
        );
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px', background: colors.background,
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a href="/" style={{
            fontFamily: "'Linndale Square NF', Georgia, serif",
            fontSize: '2.5rem', fontWeight: 400, color: colors.accent,
            letterSpacing: '-0.02em', textDecoration: 'none',
          }}>
            skim
          </a>
        </div>

        <div
          className="card"
          style={{ padding: '32px', animation: direction === 'forward' ? 'slideInRight 0.25s ease' : 'slideInLeft 0.25s ease' }}
          key={step}
        >
          {renderContent()}
        </div>

        <style>{`
          @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        `}</style>
      </div>
    </div>
  );
}

function PrimaryButton({ loading, text }: { loading: boolean; text: string }) {
  return (
    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <span className="spinner" /> {text}...
        </span>
      ) : text}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'none', border: 'none', color: '#9E9E99', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: '4px',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}
