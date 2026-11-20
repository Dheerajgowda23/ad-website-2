import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Level } from '@ada/shared';
import { api, ApiError } from './api.js';

interface ReferralPreview {
  sponsorName: string;
  labName: string;
  labCode: string;
  level: Level;
  intakeYear: number;
  expiresAt: string;
}

interface RedeemResponse {
  referral: ReferralPreview;
  referralToken: string;
}

interface OtpRequestResponse {
  challengeId: string;
  expiresInSeconds: number;
  devCode?: string;
}

const errorText = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Something went wrong. Try again.';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-navy-950 text-[11px] font-bold tracking-widest text-white">
            ADA
          </div>
          <div className="text-sm leading-tight text-navy-950">
            Internship &amp; Project Work
            <div className="text-[11px] text-slate-500">Aeronautical Development Agency, Bengaluru</div>
          </div>
        </div>
        <a className="text-xs font-semibold text-teal-600 underline" href="/api/health">
          Service status
        </a>
      </div>
    </header>
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      {children}
    </main>
  </div>
);

/**
 * There is no "Apply" button and no registration form. Entry is a referral code
 * from an ADA or DRDO employee, redeemed here against the student's own email.
 */
export const LoginPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState('');
  const [referral, setReferral] = useState<ReferralPreview | null>(null);
  const [referralToken, setReferralToken] = useState('');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: () =>
      api<RedeemResponse>('/api/public/auth/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: (data) => {
      setReferral(data.referral);
      setReferralToken(data.referralToken);
      setError(null);
      setStep(2);
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  const requestOtp = useMutation({
    mutationFn: () =>
      api<OtpRequestResponse>('/api/public/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ referralToken, email }),
      }),
    onSuccess: (data) => {
      setChallengeId(data.challengeId);
      setDevOtp(data.devCode ?? null);
      setOtp('');
      setError(null);
      setStep(3);
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  const verifyOtp = useMutation({
    mutationFn: () =>
      api<unknown>('/api/public/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, code: otp }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['application'] });
      navigate('/application', { replace: true });
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  return (
    <Shell>
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600">
          Public portal
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-navy-950">
          Enter with your referral code
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
          Internships and project work at ADA are arranged through a referral from an ADA or DRDO
          employee. There is no open application: without a code issued to you, there is nothing to
          fill in here. Referrals are accepted at any time of year.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {[1, 2, 3].map((index) => (
              <span key={index} className={index === step ? 'text-teal-600' : ''}>
                {index === 1 ? 'Code' : index === 2 ? 'Email' : 'Verify'}
                {index < 3 && <span className="px-1 text-slate-300">/</span>}
              </span>
            ))}
          </div>

          {step === 1 && (
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                redeem.mutate();
              }}
            >
              <div>
                <label className="label" htmlFor="code">
                  Referral code
                </label>
                <input
                  id="code"
                  className="field font-mono"
                  placeholder="LRDE-26-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  required
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  The code appears in the email your referrer sent you. Case does not matter.
                </p>
              </div>
              <button className="btn" type="submit" disabled={redeem.isPending}>
                {redeem.isPending ? 'Checking code…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 2 && referral && (
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                requestOtp.mutate();
              }}
            >
              <div className="rounded-md border border-teal-600/20 bg-teal-600/5 px-3 py-2.5 text-sm text-navy-900">
                Referred by <span className="font-semibold">{referral.sponsorName}</span>, {referral.labCode}
                <div className="mt-0.5 text-[12px] text-slate-600">
                  {referral.labName} · {referral.level} · intake {referral.intakeYear}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="email">
                  Your email
                </label>
                <input
                  id="email"
                  className="field field-normal"
                  type="email"
                  autoComplete="email"
                  placeholder="you@college.ac.in"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  This address becomes the owner of the referral. It cannot be changed later.
                </p>
              </div>
              <button className="btn" type="submit" disabled={requestOtp.isPending}>
                {requestOtp.isPending ? 'Sending code…' : 'Send code to this address'}
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 underline"
                onClick={() => {
                  setStep(1);
                  setReferral(null);
                  setError(null);
                }}
              >
                Use a different code
              </button>
            </form>
          )}

          {step === 3 && (
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                verifyOtp.mutate();
              }}
            >
              <div>
                <label className="label" htmlFor="otp">
                  Six-digit code
                </label>
                <input
                  id="otp"
                  className="field font-mono text-lg tracking-[0.4em]"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={verifyOtp.isPending || otp.length !== 6}>
                {verifyOtp.isPending ? 'Verifying…' : 'Open my application'}
              </button>
              {devOtp && (
                <div className="rounded-md border border-dashed border-teal-600/50 bg-teal-600/5 px-3 py-2 text-xs text-navy-900">
                  <span className="font-semibold">Development code</span>{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] font-semibold">
                    {devOtp}
                  </code>
                  <button type="button" className="ml-2 underline" onClick={() => setOtp(devOtp)}>
                    use it
                  </button>
                </div>
              )}
            </form>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </section>

      <aside className="space-y-4 self-start">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Before you start</h2>
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-slate-600">
            <li>UG: completed 6th semester, 12–20 weeks.</li>
            <li>PG: completed 1st year, 6–12 weeks.</li>
            <li>50 UG and 25 PG seats at a time.</li>
            <li>No stipend is paid and no fee is charged.</li>
            <li>The college recommendation letter is signed on paper, scanned and uploaded.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-[12px] leading-relaxed text-slate-500">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Privacy</h2>
          <p className="mt-2">
            Aadhaar is never stored in full. Only the last four digits are kept, and they are masked
            on every screen and document.
          </p>
        </div>
      </aside>
    </Shell>
  );
};
