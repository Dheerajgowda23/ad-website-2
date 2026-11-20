import type { ReactNode } from 'react';

const ZONE = 'INTRANET';

export const BrandPanel = () => (
  <div className="relative hidden overflow-hidden bg-navy-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.14]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, #c69a4b 0, transparent 45%), radial-gradient(circle at 80% 0%, #2d5f8f 0, transparent 40%)',
      }}
    />
    <div className="relative">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-brass-500/60 text-sm font-bold tracking-widest text-brass-300">
          ADA
        </div>
        <div className="text-[13px] leading-tight text-slate-300">
          Aeronautical Development Agency
          <br />
          <span className="text-slate-400">Bengaluru · DRDO</span>
        </div>
      </div>

      <h1 className="mt-12 max-w-sm text-3xl font-semibold leading-tight">
        Internship &amp; Project Work Portal
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
        Staff access. Referral-driven intake, screening, committee review and the
        Director&rsquo;s decision — one pipeline, one record.
      </p>
    </div>

    <dl className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-[11px] uppercase tracking-wider text-slate-400">
      <div>
        <dt>Zone</dt>
        <dd className="mt-1 text-sm font-semibold tracking-normal text-white">{ZONE}</dd>
      </div>
      <div>
        <dt>Seats per cycle</dt>
        <dd className="mt-1 text-sm font-semibold tracking-normal text-white">50 UG · 25 PG</dd>
      </div>
      <div>
        <dt>Stipend</dt>
        <dd className="mt-1 text-sm font-semibold tracking-normal text-white">None</dd>
      </div>
    </dl>
  </div>
);

export const AuthShell = ({ children }: { children: ReactNode }) => (
  <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
    <BrandPanel />
    <div className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  </div>
);

export const ZoneBadge = () => (
  <span className="chip border-navy-700/20 bg-navy-700/5 text-navy-700">Intranet zone</span>
);

export const StepDots = ({ step }: { step: number }) => (
  <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
    {[1, 2, 3].map((index) => (
      <span
        key={index}
        className={`h-1.5 w-10 rounded-full ${index <= step ? 'bg-navy-900' : 'bg-slate-200'}`}
      />
    ))}
  </div>
);
