import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Level } from '@ada/shared';
import { api, ApiError } from './api.js';

interface ApplicationView {
  id: string;
  applicationNo: string | null;
  status: string;
  level: Level;
  intakeYear: number;
  lab: { code: string; name: string };
  sponsorName: string | null;
  student: { fullName: string | null; email: string; aadhaarMasked: string };
  revision: number;
  editable: boolean;
  locked: boolean;
  lockNotice: string | null;
}

const STATUS_COPY: Record<string, string> = {
  IN_PROGRESS: 'Form open — complete and submit when ready',
  SUBMITTED: 'Submitted — waiting for Admin & HR screening',
  RETURNED_FOR_CORRECTION: 'Returned for correction — edit and resubmit',
  HR_SCREENING: 'Under screening — editing is locked',
};

export const ApplicationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const application = useQuery<{ application: ApplicationView }>({
    queryKey: ['application'],
    queryFn: () => api<{ application: ApplicationView }>('/api/public/application'),
  });

  const signOut = useMutation({
    mutationFn: () => api<void>('/api/public/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  useEffect(() => {
    if (application.error instanceof ApiError && application.error.status === 401) {
      navigate('/login', { replace: true });
    }
  }, [application.error, navigate]);

  const view = application.data?.application;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-navy-950 text-[11px] font-bold tracking-widest text-white">
              ADA
            </div>
            <div className="text-sm leading-tight text-navy-950">
              My application
              <div className="text-[11px] text-slate-500">Public portal</div>
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 underline"
            onClick={() => signOut.mutate()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        {application.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        {view && (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600">
                    {view.applicationNo ?? 'Number issued at submission'}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold text-navy-950">
                    {view.student.fullName ?? 'Your application'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {view.level} · {view.lab.name} ({view.lab.code}) · intake {view.intakeYear}
                  </p>
                </div>
                <span className="chip border-teal-600/25 bg-teal-600/10 text-teal-600">{view.status}</span>
              </div>

              <p className="mt-4 rounded-md bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600">
                {STATUS_COPY[view.status] ?? 'Status recorded. Admin & HR will take the next step.'}
              </p>

              {view.lockNotice && (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                  {view.lockNotice}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 px-6 py-3.5 text-sm font-semibold text-navy-950">
                Record
              </h2>
              <dl className="divide-y divide-slate-100 text-sm">
                {[
                  ['Referred by', view.sponsorName ?? '—'],
                  ['Email', view.student.email],
                  ['Aadhaar', view.student.aadhaarMasked],
                  ['Revision', String(view.revision)],
                  ['Editing', view.editable ? 'Open' : 'Locked'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[160px_minmax(0,1fr)] px-6 py-2.5">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
              <h2 className="text-sm font-semibold text-navy-950">The form itself</h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                Milestone M2 stops at authentication: your referral is redeemed, your application
                exists and is yours. The multi-step form, uploads and revisions arrive in the next
                milestone, and every save there will be an immutable revision.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
