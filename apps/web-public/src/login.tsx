import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { Level } from '@ada/shared';
import { api, ApiError } from './api.js';
import { Navbar } from './Navbar.js';

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
  <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans">
    <Navbar />

    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_360px] w-full flex-1">
      {children}
    </main>

    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
      Aeronautical Development Agency · P.B. No. 1718, Vimanapura Post, Bengaluru 560017
    </footer>
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
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code')?.trim().toUpperCase() ?? '';
  });
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
      api('/api/public/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, code: otp }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['public', 'me'] });
      navigate('/application');
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });

  return (
    <Shell>
      <section>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700 block mb-1">
          // Secure Verification
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">
          Enter with your <span className="text-blue-600">Referral Code</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
          Internships and project work at ADA are arranged through a referral from an ADA or DRDO
          employee. Without a code issued to you, there is no public registration form.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {/* Step Progress Indicators */}
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 pb-5 border-b border-slate-100">
            {[1, 2, 3].map((index) => (
              <span key={index} className={index === step ? 'text-blue-600 font-bold' : ''}>
                {index === 1 ? '01. Referral Code' : index === 2 ? '02. Email Address' : '03. OTP Verification'}
                {index < 3 && <span className="px-2 text-slate-300">/</span>}
              </span>
            ))}
          </div>

          {step === 1 && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                redeem.mutate();
              }}
            >
              <div>
                <label className="label" htmlFor="code">
                  Referral Authorization Code
                </label>
                <input
                  id="code"
                  className="field font-mono"
                  placeholder="ADA-26-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  required
                />
                <p className="mt-2 text-xs text-slate-500 font-mono">
                  The code appears in the invitation sent by your sponsor. Case does not matter.
                </p>
              </div>
              <button className="btn" type="submit" disabled={redeem.isPending}>
                {redeem.isPending ? 'Validating Code…' : 'Continue to Email Step →'}
              </button>
            </form>
          )}

          {step === 2 && referral && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                requestOtp.mutate();
              }}
            >
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs font-mono space-y-1.5 text-slate-800">
                <div className="text-blue-700 font-bold uppercase tracking-wider text-[11px]">
                  ✓ Valid Referral Authenticated
                </div>
                <div>SPONSOR: <span className="font-bold text-slate-900">{referral.sponsorName}</span></div>
                <div>LABORATORY: <span className="font-bold text-slate-900">{referral.labName} ({referral.labCode})</span></div>
                <div>INTAKE: <span className="font-bold text-slate-900">{referral.level} ({referral.intakeYear})</span></div>
              </div>

              <div>
                <label className="label" htmlFor="email">
                  Candidate Email Address
                </label>
                <input
                  id="email"
                  className="field field-normal"
                  type="email"
                  autoComplete="email"
                  placeholder="student@institution.ac.in"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <p className="mt-2 text-xs text-slate-500 font-mono">
                  This address becomes the permanent owner of the referral. It cannot be altered later.
                </p>
              </div>
              <button className="btn" type="submit" disabled={requestOtp.isPending}>
                {requestOtp.isPending ? 'Sending Verification Code…' : 'Send OTP to this Address →'}
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 underline block mt-2 hover:text-slate-800"
                onClick={() => {
                  setStep(1);
                  setReferral(null);
                  setError(null);
                }}
              >
                ← Use a different referral code
              </button>
            </form>
          )}

          {step === 3 && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                verifyOtp.mutate();
              }}
            >
              <div>
                <label className="label" htmlFor="otp">
                  Enter 6-Digit Verification Code
                </label>
                <input
                  id="otp"
                  className="field font-mono text-xl tracking-[0.4em] text-center"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={verifyOtp.isPending || otp.length !== 6}>
                {verifyOtp.isPending ? 'Verifying…' : 'Open My Application Dossier →'}
              </button>
              {devOtp && (
                <div className="rounded-lg border border-dashed border-blue-400 bg-blue-50 p-3 text-xs font-mono text-blue-900 flex items-center justify-between">
                  <span>Development OTP: <strong>{devOtp}</strong></span>
                  <button type="button" className="underline font-bold text-blue-700" onClick={() => setOtp(devOtp)}>
                    Autofill
                  </button>
                </div>
              )}
            </form>
          )}

          {error && (
            <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-mono">
              [ALERT]: {error}
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-6 self-start">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
            Eligibility Rules
          </h2>
          <ul className="space-y-2.5 text-xs leading-relaxed text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>UG:</strong> B.E/B.Tech completed 4th/6th sem, 12–20 weeks.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>PG:</strong> M.E/M.Tech completed 1st year, 6–12 months.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>50 UG and 25 PG concurrent seats across ADA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>No stipend is paid and no fees are levied.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>College Bonafide/NOC signed by Principal is mandatory.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 text-xs leading-relaxed text-slate-500 shadow-2xs">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
            Data Privacy &amp; Masking
          </h2>
          <p>
            Aadhaar details are never stored in full. Only the last four digits and a keyed hash are kept,
            and they are masked across all administrative screens and generated PDF passes.
          </p>
        </div>
      </aside>
    </Shell>
  );
};
