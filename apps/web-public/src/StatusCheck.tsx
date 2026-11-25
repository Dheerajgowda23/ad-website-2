import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
    <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans">
      {/* Top classification header */}
      <div className="border-b border-slate-200 bg-slate-900 text-slate-300 text-[11px] py-2 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <span className="font-medium text-slate-300">APPLICATION TRACKING DOSSIER</span>
          <span className="font-mono text-[10px] text-slate-400">LOOKUP: REAL-TIME SECURE QUERY</span>
        </div>
      </div>

      <Navbar />

      <main className="mx-auto max-w-xl flex-1 px-6 py-12 w-full space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-blue-700 font-bold block mb-1">
              // STATUS VERIFICATION
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Application Status Tracking</h1>
            <p className="mt-2 text-xs text-slate-500">
              Query current screening, Directorate confirmation, and security clearance status.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Application Number</label>
              <input
                type="text"
                placeholder="ADA/INT/R/2026/0001"
                value={appNo}
                onChange={(e) => setAppNo(e.target.value.toUpperCase())}
                required
                className="field font-mono"
              />
            </div>

            <div>
              <label className="label">Date of Birth</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className="field field-normal"
              />
            </div>

            <button
              type="submit"
              disabled={statusQuery.isFetching}
              className="btn mt-2"
            >
              {statusQuery.isFetching ? 'Querying Database…' : 'Search Dossier Status →'}
            </button>
          </form>

          {statusQuery.isLoading && (
            <div className="mt-6 text-center text-xs font-mono text-blue-600 animate-pulse">
              [Fetching application records]...
            </div>
          )}

          {statusQuery.isError && (
            <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-2">
              <p className="font-mono font-bold">
                [LOOKUP_ERROR]: {(statusQuery.error as ApiError).message || 'No matching application record found.'}
              </p>
              {(statusQuery.error as ApiError).code === 'APPLICATION_NOT_FOUND' ? (
                <p className="leading-relaxed text-red-700">
                  An application number is issued only when you submit. If you have not submitted yet,
                  open{' '}
                  <Link to="/application" className="underline font-semibold">
                    My Application
                  </Link>{' '}
                  and sign in with your registered email. If you have submitted, copy the number
                  exactly as printed (for example ADA/INT/R/2026/0001) and use the same date of birth
                  you entered in the form.
                </p>
              ) : (
                <p className="leading-relaxed text-red-700">
                  The lookup could not be completed just now. Please try again in a moment.
                </p>
              )}
            </div>
          )}

          {statusQuery.isSuccess && statusQuery.data && (
            <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50/50 p-5 space-y-3 font-mono text-xs text-slate-800">
              <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                <span className="text-slate-500">APPLICATION NO:</span>
                <span className="font-bold text-slate-900">{statusQuery.data.applicationNo}</span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                <span className="text-slate-500">CANDIDATE:</span>
                <span className="font-bold text-slate-900">{statusQuery.data.candidateName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                <span className="text-slate-500">LAB / DIVISION:</span>
                <span className="font-bold text-slate-900">{statusQuery.data.lab}</span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                <span className="text-slate-500">LEVEL:</span>
                <span className="font-bold text-slate-900">{statusQuery.data.level}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">STAGE STATUS:</span>
                <span className="font-bold text-blue-700 uppercase tracking-wider">
                  {statusQuery.data.status}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Aeronautical Development Agency · P.B. No. 1718, Vimanapura Post, Bengaluru 560017
      </footer>
    </div>
  );
};
