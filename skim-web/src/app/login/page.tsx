'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  getToken, setToken, setUser,
  checkEmail, signIn, signUp, joinWaitlist,
  verifyAccessCode, forgotPassword, resetPassword,
} from '@/lib/api';
import type { AuthResponse } from '@/lib/api';

type Step =
  | 'email'
  | 'signin'
  | 'create-account'
  | 'waitlist'
  | 'access-code'
  | 'forgot-password'
  | 'reset-password';

const colors = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  accent: '#C75B38',
  accentHover: '#B54E2E',
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
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // PIN input state
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pinLength, setPinLength] = useState(5);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  function goTo(next: Step, dir: 'forward' | 'back' = 'forward') {
    setDirection(dir);
    setError('');
    setPassword('');
    setPinDigits(Array(next === 'forgot-password' || next === 'reset-password' ? 6 : 5).fill(''));
    setPinLength(next === 'forgot-password' ? 6 : 5);
    setStep(next);
  }

  function handleAuth(res: AuthResponse) {
    setToken(res.token);
    setUser(res.user);
    router.push('/dashboard');
  }

  // ── Step 1: Email ──
  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { status } = await checkEmail(email.trim().toLowerCase());
      if (status === 'registered') goTo('signin');
      else if (status === 'invited') goTo('create-account');
      else {
        // Auto join waitlist
        await joinWaitlist(email.trim().toLowerCase());
        goTo('waitlist');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2a: Sign In ──
  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setError('');
    setLoading(true);
    try {
      const res = await signIn(email, password);
      handleAuth(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2b: Create Account ──
  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await signUp(email, password, accessCode || undefined);
      handleAuth(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Account creation failed');
    } finally {
      setLoading(false);
    }
  }

  // ── PIN input handler ──
  function handlePinChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);

    if (digit && index < pinLength - 1) {
      pinRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    const complete = next.every((d) => d !== '');
    if (complete) {
      const code = next.join('');
      if (step === 'access-code') submitAccessCode(code);
      if (step === 'forgot-password') {
        setAccessCode(code);
        goTo('reset-password');
      }
    }
  }

  function handlePinKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  }

  // ── Access code verification ──
  async function submitAccessCode(code: string) {
    setError('');
    setLoading(true);
    try {
      const res = await verifyAccessCode(code);
      if (res.valid) {
        setAccessCode(code);
        if (res.email) setEmail(res.email);
        goTo('create-account');
      } else {
        setError('Invalid access code');
        setPinDigits(Array(pinLength).fill(''));
        pinRefs.current[0]?.focus();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid access code');
      setPinDigits(Array(pinLength).fill(''));
      pinRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ──
  async function handleForgotPassword() {
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      goTo('forgot-password');
    } catch {
      goTo('forgot-password');
    } finally {
      setLoading(false);
    }
  }

  // ── Reset password ──
  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email, accessCode, password);
      // Auto sign in
      const res = await signIn(email, password);
      handleAuth(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  // ── PIN input UI ──
  function renderPinInput() {
    return (
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '24px 0' }}>
        {Array.from({ length: pinLength }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { pinRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={pinDigits[i] || ''}
            onChange={(e) => handlePinChange(i, e.target.value)}
            onKeyDown={(e) => handlePinKeyDown(i, e)}
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

  // ── Render steps ──

  function renderContent() {
    switch (step) {
      case 'email':
        return (
          <form onSubmit={handleEmailSubmit}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Welcome to skim
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '15px', textAlign: 'center', marginBottom: '28px' }}>
              Research, distilled.
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
            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: colors.textTertiary }}>
              <button
                type="button"
                onClick={() => goTo('access-code')}
                style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Have an access code?
              </button>
            </p>
          </form>
        );

      case 'signin':
        return (
          <form onSubmit={handleSignIn}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Welcome back
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>
              {email}
            </p>
            {error && <ErrorBanner message={error} />}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                className="input"
                style={{ width: '100%', padding: '14px 16px', fontSize: '15px' }}
              />
            </div>
            <PrimaryButton loading={loading} text="Sign In" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <BackLink onClick={() => goTo('email', 'back')} />
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        );

      case 'create-account':
        return (
          <form onSubmit={handleCreateAccount}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              You&apos;re in!
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>
              Create a password for {email}
            </p>
            {error && <ErrorBanner message={error} />}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                placeholder="Create a password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
                className="input"
                style={{ width: '100%', padding: '14px 16px', fontSize: '15px' }}
              />
              <span style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '4px', display: 'block' }}>
                Must be at least 8 characters
              </span>
            </div>
            <PrimaryButton loading={loading} text="Create Account" />
            <div style={{ marginTop: '16px' }}>
              <BackLink onClick={() => goTo('email', 'back')} />
            </div>
          </form>
        );

      case 'waitlist':
        return (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: `${colors.accentSecondary}14`, display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.accentSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              You&apos;re on the waitlist!
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '15px', lineHeight: 1.5, marginBottom: '28px' }}>
              We&apos;ll send you an access code at <strong>{email}</strong> when it&apos;s your turn.
            </p>
            <BackLink onClick={() => goTo('email', 'back')} />
          </div>
        );

      case 'access-code':
        return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Enter access code
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '14px', textAlign: 'center', marginBottom: '8px' }}>
              Enter the 5-digit code you received
            </p>
            {error && <ErrorBanner message={error} />}
            {renderPinInput()}
            {loading && (
              <p style={{ textAlign: 'center', fontSize: '14px', color: colors.textTertiary }}>Verifying...</p>
            )}
            <div style={{ marginTop: '16px' }}>
              <BackLink onClick={() => goTo('email', 'back')} />
            </div>
          </div>
        );

      case 'forgot-password':
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
            <div style={{ marginTop: '16px' }}>
              <BackLink onClick={() => goTo('signin', 'back')} />
            </div>
          </div>
        );

      case 'reset-password':
        return (
          <form onSubmit={handleResetPassword}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
              Create new password
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>
              {email}
            </p>
            {error && <ErrorBanner message={error} />}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
                className="input"
                style={{ width: '100%', padding: '14px 16px', fontSize: '15px' }}
              />
            </div>
            <PrimaryButton loading={loading} text="Reset Password" />
            <div style={{ marginTop: '16px' }}>
              <BackLink onClick={() => goTo('signin', 'back')} />
            </div>
          </form>
        );
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px', background: colors.background,
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a href="/" style={{
            fontFamily: "'Linndale Square NF', Georgia, serif",
            fontSize: '2.5rem', fontWeight: 400, color: colors.accent,
            letterSpacing: '-0.02em', textDecoration: 'none',
          }}>
            skim
          </a>
        </div>

        {/* Card */}
        <div
          className="card"
          style={{
            padding: '32px',
            animation: direction === 'forward'
              ? 'slideInRight 0.25s ease' : 'slideInLeft 0.25s ease',
          }}
          key={step}
        >
          {renderContent()}
        </div>

        <style>{`
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-20px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function PrimaryButton({ loading, text }: { loading: boolean; text: string }) {
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={loading}
      style={{ width: '100%', padding: '14px', fontSize: '15px' }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <span className="spinner" /> {text === 'Continue' ? 'Checking...' : `${text}...`}
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
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', color: '#9E9E99',
        cursor: 'pointer', fontSize: '13px', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: '4px',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Use a different email
    </button>
  );
}
