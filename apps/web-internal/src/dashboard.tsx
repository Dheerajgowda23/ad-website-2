import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS, type Permission, type Role, type Level } from '@ada/shared';
import { api, ApiError } from './api.js';

/** Mirrors SPONSOR_QUOTA_PER_YEAR in the referral service. */
const SPONSOR_QUOTA_PER_YEAR = 3;

interface MeResponse {
  user: { id: string; name: string; email: string; role: Role; employeeCode: string | null };
  role: Role;
  permissions: Permission[];
}

interface ApplicationListItem {
  id: string;
  applicationNo: string | null;
  status: string;
  level: Level;
  intakeYear: number;
  studentName: string;
  studentEmail: string;
  aadhaarMasked: string;
  labCode: string;
  labName: string;
  sponsorName: string | null;
  directorateName: string | null;
  topic: string | null;
  cgpa: number | null;
  durationWeeks: number | null;
  collegeLetterVerified: boolean;
  revision: number;
  submittedAt: string | null;
  averageScore: number | null;
}

interface SeatLedgerResponse {
  summary: {
    ug: { capacity: number; occupied: number; reserved: number; available: number };
    pg: { capacity: number; occupied: number; reserved: number; available: number };
  };
  directorates: {
    code: string;
    name: string;
    ugCap: number;
    pgCap: number;
    ugUsed: number;
    pgUsed: number;
  }[];
}

interface ReferralItem {
  id: string;
  codePrefix: string;
  level: Level;
  intakeYear: number;
  expiresAt: string;
  boundStudentEmail: string | null;
  boundAt: string | null;
  state: string;
  isRevocable: boolean;
  application: { id: string; applicationNo: string | null; status: string; studentName: string; studentEmail: string } | null;
}

export const DashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/staff/me'),
  });

  const [activeTab, setActiveTab] = useState<string>('applications');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [attendanceCsv, setAttendanceCsv] = useState('');
  const [staffNotice, setStaffNotice] = useState('');
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'GUIDE', employeeCode: '', labId: '' });

  // Modals & Action dialogs
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<any | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    type: 'return' | 'reject' | 'assign' | 'review' | 'decide' | 'pass' | 'attendance' | null;
    appId: string;
  }>({ type: null, appId: '' });

  // Form states for actions
  const [reasonInput, setReasonInput] = useState('');
  const [selectedDirectorate, setSelectedDirectorate] = useState('');
  const [selectedGuide, setSelectedGuide] = useState('');
  const [scoreInput, setScoreInput] = useState(85);
  const [recommendationInput, setRecommendationInput] = useState<'RECOMMEND' | 'NOT_RECOMMEND' | 'REFER'>('RECOMMEND');
  const [reportingDateInput, setReportingDateInput] = useState('2026-06-01');
  const [passNoInput, setPassNoInput] = useState('PASS-2026-001');
  const [attendanceMonth, setAttendanceMonth] = useState('2026-06');
  const [presentDays, setPresentDays] = useState(22);
  const [totalDays, setTotalDays] = useState(22);

  // Referral form
  const [refLevel, setRefLevel] = useState<'UG' | 'PG'>('UG');
  const [refStudentName, setRefStudentName] = useState('');
  const [refStudentEmail, setRefStudentEmail] = useState('');

  const permissions = me.data?.permissions ?? [];
  const role = me.data?.role;
  const user = me.data?.user;

  // Set default active tab based on role
  useEffect(() => {
    if (role === 'SPONSOR') setActiveTab('referrals');
    else if (role === 'COMMITTEE') setActiveTab('committee');
    else if (role === 'DIRECTOR') setActiveTab('director');
    else if (role === 'SECURITY') setActiveTab('security');
    else if (role === 'GUIDE') setActiveTab('guide');
    else setActiveTab('applications');
  }, [role]);

  // Queries
  const applicationsQuery = useQuery<{ applications: ApplicationListItem[] }>({
    queryKey: ['applications', statusFilter, searchQuery],
    queryFn: () =>
      api<{ applications: ApplicationListItem[] }>(
        `/api/staff/casework/applications?${statusFilter ? `status=${statusFilter}&` : ''}${
          searchQuery ? `q=${encodeURIComponent(searchQuery)}` : ''
        }`,
      ),
    enabled: Boolean(me.data),
  });

  const packetQuery = useQuery<any>({
    queryKey: ['applicationPacket', selectedAppId],
    queryFn: () => api(`/api/staff/casework/applications/${selectedAppId}`),
    enabled: Boolean(selectedAppId),
  });

  const seatLedgerQuery = useQuery<SeatLedgerResponse>({
    queryKey: ['seatLedger'],
    queryFn: () => api<SeatLedgerResponse>('/api/staff/casework/seats/ledger'),
    enabled: permissions.includes('seat:read'),
  });

  const referralsQuery = useQuery<{ referrals: ReferralItem[]; quotaUsed: number; quotaLimit: number }>({
    queryKey: ['myReferrals'],
    queryFn: () => api('/api/staff/referrals/my'),
    enabled: permissions.includes('referral:read:own'),
  });

  const metaDirectorates = useQuery<{ directorates: any[] }>({
    queryKey: ['metaDirectorates'],
    queryFn: () => api('/api/staff/casework/meta/directorates'),
  });

  const metaGuides = useQuery<{ guides: any[] }>({
    queryKey: ['metaGuides'],
    queryFn: () => api('/api/staff/casework/meta/guides'),
  });

  const auditQuery = useQuery<{ logs: any[] }>({
    queryKey: ['auditLogs'],
    queryFn: () => api('/api/staff/casework/audit'),
    enabled: permissions.includes('audit:read') && activeTab === 'audit',
  });

  const attendanceQuery = useQuery<any>({
    queryKey: ['attendanceReport', attendanceMonth],
    queryFn: () => api(`/api/staff/casework/attendance/report?month=${attendanceMonth}`),
    enabled: permissions.includes('reporting:read') && activeTab === 'attendance',
  });

  const staffQuery = useQuery<{ users: any[] }>({
    queryKey: ['staffUsers'],
    queryFn: () => api('/api/staff/users'),
    enabled: permissions.includes('user:manage') && activeTab === 'staff',
  });

  const labsQuery = useQuery<{ labs: { id: string; code: string; name: string; type: string }[] }>({
    queryKey: ['labs'],
    queryFn: () => api('/api/staff/casework/meta/labs'),
    enabled: permissions.includes('user:manage'),
  });

  const sponsorsQuery = useQuery<{ sponsors: any[] }>({
    queryKey: ['sponsors'],
    queryFn: () => api('/api/staff/users/sponsors'),
    enabled: permissions.includes('user:manage') && activeTab === 'sponsors',
  });

  const verifySponsorMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) =>
      api(`/api/staff/users/sponsors/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sponsors'] }),
    onError: (err: Error) => alert(err.message),
  });

  // Bulk casework: one request, per-row results back.
  const bulkMut = useMutation({
    mutationFn: (input: { action: string; ids: string[]; reason?: string }) =>
      api('/api/staff/casework/applications/bulk', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (result: any) => {
      alert(`${result.succeeded} updated, ${result.failed} failed`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const importAttendanceMut = useMutation({
    mutationFn: () =>
      api('/api/staff/casework/attendance/import', {
        method: 'POST',
        body: JSON.stringify({ csv: attendanceCsv }),
      }),
    onSuccess: (result: any) => {
      setStaffNotice(`Imported ${result.imported} rows, ${result.failed} failed.`);
      setAttendanceCsv('');
      queryClient.invalidateQueries({ queryKey: ['attendanceReport'] });
    },
    onError: (err: Error) => setStaffNotice(err.message),
  });

  const createStaffMut = useMutation({
    mutationFn: () =>
      api('/api/staff/users', {
        method: 'POST',
        body: JSON.stringify({
          name: staffForm.name,
          email: staffForm.email,
          role: staffForm.role,
          employeeCode: staffForm.employeeCode || null,
          labId: staffForm.labId || null,
        }),
      }),
    onSuccess: () => {
      setStaffNotice('Account created. The person can sign in and enrol an authenticator.');
      setStaffForm({ name: '', email: '', role: 'GUIDE', employeeCode: '', labId: '' });
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] });
    },
    onError: (err: Error) => setStaffNotice(err.message),
  });

  const updateStaffMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/api/staff/users/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffUsers'] }),
    onError: (err: Error) => setStaffNotice(err.message),
  });

  const resetAuthenticatorMut = useMutation({
    mutationFn: (id: string) => api(`/api/staff/users/${id}/reset-authenticator`, { method: 'POST' }),
    onSuccess: (result: any) => {
      setStaffNotice(result.message);
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
    onError: (err: Error) => setStaffNotice(err.message),
  });

  // Action Mutations
  const verifyLetterMut = useMutation({
    mutationFn: (id: string) => api(`/api/staff/casework/applications/${id}/verify-letter`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('College recommendation letter officially verified.');
    },
  });

  const screenAppMut = useMutation({
    mutationFn: (id: string) => api(`/api/staff/casework/applications/${id}/screen`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Formal HR Screening started. Student edits are now locked.');
    },
  });

  const returnAppMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/api/staff/casework/applications/${id}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason, deadlineDays: 7 }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Application returned to student for correction.');
    },
  });

  const rejectEligibilityMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/api/staff/casework/applications/${id}/reject-eligibility`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Application marked Ineligible.');
    },
  });

  const assignMut = useMutation({
    mutationFn: ({ id, directorateId, guideId }: { id: string; directorateId: string; guideId?: string }) =>
      api(`/api/staff/casework/applications/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ directorateId, guideId, committeeBatchId: 'BATCH-2026-A' }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Directorate & Committee assigned. Application forwarded to Committee Review.');
    },
    onError: (err: any) => alert(`Error: ${err.message}`),
  });

  const submitReviewMut = useMutation({
    mutationFn: ({ id, score, remarks, recommendation }: any) =>
      api(`/api/staff/casework/applications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ score, remarks, recommendation }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Committee review recorded.');
    },
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision, reportingDate }: any) =>
      api(`/api/staff/casework/applications/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, reportingDate }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['seatLedger'] });
      alert('Director decision recorded. Offer issued.');
    },
  });

  const verifyJoiningMut = useMutation({
    mutationFn: (id: string) => api(`/api/staff/casework/applications/${id}/verify-joining`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Police clearance and ID proof verified.');
    },
  });

  const issuePassMut = useMutation({
    mutationFn: ({ id, passNo }: any) =>
      api(`/api/staff/casework/applications/${id}/issue-pass`, {
        method: 'POST',
        body: JSON.stringify({ passNo }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Security pass issued. Trainee is now IN_TRAINING.');
    },
  });

  const attendanceMut = useMutation({
    mutationFn: ({ id, month, presentDays, totalDays }: any) =>
      api(`/api/staff/casework/applications/${id}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ month, presentDays, totalDays }),
      }),
    onSuccess: () => {
      setActionDialog({ type: null, appId: '' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Monthly attendance recorded.');
    },
  });

  const completeTrainingMut = useMutation({
    mutationFn: (id: string) => api(`/api/staff/casework/applications/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert('Guide clearance given. Training marked COMPLETED.');
    },
  });

  const issueCertificateMut = useMutation({
    mutationFn: (id: string) => api(`/api/staff/casework/applications/${id}/certificate`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationPacket', selectedAppId] });
      alert(`Certificate issued with serial ${data.serialNo}.`);
    },
    onError: (err: any) => alert(`Error: ${err.message}`),
  });

  const createReferralMut = useMutation({
    mutationFn: (data: any) =>
      api('/api/staff/referrals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data: any) => {
      setGeneratedCode(data);
      queryClient.invalidateQueries({ queryKey: ['myReferrals'] });
    },
    onError: (err: any) => alert(`Error: ${err.message}`),
  });

  const revokeReferralMut = useMutation({
    mutationFn: (codeId: string) =>
      api(`/api/staff/referrals/${codeId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Revoked by sponsor' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myReferrals'] });
      alert('Referral code revoked.');
    },
  });

  const logout = useMutation({
    mutationFn: () => api('/api/staff/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  if (me.isLoading) {
    return <div className="p-10 text-sm text-slate-500">Loading intranet workspace...</div>;
  }
  if (!me.data) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Intranet Top Header */}
      <header className="border-b border-navy-900 bg-navy-950 text-white sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-teal-600 text-xs font-bold tracking-widest text-white">
              ADA
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">Aeronautical Development Agency</div>
              <div className="text-[10px] uppercase tracking-widest text-teal-400">Internship Casework Portal · Intranet Zone</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="font-bold">{user?.name}</div>
              <div className="text-[10px] text-teal-300 font-medium">{ROLE_LABELS[role!]}</div>
            </div>
            <button
              type="button"
              className="rounded border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10"
              onClick={() => logout.mutate()}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-navy-900 bg-navy-900/60 px-6">
          <div className="mx-auto max-w-7xl flex gap-1 overflow-x-auto text-xs py-1">
            {permissions.includes('screening:read') && (
              <button
                onClick={() => { setActiveTab('applications'); setSelectedAppId(null); }}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'applications' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Applications Inbox
              </button>
            )}
            {permissions.includes('referral:read:own') && (
              <button
                onClick={() => setActiveTab('referrals')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'referrals' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Referral Manager
              </button>
            )}
            {permissions.includes('seat:read') && (
              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'ledger' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Seat Ledger
              </button>
            )}
            {permissions.includes('committee:score') && (
              <button
                onClick={() => setActiveTab('committee')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'committee' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Committee Packets
              </button>
            )}
            {permissions.includes('decision:approve') && (
              <button
                onClick={() => setActiveTab('director')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'director' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Director Decisions
              </button>
            )}
            {permissions.includes('pass:issue') && (
              <button
                onClick={() => setActiveTab('security')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'security' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Security Desk
              </button>
            )}
            {permissions.includes('attendance:write') && (
              <button
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'guide' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Trainees & Attendance
              </button>
            )}
            {(permissions.includes('reporting:read') || permissions.includes('attendance:write')) && (
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'attendance' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                {permissions.includes('reporting:read') ? 'Attendance Report' : 'Attendance Import'}
              </button>
            )}
            {permissions.includes('audit:read') && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'audit' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Audit Trail
              </button>
            )}
            {permissions.includes('user:manage') && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'staff' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Staff & Access
              </button>
            )}
            {permissions.includes('user:manage') && (
              <button
                onClick={() => setActiveTab('sponsors')}
                className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'sponsors' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Sponsors
              </button>
            )}
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-3 py-1.5 rounded font-semibold transition ${activeTab === 'permissions' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Account & Role
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl flex-1 px-6 py-6 w-full space-y-6">
        {/* ==================================================================== */}
        {/* TAB 1: APPLICATIONS INBOX (Admin & HR) */}
        {/* ==================================================================== */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex flex-wrap gap-2 text-xs">
                {['', 'SUBMITTED', 'HR_SCREENING', 'RETURNED_FOR_CORRECTION', 'COMMITTEE_REVIEW', 'DIRECTOR_DECISION', 'OFFER_ISSUED', 'ACCEPTED', 'IN_TRAINING', 'COMPLETED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded font-semibold border ${
                      statusFilter === st ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st ? st : 'All Applications'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search candidate, topic, app no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs w-64"
                />

                <a
                  href={`/api/staff/casework/export/csv?${statusFilter ? `status=${statusFilter}&` : ''}${searchQuery ? `q=${encodeURIComponent(searchQuery)}` : ''}`}
                  download="ada-applications.csv"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition inline-flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </a>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs">
                <span className="font-bold text-teal-900">{selectedIds.length} selected</span>
                <button
                  onClick={() => {
                    const reason = window.prompt('Reason for return (the student sees this)');
                    if (reason) bulkMut.mutate({ action: 'RETURN', ids: selectedIds, reason });
                  }}
                  className="rounded border border-teal-300 bg-white px-2.5 py-1 font-semibold text-teal-900 hover:bg-teal-100"
                >
                  Return for correction
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt('Rejection reason (recorded in the audit trail)');
                    if (reason && window.confirm(`Reject ${selectedIds.length} applications as ineligible?`)) {
                      bulkMut.mutate({ action: 'REJECT', ids: selectedIds, reason });
                    }
                  }}
                  className="rounded border border-red-300 bg-white px-2.5 py-1 font-semibold text-red-700 hover:bg-red-50"
                >
                  Reject eligibility
                </button>
                <button
                  onClick={() => bulkMut.mutate({ action: 'REMIND', ids: selectedIds, reason: 'awaiting action from the sponsoring officer' })}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Remind sponsors
                </button>
                <button onClick={() => setSelectedIds([])} className="ml-auto text-slate-500 hover:text-slate-800">
                  Clear
                </button>
              </div>
            )}

            {/* Applications Table */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all applications"
                        checked={
                          (applicationsQuery.data?.applications?.length ?? 0) > 0 &&
                          selectedIds.length === (applicationsQuery.data?.applications?.length ?? 0)
                        }
                        onChange={(event) =>
                          setSelectedIds(event.target.checked ? (applicationsQuery.data?.applications ?? []).map((a) => a.id) : [])
                        }
                      />
                    </th>
                    <th className="p-3">Application No</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Referring Lab</th>
                    <th className="p-3">Project Topic</th>
                    <th className="p-3">CGPA</th>
                    <th className="p-3">College Letter</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(applicationsQuery.data?.applications ?? []).map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${app.applicationNo ?? app.studentName}`}
                          checked={selectedIds.includes(app.id)}
                          onChange={(event) =>
                            setSelectedIds(
                              event.target.checked
                                ? [...selectedIds, app.id]
                                : selectedIds.filter((selected) => selected !== app.id),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-navy-950">{app.applicationNo ?? 'Draft'}</td>
                      <td className="p-3 font-semibold text-slate-900">{app.studentName}</td>
                      <td className="p-3"><span className="chip border-slate-200 bg-slate-50 font-bold">{app.level}</span></td>
                      <td className="p-3 text-slate-600">{app.labCode}</td>
                      <td className="p-3 text-slate-700 max-w-[200px] truncate">{app.topic ?? '—'}</td>
                      <td className="p-3 font-mono">{app.cgpa ?? '—'}</td>
                      <td className="p-3">
                        {app.collegeLetterVerified ? (
                          <span className="text-emerald-700 font-bold">✓ Verified</span>
                        ) : (
                          <span className="text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="p-3"><span className="chip border-teal-200 bg-teal-50 text-teal-800 font-bold">{app.status}</span></td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedAppId(app.id)}
                          className="rounded bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500"
                        >
                          Open Packet
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(applicationsQuery.data?.applications?.length === 0) && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">No applications found in this queue.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Application Detail Packet Modal / Drawer */}
            {selectedAppId && packetQuery.data && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                    <div>
                      <span className="chip border-teal-200 bg-teal-50 text-teal-800 font-bold">{packetQuery.data.application.status}</span>
                      <h2 className="text-lg font-bold text-navy-950 mt-1">
                        {packetQuery.data.student.fullName} · {packetQuery.data.application.applicationNo}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {packetQuery.data.application.level} · {packetQuery.data.lab.name} ({packetQuery.data.lab.code}) · Referred by {packetQuery.data.sponsor?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedAppId(null)}
                      className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Actions Toolbar for Admin & HR */}
                  <div className="rounded border border-teal-200 bg-teal-50/50 p-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-teal-900 uppercase">Casework Actions:</span>

                    {/* Verify College Letter */}
                    {!packetQuery.data.application.collegeLetterVerifiedAt && (
                      <button
                        onClick={() => verifyLetterMut.mutate(selectedAppId)}
                        disabled={verifyLetterMut.isPending}
                        className="rounded bg-emerald-700 px-3 py-1 font-bold text-white hover:bg-emerald-800"
                      >
                        Verify College Letter
                      </button>
                    )}

                    {/* Start Screening */}
                    {packetQuery.data.application.status === 'SUBMITTED' && (
                      <button
                        onClick={() => screenAppMut.mutate(selectedAppId)}
                        disabled={screenAppMut.isPending}
                        className="rounded bg-teal-700 px-3 py-1 font-bold text-white hover:bg-teal-800"
                      >
                        Start HR Screening (Lock Edits)
                      </button>
                    )}

                    {/* Assign Directorate & Committee */}
                    {['SUBMITTED', 'HR_SCREENING'].includes(packetQuery.data.application.status) && (
                      <button
                        onClick={() => setActionDialog({ type: 'assign', appId: selectedAppId })}
                        className="rounded bg-blue-700 px-3 py-1 font-bold text-white hover:bg-blue-800"
                      >
                        Assign Directorate & Committee
                      </button>
                    )}

                    {/* Return for Correction */}
                    {['SUBMITTED', 'HR_SCREENING'].includes(packetQuery.data.application.status) && (
                      <button
                        onClick={() => setActionDialog({ type: 'return', appId: selectedAppId })}
                        className="rounded border border-amber-400 bg-amber-100 text-amber-900 px-3 py-1 font-bold hover:bg-amber-200"
                      >
                        Return for Correction
                      </button>
                    )}

                    {/* Reject Eligibility */}
                    {['SUBMITTED', 'HR_SCREENING'].includes(packetQuery.data.application.status) && (
                      <button
                        onClick={() => setActionDialog({ type: 'reject', appId: selectedAppId })}
                        className="rounded border border-rose-400 bg-rose-100 text-rose-900 px-3 py-1 font-bold hover:bg-rose-200"
                      >
                        Reject Eligibility
                      </button>
                    )}

                    {/* Issue Certificate */}
                    {packetQuery.data.application.status === 'COMPLETED' && (
                      <button
                        onClick={() => issueCertificateMut.mutate(selectedAppId)}
                        disabled={issueCertificateMut.isPending}
                        className="rounded bg-teal-700 px-3 py-1 font-bold text-white hover:bg-teal-800"
                      >
                        Issue Digital Certificate
                      </button>
                    )}

                    {/* PDF Downloads */}
                    <div className="ml-auto flex items-center gap-2">
                      <a
                        href={`/api/staff/casework/applications/${selectedAppId}/summary-pdf`}
                        download={`ADA-${packetQuery.data.application.applicationNo || 'Packet'}.pdf`}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 transition inline-flex items-center gap-1"
                      >
                        Packet PDF
                      </a>

                      {packetQuery.data.offer && (
                        <a
                          href={`/api/staff/casework/applications/${selectedAppId}/offer-pdf`}
                          download={`ADA-Offer-${packetQuery.data.application.applicationNo}.pdf`}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 transition inline-flex items-center gap-1"
                        >
                          Offer PDF
                        </a>
                      )}

                      {packetQuery.data.certificate && (
                        <a
                          href={`/api/staff/casework/applications/${selectedAppId}/certificate-pdf`}
                          download={`ADA-Certificate-${packetQuery.data.certificate.serialNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`}
                          className="rounded border border-teal-600 bg-teal-50 px-2.5 py-1 font-bold text-teal-800 hover:bg-teal-100 transition inline-flex items-center gap-1"
                        >
                          Certificate PDF
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Packet Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="rounded border border-slate-200 p-4 bg-slate-50 space-y-2">
                      <h3 className="font-bold text-navy-950 uppercase">Student Profile</h3>
                      <p><strong>DOB:</strong> {packetQuery.data.student.dob} · <strong>Gender:</strong> {packetQuery.data.student.gender}</p>
                      <p><strong>Aadhaar (Masked):</strong> {packetQuery.data.student.aadhaarMasked}</p>
                      <p><strong>Email:</strong> {packetQuery.data.student.email} · <strong>Phone:</strong> {packetQuery.data.student.phone}</p>
                      <p><strong>Permanent Address:</strong> {packetQuery.data.student.permanentAddress}</p>
                    </div>

                    <div className="rounded border border-slate-200 p-4 bg-slate-50 space-y-2">
                      <h3 className="font-bold text-navy-950 uppercase">Academic & Project Work</h3>
                      <p><strong>Course:</strong> {packetQuery.data.application.degree} ({packetQuery.data.application.discipline}) · <strong>CGPA:</strong> {packetQuery.data.application.cgpa}</p>
                      <p><strong>Duration:</strong> {packetQuery.data.application.durationWeeks} weeks ({packetQuery.data.application.startDate} to {packetQuery.data.application.endDate})</p>
                      <p><strong>Topic:</strong> {packetQuery.data.application.topic}</p>
                      <p><strong>Synopsis:</strong> {packetQuery.data.application.synopsis}</p>
                    </div>
                  </div>

                  {/* Uploaded Documents */}
                  <div className="text-xs space-y-2">
                    <h3 className="font-bold text-navy-950 uppercase">Uploaded Documents</h3>
                    <div className="space-y-1">
                      {packetQuery.data.documents.map((doc: any) => (
                        <div key={doc.id} className="flex justify-between items-center rounded border border-slate-200 p-2.5">
                          <div>
                            <span className="font-semibold text-slate-800">{doc.kind} (v{doc.version})</span>
                            <span className="text-slate-400 ml-2 font-mono text-[11px]">{doc.sha256.slice(0, 16)}...</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {doc.verifiedAt ? (
                              <span className="text-emerald-700 font-bold">✓ Verified by {doc.verifiedBy}</span>
                            ) : (
                              <span className="text-amber-700">Verification Pending</span>
                            )}
                            <a
                              className="underline font-semibold text-teal-700"
                              href={`/api/staff/casework/applications/${packetQuery.data.application.id}/documents/${doc.id}/download`}
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Revisions History */}
                  {packetQuery.data.revisions.length > 0 && (
                    <div className="text-xs space-y-2">
                      <h3 className="font-bold text-navy-950 uppercase">Revisions History</h3>
                      <div className="space-y-1">
                        {packetQuery.data.revisions.map((rev: any) => (
                          <div key={rev.id} className="flex justify-between items-center rounded border border-slate-200 p-2 bg-slate-50 text-[11px]">
                            <span><strong>Rev #{rev.revisionNo}</strong>: {rev.changedFields.join(', ')}</span>
                            <span className="text-slate-400">{new Date(rev.submittedAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Committee Reviews */}
                  {packetQuery.data.reviews.length > 0 && (
                    <div className="text-xs space-y-2">
                      <h3 className="font-bold text-navy-950 uppercase">Committee Evaluation</h3>
                      <div className="space-y-2">
                        {packetQuery.data.reviews.map((r: any) => (
                          <div key={r.id} className="rounded border border-slate-200 p-3 bg-slate-50">
                            <div className="flex justify-between font-semibold">
                              <span>Evaluator: {r.committeeMemberName}</span>
                              <span className="font-bold text-teal-700">Score: {r.score}/100 · {r.recommendation}</span>
                            </div>
                            <p className="mt-1 text-slate-600">{r.remarks}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: REFERRALS MANAGER (Sponsors & ADA Staff) */}
        {/* ==================================================================== */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-navy-950">Referral Code Management</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Issue unique, single-use referral codes for engineering students. Annual quota: 3 codes.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-slate-500">Quota Used</span>
                  <div className="font-bold font-mono text-sm text-navy-950">
                    {referralsQuery.data?.quotaUsed ?? 0} / {referralsQuery.data?.quotaLimit ?? 3}
                  </div>
                </div>
                <button
                  onClick={() => setShowReferralModal(true)}
                  disabled={(referralsQuery.data?.quotaUsed ?? 0) >= (referralsQuery.data?.quotaLimit ?? 3)}
                  className="rounded-md bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  Issue Referral Code
                </button>
              </div>
            </div>

            {/* Referrals Table */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Code Prefix</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Bound Student Email</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Application Progress</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(referralsQuery.data?.referrals ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 font-mono font-bold text-navy-950">{r.codePrefix}-****</td>
                      <td className="p-3 font-semibold">{r.level}</td>
                      <td className="p-3">{r.boundStudentEmail ?? 'Unclaimed'}</td>
                      <td className="p-3">{new Date(r.expiresAt).toLocaleDateString()}</td>
                      <td className="p-3"><span className="chip border-slate-200 bg-slate-50 font-bold">{r.state}</span></td>
                      <td className="p-3">
                        {r.application ? (
                          <span className="font-medium text-teal-800">{r.application.status} ({r.application.applicationNo})</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {r.isRevocable && (
                          <button
                            onClick={() => revokeReferralMut.mutate(r.id)}
                            className="text-xs text-rose-600 hover:text-rose-800 underline font-semibold"
                          >
                            Revoke Code
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(referralsQuery.data?.referrals?.length === 0) && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">No referral codes issued yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Issue Referral Modal */}
            {showReferralModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
                  <h3 className="text-base font-bold text-navy-950">Issue New Referral Code</h3>

                  {generatedCode ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border-2 border-teal-500 bg-teal-50 p-4 text-center">
                        <p className="text-xs font-semibold text-teal-800 uppercase">Referral Code (Shown Once)</p>
                        <p className="text-xl font-mono font-bold text-navy-950 mt-1 select-all">{generatedCode.code}</p>
                        <p className="text-[11px] text-teal-700 mt-2">
                          Send this code to the student to redeem at the public portal. Expires in 45 days.
                        </p>
                      </div>
                      <button
                        onClick={() => { setGeneratedCode(null); setShowReferralModal(false); }}
                        className="btn"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createReferralMut.mutate({
                          level: refLevel,
                          studentName: refStudentName,
                          studentEmail: refStudentEmail,
                        });
                      }}
                      className="space-y-4 text-xs"
                    >
                      <div>
                        <label className="label">Internship Level</label>
                        <select
                          value={refLevel}
                          onChange={(e) => setRefLevel(e.target.value as any)}
                          className="field field-normal"
                        >
                          <option value="UG">UG (BE/B.Tech - 12 to 20 Weeks)</option>
                          <option value="PG">PG (ME/M.Tech - 6 to 12 Months)</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">Student Name</label>
                        <input
                          type="text"
                          required
                          value={refStudentName}
                          onChange={(e) => setRefStudentName(e.target.value)}
                          className="field field-normal"
                        />
                      </div>

                      <div>
                        <label className="label">Student Email Address</label>
                        <input
                          type="email"
                          required
                          value={refStudentEmail}
                          onChange={(e) => setRefStudentEmail(e.target.value)}
                          className="field field-normal"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowReferralModal(false)}
                          className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createReferralMut.isPending}
                          className="rounded bg-teal-600 px-4 py-1.5 font-bold text-white hover:bg-teal-500"
                        >
                          {createReferralMut.isPending ? 'Generating...' : 'Generate Code'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: SEAT LEDGER (Admin & HR / Directorate Head / Director) */}
        {/* ==================================================================== */}
        {activeTab === 'ledger' && seatLedgerQuery.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* UG Capacity Card */}
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wide">Undergraduate (UG) Quota</h3>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-navy-950">{seatLedgerQuery.data.summary.ug.occupied}</span>
                  <span className="text-xs font-semibold text-slate-500">of {seatLedgerQuery.data.summary.ug.capacity} Max Concurrent Seats</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-teal-600 h-3 rounded-full"
                    style={{ width: `${(seatLedgerQuery.data.summary.ug.occupied / seatLedgerQuery.data.summary.ug.capacity) * 100}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-600">
                  <span>Reserved (Offer Issued): {seatLedgerQuery.data.summary.ug.reserved}</span>
                  <span>Available: {seatLedgerQuery.data.summary.ug.available}</span>
                </div>
              </div>

              {/* PG Capacity Card */}
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wide">Postgraduate (PG) Quota</h3>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-navy-950">{seatLedgerQuery.data.summary.pg.occupied}</span>
                  <span className="text-xs font-semibold text-slate-500">of {seatLedgerQuery.data.summary.pg.capacity} Max Concurrent Seats</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-teal-600 h-3 rounded-full"
                    style={{ width: `${(seatLedgerQuery.data.summary.pg.occupied / seatLedgerQuery.data.summary.pg.capacity) * 100}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-600">
                  <span>Reserved (Offer Issued): {seatLedgerQuery.data.summary.pg.reserved}</span>
                  <span>Available: {seatLedgerQuery.data.summary.pg.available}</span>
                </div>
              </div>
            </div>

            {/* Directorate Breakdown */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wide mb-4">Capacity Breakdown by Directorate</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="p-3 border-b">Directorate</th>
                      <th className="p-3 border-b">Code</th>
                      <th className="p-3 border-b">UG Allocated / Capacity</th>
                      <th className="p-3 border-b">PG Allocated / Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {seatLedgerQuery.data.directorates.map((d) => (
                      <tr key={d.code}>
                        <td className="p-3 font-semibold text-navy-950">{d.name}</td>
                        <td className="p-3 font-mono">{d.code}</td>
                        <td className="p-3">{d.ugUsed} / {d.ugCap} seats</td>
                        <td className="p-3">{d.pgUsed} / {d.pgCap} seats</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: COMMITTEE PACKETS */}
        {/* ==================================================================== */}
        {activeTab === 'committee' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-navy-950">Assigned Committee Scrutiny Queue</h2>
              <p className="text-xs text-slate-500 mt-1">
                Evaluate candidates against academic acceptability metrics, score rubrics, and project relevance.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Application No</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">CGPA</th>
                    <th className="p-3">Topic</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(applicationsQuery.data?.applications ?? [])
                    .filter((a) => a.status === 'COMMITTEE_REVIEW' || a.status === 'DIRECTOR_DECISION')
                    .map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-mono font-bold text-navy-950">{app.applicationNo}</td>
                        <td className="p-3 font-semibold">{app.studentName}</td>
                        <td className="p-3">{app.level}</td>
                        <td className="p-3 font-mono">{app.cgpa}</td>
                        <td className="p-3">{app.topic}</td>
                        <td className="p-3"><span className="chip border-teal-200 bg-teal-50 text-teal-800 font-bold">{app.status}</span></td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setActionDialog({ type: 'review', appId: app.id })}
                            className="rounded bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500"
                          >
                            Score Packet
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: DIRECTOR DECISION QUEUE */}
        {/* ==================================================================== */}
        {activeTab === 'director' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-navy-950">Director Approval Queue</h2>
              <p className="text-xs text-slate-500 mt-1">
                Final approval or rejection authority for recommended internship & project work candidates.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Application No</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Level</th>
                    <th className="p-3">Topic</th>
                    <th className="p-3">Committee Score</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(applicationsQuery.data?.applications ?? [])
                    .filter((a) => a.status === 'DIRECTOR_DECISION')
                    .map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-mono font-bold text-navy-950">{app.applicationNo}</td>
                        <td className="p-3 font-semibold">{app.studentName}</td>
                        <td className="p-3">{app.level}</td>
                        <td className="p-3">{app.topic}</td>
                        <td className="p-3 font-bold text-teal-700">{app.averageScore ?? '—'}/100</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setActionDialog({ type: 'decide', appId: app.id })}
                            className="rounded bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500"
                          >
                            Approve / Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: SECURITY DESK */}
        {/* ==================================================================== */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-navy-950">Security & Reporting Day Desk</h2>
              <p className="text-xs text-slate-500 mt-1">
                Verify original Police Clearance Certificates (PCC) and photo IDs; issue gate security passes.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Application No</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Security Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(applicationsQuery.data?.applications ?? [])
                    .filter((a) => a.status === 'ACCEPTED' || a.status === 'DOCUMENT_VERIFIED')
                    .map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-mono font-bold text-navy-950">{app.applicationNo}</td>
                        <td className="p-3 font-semibold">{app.studentName}</td>
                        <td className="p-3"><span className="chip border-teal-200 bg-teal-50 text-teal-800 font-bold">{app.status}</span></td>
                        <td className="p-3 text-right space-x-2">
                          {app.status === 'ACCEPTED' && (
                            <button
                              onClick={() => verifyJoiningMut.mutate(app.id)}
                              className="rounded bg-emerald-700 px-3 py-1 font-semibold text-white hover:bg-emerald-800"
                            >
                              Verify PCC & ID
                            </button>
                          )}
                          {app.status === 'DOCUMENT_VERIFIED' && (
                            <button
                              onClick={() => setActionDialog({ type: 'pass', appId: app.id })}
                              className="rounded bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500"
                            >
                              Issue Pass
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 7: GUIDE ATTENDANCE */}
        {/* ==================================================================== */}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-navy-950">Guide Trainee Management</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter monthly attendance records and give final clearance upon 100% attendance and report submission.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Application No</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Topic</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(applicationsQuery.data?.applications ?? [])
                    .filter((a) => a.status === 'IN_TRAINING')
                    .map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-mono font-bold text-navy-950">{app.applicationNo}</td>
                        <td className="p-3 font-semibold">{app.studentName}</td>
                        <td className="p-3">{app.topic}</td>
                        <td className="p-3"><span className="chip border-teal-200 bg-teal-50 text-teal-800 font-bold">{app.status}</span></td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => setActionDialog({ type: 'attendance', appId: app.id })}
                            className="rounded bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500"
                          >
                            Record Attendance
                          </button>
                          <button
                            onClick={() => completeTrainingMut.mutate(app.id)}
                            className="rounded bg-emerald-700 px-3 py-1 font-semibold text-white hover:bg-emerald-800"
                          >
                            Guide Clearance
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8: AUDIT TRAIL */}
        {/* ==================================================================== */}
        {activeTab === 'audit' && auditQuery.data && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-navy-950">System Audit Trail Log</h2>
              <p className="text-xs text-slate-500 mt-1">
                Cryptographically tracked log of all status transitions, casework mutations, and authentication events.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditQuery.data.logs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{new Date(log.at).toLocaleString()}</td>
                      <td className="p-3 font-medium">{log.actor?.name ?? log.actorRole}</td>
                      <td className="p-3"><span className="chip border-slate-200 bg-slate-50 font-bold">{log.actorRole}</span></td>
                      <td className="p-3 font-bold text-teal-800">{log.action}</td>
                      <td className="p-3 font-mono">{log.entity}</td>
                      <td className="p-3 font-mono text-slate-500">{log.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8a: MONTHLY ATTENDANCE REPORT */}
        {/* ==================================================================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* A GUIDE has attendance:write but not reporting:read, so it reaches
                this tab for the import panel only; the register stays gated. */}
            {permissions.includes('reporting:read') && (
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-navy-950">Monthly attendance register</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Entered by guides. 100% attendance is required for the completion certificate.
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="label" htmlFor="attendance-month">Month</label>
                    <input
                      id="attendance-month"
                      type="month"
                      className="field"
                      value={attendanceMonth}
                      onChange={(event) => setAttendanceMonth(event.target.value)}
                    />
                  </div>
                  <a
                    className="btn inline-flex items-center"
                    href={`/api/staff/casework/attendance/export.csv?month=${attendanceMonth}`}
                  >
                    Export CSV
                  </a>
                </div>
              </div>
            )}

            {permissions.includes('attendance:write') && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Bulk import monthly attendance
                </h3>
                <p className="text-xs text-slate-500">
                  One row per trainee: <code>applicationNo,month,presentDays,totalDays</code>. A header row is
                  ignored. Rows that fail are reported back without stopping the rest.
                </p>
                <textarea
                  className="field font-mono text-xs"
                  rows={4}
                  aria-label="Attendance CSV"
                  value={attendanceCsv}
                  onChange={(event) => setAttendanceCsv(event.target.value)}
                  placeholder={'ADA/INT/R/2026/0001,' + attendanceMonth + ',22,22'}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn"
                    disabled={!attendanceCsv.trim() || importAttendanceMut.isPending}
                    onClick={() => importAttendanceMut.mutate()}
                  >
                    {importAttendanceMut.isPending ? 'Importing…' : 'Import CSV'}
                  </button>
                  {staffNotice && <span className="text-xs text-slate-600">{staffNotice}</span>}
                </div>
              </div>
            )}

            {attendanceQuery.isLoading && <p className="text-xs text-slate-500">Loading register…</p>}
            {attendanceQuery.isError && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {(attendanceQuery.error as Error).message}
              </p>
            )}

            {attendanceQuery.data && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Trainees', attendanceQuery.data.summary.trainees],
                    ['Present days', attendanceQuery.data.summary.presentDays],
                    ['Total days', attendanceQuery.data.summary.totalDays],
                    ['Below 100%', attendanceQuery.data.summary.belowFullAttendance],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="mt-1 text-xl font-bold text-navy-950">{String(value)}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-100 font-semibold uppercase text-slate-700">
                      <tr>
                        <th className="p-3">Application</th>
                        <th className="p-3">Trainee</th>
                        <th className="p-3">Level</th>
                        <th className="p-3">Lab</th>
                        <th className="p-3">Present</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendanceQuery.data.entries.map((entry: any) => (
                        <tr key={entry.applicationId}>
                          <td className="p-3 font-mono">{entry.applicationNo ?? '—'}</td>
                          <td className="p-3 font-medium">{entry.studentName}</td>
                          <td className="p-3">{entry.level}</td>
                          <td className="p-3">{entry.labCode}</td>
                          <td className="p-3">{entry.presentDays}</td>
                          <td className="p-3">{entry.totalDays}</td>
                          <td className={`p-3 font-bold ${entry.percent < 100 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {entry.percent}%
                          </td>
                        </tr>
                      ))}
                      {attendanceQuery.data.entries.length === 0 && (
                        <tr>
                          <td className="p-4 text-slate-500" colSpan={7}>
                            No attendance entered for {attendanceMonth} yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8c: STAFF ACCOUNTS */}
        {/* ==================================================================== */}
        {activeTab === 'sponsors' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-navy-950">Sponsor verification queue</h2>
              <p className="mt-1 text-xs text-slate-500">
                Sponsors from another DRDO lab can issue referral codes, but those codes stay inert
                until the employee is verified here. ADA staff are verified on creation.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="p-3">Sponsor</th>
                    <th className="p-3">Official email</th>
                    <th className="p-3">Lab</th>
                    <th className="p-3">Quota</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(sponsorsQuery.data?.sponsors ?? []).map((sponsor) => (
                    <tr key={sponsor.id}>
                      <td className="p-3 font-semibold text-navy-950">{sponsor.fullName}</td>
                      <td className="p-3">{sponsor.officialEmail}</td>
                      <td className="p-3">
                        {sponsor.labCode}
                        <span className="block text-[11px] text-slate-500">{sponsor.labName}</span>
                      </td>
                      <td className="p-3 font-mono">
                        {sponsor.quotaUsed}/{SPONSOR_QUOTA_PER_YEAR}
                      </td>
                      <td className="p-3">
                        <span
                          className={`chip font-bold ${
                            sponsor.verificationStatus === 'VERIFIED'
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : sponsor.verificationStatus === 'PENDING'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                          }`}
                        >
                          {sponsor.verificationStatus}
                        </span>
                      </td>
                      <td className="space-x-2 p-3 text-right">
                        {sponsor.verificationStatus !== 'VERIFIED' && (
                          <button
                            onClick={() => verifySponsorMut.mutate({ id: sponsor.id, decision: 'APPROVE' })}
                            className="rounded bg-teal-600 px-3 py-1 font-semibold text-white hover:bg-teal-500"
                          >
                            Verify
                          </button>
                        )}
                        {sponsor.verificationStatus !== 'REJECTED' && (
                          <button
                            onClick={() => verifySponsorMut.mutate({ id: sponsor.id, decision: 'REJECT' })}
                            className="rounded border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(sponsorsQuery.data?.sponsors ?? []).length === 0 && (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={6}>
                        No sponsors yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-navy-950">Staff accounts</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Create intranet accounts, disable someone who has left, or reset a lost authenticator.
                  A new account enrols its authenticator at first sign-in.
                </p>
              </div>

              <form
                className="grid gap-2 sm:grid-cols-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  createStaffMut.mutate();
                }}
              >
                <input
                  className="field"
                  aria-label="Full name"
                  placeholder="Full name"
                  value={staffForm.name}
                  onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                  required
                  minLength={2}
                />
                <input
                  className="field"
                  type="email"
                  aria-label="Official email"
                  placeholder="name@ada.gov.in"
                  value={staffForm.email}
                  onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
                  required
                />
                <select
                  className="field"
                  aria-label="Role"
                  value={staffForm.role}
                  onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}
                >
                  {(['ADMIN_HR', 'DIRECTOR', 'COMMITTEE', 'SECURITY', 'GUIDE', 'DIRECTORATE_HEAD', 'SPONSOR'] as Role[]).map(
                    (role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ),
                  )}
                </select>
                <input
                  className="field"
                  aria-label="Employee code"
                  placeholder="Employee code"
                  value={staffForm.employeeCode}
                  onChange={(event) => setStaffForm({ ...staffForm, employeeCode: event.target.value })}
                />
                {staffForm.role === 'SPONSOR' && (
                  <select
                    className="field"
                    aria-label="Lab"
                    value={staffForm.labId}
                    onChange={(event) => setStaffForm({ ...staffForm, labId: event.target.value })}
                    required
                  >
                    <option value="">Select lab…</option>
                    {(labsQuery.data?.labs ?? []).map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.code} · {lab.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" className="btn" disabled={createStaffMut.isPending}>
                  {createStaffMut.isPending ? 'Creating…' : 'Create account'}
                </button>
              </form>
              {staffNotice && <p className="text-xs text-slate-600">{staffNotice}</p>}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Authenticator</th>
                    <th className="p-3">Last sign-in</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(staffQuery.data?.users ?? []).map((person: any) => (
                    <tr key={person.id} className={person.isActive ? '' : 'bg-slate-50 text-slate-400'}>
                      <td className="p-3 font-semibold text-slate-900">
                        {person.name}
                        {!person.isActive && <span className="ml-2 chip border-slate-300 bg-white">Disabled</span>}
                      </td>
                      <td className="p-3">{person.email}</td>
                      <td className="p-3">{person.roleLabel ?? person.role}</td>
                      <td className="p-3">
                        {person.authenticatorEnrolled ? (
                          <span className="font-bold text-emerald-700">Enrolled</span>
                        ) : (
                          <span className="text-amber-700">At first sign-in</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {person.lastLoginAt ? new Date(person.lastLoginAt).toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {person.authenticatorEnrolled && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Reset the authenticator for ${person.email}?`)) {
                                resetAuthenticatorMut.mutate(person.id);
                              }
                            }}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Reset authenticator
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => updateStaffMut.mutate({ id: person.id, isActive: !person.isActive })}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {person.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {staffQuery.data?.users?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500">
                        No staff accounts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 9: ACCOUNT & PERMISSIONS */}
        {/* ==================================================================== */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-2">
              <h2 className="text-base font-bold text-navy-950">Active Intranet Session</h2>
              <p className="text-xs text-slate-600"><strong>Name:</strong> {user?.name}</p>
              <p className="text-xs text-slate-600"><strong>Email:</strong> {user?.email}</p>
              <p className="text-xs text-slate-600"><strong>Role:</strong> {ROLE_LABELS[role!]}</p>
              <p className="text-xs text-slate-600"><strong>Employee Code:</strong> {user?.employeeCode ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Effective Server Permissions</h3>
              <div className="flex flex-wrap gap-1.5">
                {permissions.map((p) => (
                  <code key={p} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
                    {p}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* DIALOGS */}
      {/* ==================================================================== */}
      {actionDialog.type === 'assign' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-navy-950 uppercase">Assign Directorate & Committee Batch</h3>
            <div>
              <label className="label">Directorate</label>
              <select
                value={selectedDirectorate}
                onChange={(e) => setSelectedDirectorate(e.target.value)}
                className="field field-normal"
              >
                <option value="">Select Directorate...</option>
                {metaDirectorates.data?.directorates.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Guide / Mentor (Optional)</label>
              <select
                value={selectedGuide}
                onChange={(e) => setSelectedGuide(e.target.value)}
                className="field field-normal"
              >
                <option value="">Assign Guide...</option>
                {metaGuides.data?.guides.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.email})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setActionDialog({ type: null, appId: '' })} className="rounded border px-3 py-1 font-semibold">Cancel</button>
              <button
                onClick={() => assignMut.mutate({ id: actionDialog.appId, directorateId: selectedDirectorate, guideId: selectedGuide || undefined })}
                disabled={!selectedDirectorate || assignMut.isPending}
                className="rounded bg-teal-600 px-4 py-1 font-bold text-white hover:bg-teal-500"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {actionDialog.type === 'return' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-navy-950 uppercase">Return Application For Correction</h3>
            <div>
              <label className="label">Reason / Specific Requirements for Student</label>
              <textarea
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="State clearly what documents or form fields need to be corrected..."
                className="field field-normal"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionDialog({ type: null, appId: '' })} className="rounded border px-3 py-1">Cancel</button>
              <button
                onClick={() => returnAppMut.mutate({ id: actionDialog.appId, reason: reasonInput })}
                disabled={!reasonInput.trim() || returnAppMut.isPending}
                className="rounded bg-amber-600 px-4 py-1 font-bold text-white"
              >
                Return to Student
              </button>
            </div>
          </div>
        </div>
      )}

      {actionDialog.type === 'review' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-navy-950 uppercase">Committee Evaluation Form</h3>
            <div>
              <label className="label">Score (0 to 100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={scoreInput}
                onChange={(e) => setScoreInput(parseInt(e.target.value) || 0)}
                className="field field-normal font-mono"
              />
            </div>
            <div>
              <label className="label">Recommendation</label>
              <select
                value={recommendationInput}
                onChange={(e) => setRecommendationInput(e.target.value as any)}
                className="field field-normal"
              >
                <option value="RECOMMEND">Recommend for Selection</option>
                <option value="NOT_RECOMMEND">Not Recommended</option>
                <option value="REFER">Refer Back for Scrutiny</option>
              </select>
            </div>
            <div>
              <label className="label">Evaluation Remarks</label>
              <textarea
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Remarks regarding candidate suitability and topic..."
                className="field field-normal"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionDialog({ type: null, appId: '' })} className="rounded border px-3 py-1">Cancel</button>
              <button
                onClick={() => submitReviewMut.mutate({ id: actionDialog.appId, score: scoreInput, remarks: reasonInput, recommendation: recommendationInput })}
                className="rounded bg-teal-600 px-4 py-1 font-bold text-white"
              >
                Submit Evaluation
              </button>
            </div>
          </div>
        </div>
      )}

      {actionDialog.type === 'decide' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-navy-950 uppercase">Director Decision</h3>
            <div>
              <label className="label">Notified Reporting Date</label>
              <input
                type="date"
                value={reportingDateInput}
                onChange={(e) => setReportingDateInput(e.target.value)}
                className="field field-normal"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => decideMut.mutate({ id: actionDialog.appId, decision: 'REJECT' })}
                className="rounded bg-rose-600 px-3 py-1 text-white font-bold"
              >
                Reject Application
              </button>
              <button
                onClick={() => decideMut.mutate({ id: actionDialog.appId, decision: 'APPROVE', reportingDate: reportingDateInput })}
                className="rounded bg-emerald-700 px-4 py-1 text-white font-bold"
              >
                Approve & Issue Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {actionDialog.type === 'pass' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-navy-950 uppercase">Issue Gate Security Pass</h3>
            <div>
              <label className="label">Security Pass Number</label>
              <input
                type="text"
                value={passNoInput}
                onChange={(e) => setPassNoInput(e.target.value)}
                className="field field-normal font-mono uppercase"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionDialog({ type: null, appId: '' })} className="rounded border px-3 py-1">Cancel</button>
              <button
                onClick={() => issuePassMut.mutate({ id: actionDialog.appId, passNo: passNoInput })}
                className="rounded bg-teal-600 px-4 py-1 font-bold text-white"
              >
                Issue Pass & Enroll
              </button>
            </div>
          </div>
        </div>
      )}

      {actionDialog.type === 'attendance' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-navy-950 uppercase">Record Monthly Attendance</h3>
            <div>
              <label className="label">Month (YYYY-MM)</label>
              <input
                type="text"
                value={attendanceMonth}
                onChange={(e) => setAttendanceMonth(e.target.value)}
                className="field field-normal font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Present Days</label>
                <input
                  type="number"
                  value={presentDays}
                  onChange={(e) => setPresentDays(parseInt(e.target.value) || 0)}
                  className="field field-normal font-mono"
                />
              </div>
              <div>
                <label className="label">Total Working Days</label>
                <input
                  type="number"
                  value={totalDays}
                  onChange={(e) => setTotalDays(parseInt(e.target.value) || 0)}
                  className="field field-normal font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setActionDialog({ type: null, appId: '' })} className="rounded border px-3 py-1">Cancel</button>
              <button
                onClick={() => attendanceMut.mutate({ id: actionDialog.appId, month: attendanceMonth, presentDays, totalDays })}
                className="rounded bg-teal-600 px-4 py-1 font-bold text-white"
              >
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
