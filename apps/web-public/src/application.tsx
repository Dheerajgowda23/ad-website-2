import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Level } from '@ada/shared';
import { api, ApiError } from './api.js';
import { Navbar } from './Navbar.js';

interface DetailedApplicationView {
  id: string;
  applicationNo: string | null;
  status: string;
  level: Level;
  intakeYear: number;
  lab: { code: string; name: string };
  sponsorName: string | null;
  student: {
    fullName: string | null;
    dob: string | null;
    fatherName: string | null;
    gender: string | null;
    nationality: string;
    email: string;
    phone: string | null;
    altPhone: string | null;
    permanentAddress: string | null;
    localAddress: string | null;
    collegeName: string | null;
    universityName: string | null;
    rollNumber: string | null;
    collegeAddress: string | null;
    category: string | null;
    aadhaarLast4: string | null;
    aadhaarMasked: string;
  };
  academic: {
    discipline: string | null;
    branchCode: string | null;
    degree: string | null;
    semester: string | null;
    yearOfStudy: string | null;
    cgpa: number | null;
  };
  project: {
    durationWeeks: number | null;
    startDate: string | null;
    endDate: string | null;
    topic: string | null;
    synopsis: string | null;
    employeeChildFlag: boolean;
  };
  documents: {
    id: string;
    kind: string;
    version: number;
    sha256: string;
    verifiedBy: string | null;
    verifiedAt: string | null;
    uploadedAt: string;
  }[];
  offer: {
    id: string;
    issuedAt: string;
    reportingDate: string | null;
    acceptedAt: string | null;
    declinedAt: string | null;
  } | null;
  certificate: {
    serialNo: string;
    issuedAt: string;
  } | null;
  revisions: {
    revisionNo: number;
    changedFields: string[];
    sha256: string;
    submittedAt: string;
  }[];
  revision: number;
  submittedAt?: string | null;
  editable: boolean;
  locked: boolean;
  lockNotice: string | null;
}

const STAGES = [
  { key: 'INVITED', label: '1. Invited' },
  { key: 'IN_PROGRESS', label: '2. Form Open' },
  { key: 'SUBMITTED', label: '3. Submitted' },
  { key: 'HR_SCREENING', label: '4. HR Scrutiny' },
  { key: 'COMMITTEE_REVIEW', label: '5. Committee' },
  { key: 'DIRECTOR_DECISION', label: '6. Director' },
  { key: 'OFFER_ISSUED', label: '7. Offer' },
  { key: 'IN_TRAINING', label: '8. In Training' },
  { key: 'CERTIFICATE_ISSUED', label: '9. Completed' },
];

export const ApplicationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'project' | 'docs' | 'review'>('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    fatherName: '',
    gender: 'Male',
    nationality: 'Indian',
    aadhaarLast4: '',
    phone: '',
    altPhone: '',
    permanentAddress: '',
    localAddress: '',
    collegeName: '',
    universityName: '',
    rollNumber: '',
    collegeAddress: '',
    category: 'GENERAL',
    discipline: '',
    branchCode: '',
    degree: 'B.Tech',
    semester: '6th',
    yearOfStudy: '3rd Year',
    cgpa: 8.0,
    durationWeeks: 16,
    startDate: '2026-06-01',
    endDate: '2026-09-20',
    topic: '',
    synopsis: '',
    employeeChildFlag: false,
    declarationSigned: false,
  });

  const appQuery = useQuery<{ application: DetailedApplicationView }>({
    queryKey: ['application'],
    queryFn: () => api<{ application: DetailedApplicationView }>('/api/public/application'),
  });

  const app = appQuery.data?.application;

  useEffect(() => {
    if (appQuery.error instanceof ApiError && appQuery.error.status === 401) {
      navigate('/login', { replace: true });
    }
  }, [appQuery.error, navigate]);

  useEffect(() => {
    if (app) {
      setFormData({
        fullName: app.student.fullName ?? '',
        dob: app.student.dob ?? '',
        fatherName: app.student.fatherName ?? '',
        gender: app.student.gender ?? 'Male',
        nationality: app.student.nationality ?? 'Indian',
        aadhaarLast4: app.student.aadhaarLast4 ?? '',
        phone: app.student.phone ?? '',
        altPhone: app.student.altPhone ?? '',
        permanentAddress: app.student.permanentAddress ?? '',
        localAddress: app.student.localAddress ?? '',
        collegeName: app.student.collegeName ?? '',
        universityName: app.student.universityName ?? '',
        rollNumber: app.student.rollNumber ?? '',
        collegeAddress: app.student.collegeAddress ?? '',
        category: app.student.category ?? 'GENERAL',
        discipline: app.academic.discipline ?? '',
        branchCode: app.academic.branchCode ?? '',
        degree: app.academic.degree ?? (app.level === 'UG' ? 'B.Tech' : 'M.Tech'),
        semester: app.academic.semester ?? '6th',
        yearOfStudy: app.academic.yearOfStudy ?? '3rd Year',
        cgpa: app.academic.cgpa ?? 8.0,
        durationWeeks: app.project.durationWeeks ?? (app.level === 'UG' ? 16 : 30),
        startDate: app.project.startDate ?? '2026-06-01',
        endDate: app.project.endDate ?? '2026-09-20',
        topic: app.project.topic ?? '',
        synopsis: app.project.synopsis ?? '',
        employeeChildFlag: app.project.employeeChildFlag ?? false,
        declarationSigned: app.status !== 'IN_PROGRESS',
      });
    }
  }, [app]);

  // Mutations
  // Empty strings are not valid phone/dob/aadhaar values for the draft schema,
  // so a half-filled step is saved as nulls instead of failing validation.
  const draftPayload = (data: typeof formData) => ({
    ...data,
    dob: data.dob || null,
    aadhaarLast4: data.aadhaarLast4 || null,
    phone: data.phone || null,
    altPhone: data.altPhone || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
  });

  const saveDraftMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api('/api/public/application/draft', {
        method: 'PUT',
        body: JSON.stringify(draftPayload(data)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application'] });
      setSaveNotice('Draft saved');
    },
    onError: (err: any) => setFormError(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) =>
      api('/api/public/application/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['application'] });
    },
    onError: (err: any) => setFormError(err.message),
  });

  const editMutation = useMutation({
    mutationFn: (data: any) =>
      api('/api/public/application', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['application'] });
      alert('Application revision saved successfully');
    },
    onError: (err: any) => setFormError(err.message),
  });

  const respondOfferMutation = useMutation({
    mutationFn: (response: 'ACCEPT' | 'DECLINE') =>
      api('/api/public/application/offer/respond', {
        method: 'POST',
        body: JSON.stringify({ response }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application'] });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: (doc: any) =>
      api('/api/public/application/documents', {
        method: 'POST',
        body: JSON.stringify(doc),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application'] });
      alert('Document uploaded successfully');
    },
    onError: (err: any) => setFormError(err.message),
  });

  const signOutMutation = useMutation({
    mutationFn: () => api('/api/public/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => api('/api/public/application/withdraw', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application'] });
      alert('Your application has been withdrawn.');
    },
    onError: (err: any) => setFormError(err.message),
  });

  const handleFileUpload = (kind: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadDocMutation.mutate({
        kind,
        fileName: file.name,
        mime: file.type || 'application/pdf',
        size: file.size,
        contentBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const wordCount = formData.synopsis.trim() ? formData.synopsis.trim().split(/\s+/).length : 0;

  // Step navigation: every move forward saves the packet first, so no screen
  // silently loses what was typed on it.
  const steps = ['personal', 'academic', 'project', 'docs', 'review'] as const;
  const stepIndex = steps.indexOf(activeTab);

  const goToStep = (index: number) => {
    setFormError(null);
    setSaveNotice(null);
    setActiveTab(steps[Math.max(0, Math.min(steps.length - 1, index))] ?? 'personal');
  };

  const saveAndNext = async () => {
    try {
      await saveDraftMutation.mutateAsync(formData);
      goToStep(stepIndex + 1);
    } catch {
      // Save failed; formError is already populated by the mutation.
    }
  };

  // Dates: the end date follows the start date plus the chosen duration, and a
  // start date in the past is not allowed.
  const addWeeks = (iso: string, weeks: number) => {
    if (!iso) return '';
    const date = new Date(`${iso}T00:00:00`);
    date.setDate(date.getDate() + weeks * 7);
    return date.toISOString().slice(0, 10);
  };
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateRangeInvalid = Boolean(
    formData.startDate && formData.endDate && formData.endDate <= formData.startDate,
  );

  if (appQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading your application...</p>
      </div>
    );
  }

  if (!app) return null;

  const showForm = app.status === 'IN_PROGRESS' || isEditing || app.status === 'RETURNED_FOR_CORRECTION';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-5xl flex-1 px-6 py-8 space-y-6">
        {/* Top Header Card */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
                {app.applicationNo ?? 'Application Number Allocated On Submission'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-navy-950">
                {app.student.fullName || 'New Application'}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {app.level} Internship · {app.lab.name} ({app.lab.code}) · Intake Year {app.intakeYear} · Referred by {app.sponsorName ?? 'Employee'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-teal-600/30 bg-teal-50 text-teal-700 font-bold px-3 py-1 text-xs">
                {app.status}
              </span>

              {app.status !== 'IN_PROGRESS' && (
                <a
                  href="/api/public/application/documents/summary-pdf"
                  download={`ADA-Application-${app.applicationNo || 'Summary'}.pdf`}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Summary PDF
                </a>
              )}

              {!['WITHDRAWN', 'CANCELLED', 'CERTIFICATE_ISSUED'].includes(app.status) && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to withdraw your application? This cannot be undone.')) {
                      withdrawMutation.mutate();
                    }
                  }}
                  className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                >
                  Withdraw
                </button>
              )}

              <button
                type="button"
                onClick={() => signOutMutation.mutate()}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 underline ml-2"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* 9-Stage Visual Progress Tracker */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1 text-center">
              {STAGES.map((s, idx) => {
                const isPassed = app.status === s.key || STAGES.findIndex(st => st.key === app.status) >= idx;
                const isCurrent = app.status === s.key;
                return (
                  <div
                    key={s.key}
                    className={`rounded p-1.5 text-[10px] font-medium border ${
                      isCurrent
                        ? 'border-teal-600 bg-teal-600 text-white font-bold'
                        : isPassed
                        ? 'border-teal-200 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alerts / Notices */}
          {app.status === 'RETURNED_FOR_CORRECTION' && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
              <p className="font-bold uppercase tracking-wider">Application Returned by Admin & HR for Correction</p>
              <p className="mt-1">Please review the remarks, modify the required fields, and resubmit.</p>
            </div>
          )}

          {app.lockNotice && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-100 p-3 text-xs text-slate-700 flex items-center justify-between">
              <span>{app.lockNotice}</span>
              <span className="font-bold text-slate-900 uppercase tracking-wider">Locked</span>
            </div>
          )}

          {/* Offer Banner */}
          {app.status === 'OFFER_ISSUED' && app.offer && (
            <div className="mt-4 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-5 text-emerald-950">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">Internship Training Offer Issued!</h3>
                  <p className="mt-1 text-xs">
                    Reporting Date:{' '}
                    <strong>{app.offer.reportingDate ? new Date(app.offer.reportingDate).toLocaleDateString() : 'To be notified'}</strong>
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Please bring original Police Clearance Certificate (PCC) and College ID on reporting day.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/api/public/application/documents/offer-letter"
                    download={`ADA-Offer-${app.applicationNo || 'Letter'}.pdf`}
                    className="rounded-md border border-emerald-600 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
                  >
                    Download Offer Letter (PDF)
                  </a>
                  <button
                    type="button"
                    onClick={() => respondOfferMutation.mutate('ACCEPT')}
                    disabled={respondOfferMutation.isPending}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition"
                  >
                    Accept Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => respondOfferMutation.mutate('DECLINE')}
                    disabled={respondOfferMutation.isPending}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Accepted Offer Details Banner */}
          {app.offer && app.offer.acceptedAt && (
            <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50/70 p-4 text-emerald-950 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs uppercase tracking-wide text-emerald-800">Provisional Offer Formally Accepted</span>
                <p className="text-xs text-slate-600 mt-0.5">
                  Reporting Date: <strong>{app.offer.reportingDate ? new Date(app.offer.reportingDate).toLocaleDateString() : 'Scheduled'}</strong> · Please report to ADA Reception Desk with PCC and original credentials.
                </p>
              </div>
              <a
                href="/api/public/application/documents/offer-letter"
                download={`ADA-Offer-${app.applicationNo || 'Letter'}.pdf`}
                className="rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
              >
                Download Offer Letter (PDF)
              </a>
            </div>
          )}

          {/* Certificate Banner */}
          {app.certificate && (
            <div className="mt-4 rounded-lg border-2 border-teal-600 bg-teal-50 p-5 text-teal-950">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-teal-900">Certificate of Completion Issued!</h3>
                  <p className="mt-1 text-xs">
                    Serial Number: <strong className="font-mono text-navy-950">{app.certificate.serialNo}</strong> · Issued on {new Date(app.certificate.issuedAt).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-teal-800 mt-0.5">
                    Your training certificate is officially registered with a cryptographic QR code for online verification.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/api/public/application/documents/certificate"
                    download={`ADA-Certificate-${app.certificate.serialNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`}
                    className="rounded-md bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition"
                  >
                    Download Certificate (PDF)
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate(`/verify?serial=${encodeURIComponent(app.certificate!.serialNo)}`)}
                    className="rounded-md border border-teal-700 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 transition"
                  >
                    Verify Authenticity
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {formError && (
          <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {formError}
          </div>
        )}

        {/* Content: Either Multi-Step Form or Summary View */}
        {showForm ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex border-b border-slate-200 pb-3 gap-2">
              {[
                { key: 'personal', label: '1. Personal Details' },
                { key: 'academic', label: '2. Academic Details' },
                { key: 'project', label: '3. Project & Synopsis' },
                { key: 'docs', label: '4. Document Checklist' },
                { key: 'review', label: '5. Review & Submit' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeTab === tab.key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Personal Details */}
            {activeTab === 'personal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="label">Full Name (as per matriculation certificate)</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Father's Name</label>
                  <input
                    type="text"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="field field-normal"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Nationality</label>
                  <input type="text" value={formData.nationality} readOnly className="field field-normal bg-slate-50" />
                </div>
                <div>
                  <label className="label">Aadhaar (Last 4 Digits Only)</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={formData.aadhaarLast4}
                    onChange={(e) => setFormData({ ...formData, aadhaarLast4: e.target.value })}
                    required
                    className="field field-normal font-mono"
                  />
                </div>
                <div>
                  <label className="label">Mobile Phone (10 digits)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Alternative Phone</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formData.altPhone}
                    onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                    className="field field-normal"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Permanent Address</label>
                  <textarea
                    rows={2}
                    value={formData.permanentAddress}
                    onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Local / Residential Address (in Bengaluru if applicable)</label>
                  <textarea
                    rows={2}
                    value={formData.localAddress}
                    onChange={(e) => setFormData({ ...formData, localAddress: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Academic Details */}
            {activeTab === 'academic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2 border-b border-slate-100 pb-1">
                  <h4 className="font-bold text-navy-950 uppercase tracking-wide">
                    College / Institution
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Printed on your recommendation letter, offer letter and certificate.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="label">College / Institution Name (as on letterhead)</label>
                  <input
                    type="text"
                    placeholder="e.g. BMS College of Engineering, Bengaluru"
                    value={formData.collegeName}
                    onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">University / Board</label>
                  <input
                    type="text"
                    placeholder="e.g. Visvesvaraya Technological University"
                    value={formData.universityName}
                    onChange={(e) => setFormData({ ...formData, universityName: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">University Roll / Enrolment Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 1BM21AE045"
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })}
                    required
                    className="field field-normal font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="field field-normal"
                  >
                    <option value="GENERAL">General</option>
                    <option value="EWS">EWS</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">College Address (with PIN)</label>
                  <textarea
                    rows={2}
                    placeholder="Department, college, place, PIN"
                    value={formData.collegeAddress}
                    onChange={(e) => setFormData({ ...formData, collegeAddress: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>

                <div className="md:col-span-2 border-b border-slate-100 pb-1 pt-2">
                  <h4 className="font-bold text-navy-950 uppercase tracking-wide">Course Details</h4>
                </div>
                <div>
                  <label className="label">Discipline / Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Aeronautical / Computer Science"
                    value={formData.discipline}
                    onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Branch Code</label>
                  <input
                    type="text"
                    placeholder="e.g. AE, CSE, ECE"
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    required
                    className="field field-normal uppercase"
                  />
                </div>
                <div>
                  <label className="label">Degree</label>
                  <select
                    value={formData.degree}
                    onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                    className="field field-normal"
                  >
                    <option value="B.Tech">B.Tech</option>
                    <option value="B.E.">B.E.</option>
                    <option value="M.Tech">M.Tech</option>
                    <option value="M.E.">M.E.</option>
                  </select>
                </div>
                <div>
                  <label className="label">Current Semester</label>
                  <input
                    type="text"
                    placeholder="e.g. 6th Semester"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Year of Study</label>
                  <input
                    type="text"
                    placeholder="e.g. 3rd Year"
                    value={formData.yearOfStudy}
                    onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>
                <div>
                  <label className="label">Average CGPA (Scale of 10.0)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={formData.cgpa}
                    onChange={(e) => setFormData({ ...formData, cgpa: parseFloat(e.target.value) || 0 })}
                    required
                    className="field field-normal font-mono"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Project & Synopsis */}
            {activeTab === 'project' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Duration (in Weeks)</label>
                    <input
                      type="number"
                      min={app.level === 'PG' ? 24 : 12}
                      max={app.level === 'PG' ? 52 : 20}
                      value={formData.durationWeeks}
                      onChange={(e) => {
                        const durationWeeks = parseInt(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          durationWeeks,
                          endDate:
                            formData.startDate && durationWeeks > 0
                              ? addWeeks(formData.startDate, durationWeeks)
                              : formData.endDate,
                        });
                      }}
                      required
                      className="field field-normal font-mono"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      {app.level === 'PG' ? 'PG: 24-52 weeks (6-12 months)' : 'UG: 12-20 weeks'}
                    </p>
                  </div>
                  <div>
                    <label className="label">Proposed Start Date</label>
                    <input
                      type="date"
                      min={todayIso}
                      value={formData.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        setFormData({
                          ...formData,
                          startDate,
                          endDate: startDate
                            ? addWeeks(startDate, formData.durationWeeks)
                            : formData.endDate,
                        });
                      }}
                      required
                      className="field field-normal"
                    />
                  </div>
                  <div>
                    <label className="label">Proposed End Date</label>
                    <input
                      type="date"
                      min={formData.startDate || todayIso}
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      className="field field-normal"
                    />
                  </div>
                </div>
                <p className={`text-[11px] ${dateRangeInvalid ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                  {dateRangeInvalid
                    ? 'The end date must fall after the start date.'
                    : 'The end date is filled in automatically from the start date and duration; adjust it only if your college has fixed dates.'}
                </p>

                <div>
                  <label className="label">Project Title / Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Computational Fluid Dynamics on Transonic Delta Wings"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    required
                    className="field field-normal"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="label">Project Synopsis (Mandatory Annexure-I: Max 150 words)</label>
                    <span className={`text-[11px] font-mono font-bold ${wordCount > 150 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {wordCount} / 150 words
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Briefly summarize proposed project objectives, methodology, and relevance to aerospace engineering..."
                    value={formData.synopsis}
                    onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                    required
                    className={`field field-normal ${wordCount > 150 ? 'border-rose-400 ring-2 ring-rose-200' : ''}`}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="empChild"
                    checked={formData.employeeChildFlag}
                    onChange={(e) => setFormData({ ...formData, employeeChildFlag: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="empChild" className="text-slate-700 cursor-pointer">
                    I am a ward / child of an ADA or DRDO employee
                  </label>
                </div>
              </div>
            )}

            {/* Tab 4: Documents Checklist */}
            {activeTab === 'docs' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-md border border-slate-200 p-4 bg-slate-50">
                  <h4 className="font-bold text-navy-950 uppercase tracking-wide">Required Scanned Documents</h4>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    Upload clear scanned PDFs or images. Per Non-negotiable Rule 10, an application without a signed and sealed college recommendation letter cannot pass screening.
                  </p>
                </div>

                {/* Pre-filled Template Download Box */}
                <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-navy-950">Pre-filled College Recommendation Letter (Annexure-II)</h5>
                    <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
                      Download your pre-filled letter, get it printed on College Letterhead, signed and sealed by Principal / Head of Institution, then scan and upload it below.
                    </p>
                  </div>
                  <a
                    href="/api/public/application/documents/recommendation-template"
                    download="ADA-College-Recommendation-Template.pdf"
                    className="shrink-0 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 transition inline-flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Pre-filled PDF
                  </a>
                </div>

                <div className="space-y-3">
                  {[
                    { kind: 'COLLEGE_LETTER', label: 'College Recommendation Letter (Signed & Sealed on College Letterhead)', mandatory: true },
                    { kind: 'PHOTO', label: 'Passport Photo of Candidate', mandatory: false },
                    { kind: 'UNDERTAKING', label: 'Signed Student Undertaking', mandatory: false },
                  ].map((docType) => {
                    const existing = app.documents.find(d => d.kind === docType.kind);
                    return (
                      <div key={docType.kind} className="rounded border border-slate-200 p-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {docType.label} {docType.mandatory && <span className="text-rose-600">*</span>}
                          </p>
                          {existing ? (
                            <p className="text-[11px] text-emerald-700 mt-0.5">
                              ✓ Uploaded (v{existing.version}) on {new Date(existing.uploadedAt).toLocaleDateString()}
                              {existing.verifiedAt && ' · Verified by Admin & HR'}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-0.5">Not uploaded yet</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="file"
                            id={`file-${docType.kind}`}
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleFileUpload(docType.kind, e.target.files[0]);
                            }}
                          />
                          <label
                            htmlFor={`file-${docType.kind}`}
                            className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            {existing ? 'Upload New Version' : 'Upload File'}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 5: Review & Submit */}
            {activeTab === 'review' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <h4 className="font-bold text-navy-950 uppercase tracking-wide">Review Submission Summary</h4>
                  <p><strong>Candidate:</strong> {formData.fullName} ({formData.gender}, {formData.dob})</p>
                  <p><strong>College:</strong> {formData.collegeName} · {formData.universityName} · Roll {formData.rollNumber}</p>
                  <p><strong>Academic:</strong> {formData.degree} in {formData.discipline} ({formData.semester}) · CGPA: {formData.cgpa} · Category: {formData.category}</p>
                  <p><strong>Internship:</strong> {formData.topic} ({formData.durationWeeks} weeks, {formData.startDate} to {formData.endDate})</p>
                  <p><strong>College Letter:</strong> {app.documents.some(d => d.kind === 'COLLEGE_LETTER') ? 'Uploaded' : 'MISSING'}</p>
                </div>

                <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="decl"
                      checked={formData.declarationSigned}
                      onChange={(e) => setFormData({ ...formData, declarationSigned: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <label htmlFor="decl" className="text-slate-800 leading-relaxed cursor-pointer">
                      I hereby certify that all information submitted is true and complete. I understand that admission is referral-only, strictly without stipend, and subject to 100% attendance, security clearance, and guide clearance.
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500">
                    Save Draft below keeps your work; nothing is submitted until you press Submit.
                  </span>

                  {app.status === 'SUBMITTED' ? (
                    <button
                      type="button"
                      onClick={() => editMutation.mutate({ ...formData, revision: app.revision })}
                      disabled={editMutation.isPending || wordCount > 150}
                      className="rounded-md bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-500"
                    >
                      Save Revision ({app.revision + 1})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => submitMutation.mutate(formData)}
                      disabled={
                        submitMutation.isPending ||
                        !formData.declarationSigned ||
                        wordCount > 150 ||
                        dateRangeInvalid
                      }
                      className="rounded-md bg-teal-600 px-6 py-2 font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                    >
                      {submitMutation.isPending ? 'Submitting...' : 'Submit Application'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step controls: Back, Save Draft, Save & Next */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(stepIndex - 1)}
                  disabled={stepIndex === 0}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => saveDraftMutation.mutate(formData)}
                  disabled={saveDraftMutation.isPending}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {saveDraftMutation.isPending ? 'Saving…' : 'Save Draft'}
                </button>
                {saveNotice && (
                  <span role="status" className="text-[11px] font-semibold text-emerald-700">
                    ✓ {saveNotice}
                  </span>
                )}
              </div>

              {stepIndex < steps.length - 1 && (
                <button
                  type="button"
                  onClick={saveAndNext}
                  disabled={saveDraftMutation.isPending}
                  className="rounded-md bg-teal-600 px-5 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  Save &amp; Next →
                </button>
              )}
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-navy-950">Submitted Application Packet</h2>
                  <p className="text-xs text-slate-500">Revision #{app.revision} · Submitted {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}</p>
                </div>
                {app.editable && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-md bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
                  >
                    Edit Application
                  </button>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">Student Particulars</h3>
                  <dl className="divide-y divide-slate-100">
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-semibold text-navy-950">{app.student.fullName}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Date of Birth</dt><dd className="text-slate-900">{app.student.dob}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Aadhaar (Masked)</dt><dd className="font-mono text-slate-900">{app.student.aadhaarMasked}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Email</dt><dd className="text-slate-900">{app.student.email}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="text-slate-900">{app.student.phone}</dd></div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">Academic & Training Details</h3>
                  <dl className="divide-y divide-slate-100">
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">College</dt><dd className="text-right text-slate-900 max-w-[220px]">{app.student.collegeName ?? '—'}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">University / Roll No</dt><dd className="text-right text-slate-900 max-w-[220px]">{app.student.universityName ?? '—'} · {app.student.rollNumber ?? '—'}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Category</dt><dd className="text-slate-900">{app.student.category ?? '—'}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Degree & Discipline</dt><dd className="text-slate-900">{app.academic.degree} · {app.academic.discipline}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">CGPA</dt><dd className="font-mono font-bold text-slate-900">{app.academic.cgpa}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="text-slate-900">{app.project.durationWeeks} Weeks</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Proposed Dates</dt><dd className="text-slate-900">{app.project.startDate} to {app.project.endDate}</dd></div>
                    <div className="py-1.5 flex justify-between"><dt className="text-slate-500">Topic</dt><dd className="font-medium text-navy-950 text-right max-w-[200px]">{app.project.topic}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4 text-xs">
                <h4 className="font-bold text-slate-900 mb-1">Project Synopsis</h4>
                <p className="text-slate-600 bg-slate-50 p-3 rounded leading-relaxed">{app.project.synopsis}</p>
              </div>
            </div>

            {/* Revisions History Card */}
            {app.revisions && app.revisions.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm text-xs">
                <h3 className="font-bold text-navy-950 uppercase tracking-wide mb-3">Revision Audit Trail (Immutable)</h3>
                <div className="space-y-2">
                  {app.revisions.map((rev) => (
                    <div key={rev.revisionNo} className="flex justify-between items-center rounded border border-slate-200 p-2.5 bg-slate-50">
                      <div>
                        <span className="font-bold text-teal-700">Revision #{rev.revisionNo}</span>
                        <span className="text-slate-500 ml-2">Fields: {rev.changedFields.join(', ')}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(rev.submittedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
