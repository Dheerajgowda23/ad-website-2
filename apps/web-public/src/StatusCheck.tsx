import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from './Navbar.js';
import { api, ApiError } from './api.js';

interface StatusResult {
  applicationNo: string;
  candidateName: string;
  lab: string;
  level: string;
  status: string;
  submittedAt: string | null;
}

export const StatusCheckPage = () => {
  const [appNo, setAppNo] = useState('');
  const [dob, setDob] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<{ appNo: string; dob: string } | null>(null);

  const statusQuery = useQuery<StatusResult>({
    queryKey: ['statusCheck', submittedQuery?.appNo, submittedQuery?.dob],
    queryFn: () =>
      api<StatusResult>(
        `/api/public/info/status-check?applicationNo=${encodeURIComponent(submittedQuery!.appNo)}&dob=${encodeURIComponent(submittedQuery!.dob)}`,
      ),
    enabled: Boolean(submittedQuery?.appNo && submittedQuery?.dob),
    retry: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (appNo.trim() && dob.trim()) {
      setSubmittedQuery({ appNo: appNo.trim().toUpperCase(), dob: dob.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-xl flex-1 px-6 py-12 w-full space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold text-navy-950">Application Status Tracking</h1>
            <p className="mt-1 text-xs text-slate-500">
              Check the current processing status of your submitted application
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Application Number</label>
              <input
                type="text"
                placeholder="ADA/INT/R/2026/0001"
                value={appNo}
                onChange={(e) => setAppNo(e.target.value)}
                required
                className="field field-normal uppercase"
              />
            </div>

            <div>
              <label className="label">Date of Birth (as in official record)</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className="field field-normal"
              />
            </div>

            <button type="submit" disabled={statusQuery.isLoading} className="btn mt-2">
              {statusQuery.isLoading ? 'Checking...' : 'Check Status'}
            </button>
          </form>

          {statusQuery.isError && (
            <div className="mt-6 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {statusQuery.error instanceof ApiError
                ? statusQuery.error.message
                : 'No record found matching the provided application number and date of birth.'}
            </div>
          )}

          {statusQuery.data && (
            <div className="mt-6 border-t border-slate-200 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Processing Stage</span>
                <span className="chip border-teal-600/30 bg-teal-50 text-teal-700 font-bold">
                  {statusQuery.data.status}
                </span>
              </div>

              <dl className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between">
                  <dt className="text-slate-500">Applicant Name</dt>
                  <dd className="font-medium text-slate-900">{statusQuery.data.candidateName}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-slate-500">Application No</dt>
                  <dd className="font-mono font-medium text-slate-900">{statusQuery.data.applicationNo}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-slate-500">Category & Level</dt>
                  <dd className="font-medium text-slate-900">{statusQuery.data.level}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-slate-500">Referring Establishment</dt>
                  <dd className="font-medium text-slate-900">{statusQuery.data.lab}</dd>
                </div>
                {statusQuery.data.submittedAt && (
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Submission Date</dt>
                    <dd className="text-slate-900">
                      {new Date(statusQuery.data.submittedAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
