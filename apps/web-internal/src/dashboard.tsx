import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS, type Permission, type Role } from '@ada/shared';
import { api, ApiError } from './api.js';

interface MeResponse {
  user: { id: string; name: string; email: string; role: Role; employeeCode: string | null };
  role: Role;
  permissions: Permission[];
}

interface FlagRow {
  key: string;
  zonePublic: boolean;
  zoneInternal: boolean;
  isHardInternal: boolean;
  effectivePublic: boolean;
  description: string | null;
}

interface ConfigResponse {
  flags: FlagRow[];
  settings: Record<string, number>;
}

const GROUPS: { label: string; prefix: string }[] = [
  { label: 'Application (own)', prefix: 'application:' },
  { label: 'Documents', prefix: 'document:' },
  { label: 'Referrals', prefix: 'referral:' },
  { label: 'Trainees & attendance', prefix: 'trainee:' },
  { label: 'Directorate', prefix: 'directorate:' },
  { label: 'Screening & casework', prefix: 'screening:' },
  { label: 'Seats, letters, exports', prefix: 'seat:' },
  { label: 'Committee', prefix: 'committee:' },
  { label: 'Director decision', prefix: 'decision:' },
  { label: 'Security', prefix: 'security:' },
  { label: 'Audit', prefix: 'audit:' },
  { label: 'Configuration', prefix: 'config:' },
];

const groupOf = (permission: Permission): string => {
  if (permission.startsWith('college_letter')) return 'Screening & casework';
  if (['application:assign', 'application:return', 'application:reject'].includes(permission)) {
    return 'Screening & casework';
  }
  if (permission.startsWith('attendance') || permission.startsWith('clearance')) return 'Trainees & attendance';
  if (permission.startsWith('topic')) return 'Directorate';
  if (permission.startsWith('letter') || permission.startsWith('export') || permission.startsWith('reporting')) return 'Seats, letters, exports';
  if (permission.startsWith('certificate')) return 'Seats, letters, exports';
  if (permission.startsWith('pass')) return 'Security';
  if (permission.startsWith('capacity')) return 'Director decision';
  if (permission.startsWith('user') || permission.startsWith('flag')) return 'Configuration';
  if (permission.startsWith('offer')) return 'Application (own)';
  return GROUPS.find((group) => permission.startsWith(group.prefix))?.label ?? 'Other';
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/staff/me'),
  });

  const canReadConfig = me.data?.permissions.includes('config:read') ?? false;

  const config = useQuery<ConfigResponse>({
    queryKey: ['config'],
    queryFn: () => api<ConfigResponse>('/api/staff/config'),
    enabled: canReadConfig,
  });

  const logout = useMutation({
    mutationFn: () => api<void>('/api/staff/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) navigate('/login', { replace: true });
  }, [me.error, navigate]);

  if (me.isLoading) {
    return <div className="p-10 text-sm text-slate-500">Loading session…</div>;
  }

  if (!me.data) {
    return <div className="p-10 text-sm text-slate-500">No session.</div>;
  }

  const { user, permissions } = me.data;
  const byGroup = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const group = groupOf(permission);
    byGroup.set(group, [...(byGroup.get(group) ?? []), permission]);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-brass-500/60 text-[11px] font-bold tracking-widest text-brass-300">
              ADA
            </div>
            <div className="text-sm leading-tight">
              Internship &amp; Project Work Portal
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Intranet · restricted</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right leading-tight">
              <div className="font-semibold">{user.name}</div>
              <div className="text-[11px] text-slate-400">{ROLE_LABELS[user.role]}</div>
            </div>
            <button
              type="button"
              className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              onClick={() => logout.mutate()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-navy-950">Signed in on the intranet</h1>
              <p className="mt-1 text-sm text-slate-500">
                {user.email}
                {user.employeeCode ? ` · ${user.employeeCode}` : ''}
              </p>
            </div>
            <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
              {permissions.length} permissions
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            This role, and everything below, came from your account record on the server. The login
            form never sent a role and the session cannot change one.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-navy-950">What this role can do</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Effective server-side permissions for {ROLE_LABELS[user.role]}.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {[...byGroup.entries()].map(([group, items]) => (
              <div key={group} className="grid gap-2 px-6 py-3 sm:grid-cols-[200px_minmax(0,1fr)]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((permission) => (
                    <code
                      key={permission}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
                    >
                      {permission}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {canReadConfig && (
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-navy-950">Configuration — feature flags</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Visible because this role holds <code className="font-mono">config:read</code>.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-2.5 font-semibold">Flag</th>
                    <th className="px-4 py-2.5 font-semibold">Public</th>
                    <th className="px-4 py-2.5 font-semibold">Internal</th>
                    <th className="px-4 py-2.5 font-semibold">Hard internal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(config.data?.flags ?? []).map((flag) => (
                    <tr key={flag.key}>
                      <td className="px-6 py-2.5">
                        <div className="font-mono text-xs text-slate-800">{flag.key}</div>
                        {flag.description && <div className="text-[11px] text-slate-400">{flag.description}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={flag.effectivePublic ? 'text-emerald-700' : 'text-slate-400'}>
                          {flag.effectivePublic ? 'on' : 'off'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={flag.zoneInternal ? 'text-emerald-700' : 'text-slate-400'}>
                          {flag.zoneInternal ? 'on' : 'off'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{flag.isHardInternal ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {config.isLoading && <p className="px-6 py-4 text-xs text-slate-400">Loading flags…</p>}
          </section>
        )}

        <p className="text-[11px] leading-relaxed text-slate-400">
          Milestone M2 ends here: authentication, zones and the permission matrix. Screening, the
          committee packet, offers and certificates are later milestones.
        </p>
      </main>
    </div>
  );
};
