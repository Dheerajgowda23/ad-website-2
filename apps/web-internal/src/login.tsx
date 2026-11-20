import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Role } from '@ada/shared';
import { api, ApiError } from './api.js';
import { AuthShell, StepDots, ZoneBadge } from './shell.js';

interface OtpRequestResponse {
  challengeId: string;
  expiresInSeconds: number;
  devCode?: string;
}

interface TotpStageResponse {
  stage: 'TOTP_REQUIRED';
  pendingId: string;
  expiresInSeconds: number;
  devTotpCode?: string;
}

interface SessionResponse {
  user: { id: string; name: string; email: string; role: Role };
  permissions: string[];
}

const errorText = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Something went wrong. Try again.';

/**
 * One login page for every staff role. There is no role selector: the account
 * decides the role, and the server decides what that role may do.
 */
export const LoginPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [otp, setOtp] = useState('');
  const [totp, setTotp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devTotp, setDevTotp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = useMutation({
    mutationFn: () =>
      api<OtpRequestResponse>('/api/staff/auth/email/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: (data) => {
      setChallengeId(data.challengeId);
      setDevOtp(data.devCode ?? null);
      setOtp('');
      setError(null);
      setStep(2);
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  const verifyOtp = useMutation({
    mutationFn: () =>
      api<TotpStageResponse>('/api/staff/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, code: otp }),
      }),
    onSuccess: (data) => {
      setPendingId(data.pendingId);
      setDevTotp(data.devTotpCode ?? null);
      setTotp('');
      setError(null);
      setStep(3);
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  const verifyTotp = useMutation({
    mutationFn: () =>
      api<SessionResponse>('/api/staff/auth/totp/verify', {
        method: 'POST',
        body: JSON.stringify({ pendingId, code: totp }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/dashboard', { replace: true });
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  const devHint = (label: string, value: string | null, apply: (code: string) => void) =>
    value ? (
      <div className="mt-4 rounded-md border border-dashed border-brass-500/60 bg-brass-500/10 px-3 py-2 text-xs text-navy-900">
        <span className="font-semibold">Development code</span> · {label}{' '}
        <code className="ml-1 rounded bg-white px-1.5 py-0.5 font-mono text-[13px] font-semibold">{value}</code>
        <button type="button" className="ml-2 underline" onClick={() => apply(value)}>
          use it
        </button>
      </div>
    ) : null;

  return (
    <AuthShell>
      <div className="mb-6 flex items-center justify-between">
        <StepDots step={step} />
        <ZoneBadge />
      </div>

      <h2 className="text-2xl font-semibold text-navy-950">Staff sign in</h2>
      <p className="mt-1.5 text-sm text-slate-500">
        {step === 1 && 'Use your ADA email address. We send a one-time code to it.'}
        {step === 2 && 'Enter the six-digit code from your ADA mailbox.'}
        {step === 3 && 'Enter the code from your enrolled authenticator.'}
      </p>

      {step === 1 && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            requestOtp.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="email">
              ADA email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              autoComplete="username"
              placeholder="name@ada.gov.in"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={requestOtp.isPending}>
            {requestOtp.isPending ? 'Sending code…' : 'Send code'}
          </button>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Only @ada.gov.in addresses are accepted. Students do not sign in here — they redeem a
            referral code on the public portal.
          </p>
        </form>
      )}

      {step === 2 && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            verifyOtp.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="otp">
              Email one-time code
            </label>
            <input
              id="otp"
              className="field font-mono text-lg tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={verifyOtp.isPending || otp.length !== 6}>
            {verifyOtp.isPending ? 'Checking…' : 'Continue'}
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-navy-700 underline"
            onClick={() => {
              setStep(1);
              setOtp('');
              setError(null);
            }}
          >
            Use a different email
          </button>
          {devHint('mailbox', devOtp, setOtp)}
        </form>
      )}

      {step === 3 && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            verifyTotp.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="totp">
              Authenticator code
            </label>
            <input
              id="totp"
              className="field font-mono text-lg tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={totp}
              onChange={(event) => setTotp(event.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={verifyTotp.isPending || totp.length !== 6}>
            {verifyTotp.isPending ? 'Verifying…' : 'Sign in'}
          </button>
          {devHint('authenticator', devTotp, setTotp)}
        </form>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </AuthShell>
  );
};
