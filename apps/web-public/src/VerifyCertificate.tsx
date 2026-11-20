import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from './Navbar.js';
import { api, ApiError } from './api.js';

interface CertificateResult {
  valid: boolean;
  serialNo: string;
  issuedAt: string;
  traineeName: string;
  degree: string | null;
  discipline: string | null;
  topic: string | null;
  lab: string;
  startDate: string | null;
  endDate: string | null;
}

export const VerifyCertificatePage = () => {
  const [serialNo, setSerialNo] = useState('');
  const [searchSerial, setSearchSerial] = useState('');

  const certQuery = useQuery<CertificateResult>({
    queryKey: ['verifyCertificate', searchSerial],
    queryFn: () =>
      api<CertificateResult>(
        `/api/public/info/certificates/verify/${encodeURIComponent(searchSerial)}`,
      ),
    enabled: Boolean(searchSerial),
    retry: false,
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (serialNo.trim()) {
      setSearchSerial(serialNo.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-xl flex-1 px-6 py-12 w-full space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold text-navy-950">Public Certificate Verification</h1>
            <p className="mt-1 text-xs text-slate-500">
              Verify the authenticity of an ADA Internship / Project Training Certificate
            </p>
          </div>

          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <label className="label">Certificate Serial Number</label>
              <input
                type="text"
                placeholder="ADA/CERT/2026/0001"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                required
                className="field field-normal uppercase font-mono"
              />
            </div>

            <button type="submit" disabled={certQuery.isLoading} className="btn mt-2">
              {certQuery.isLoading ? 'Verifying...' : 'Verify Authenticity'}
            </button>
          </form>

          {certQuery.isError && (
            <div className="mt-6 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {certQuery.error instanceof ApiError
                ? certQuery.error.message
                : 'Certificate record not found or could not be verified.'}
            </div>
          )}

          {certQuery.data && (
            <div className="mt-6 rounded-lg border-2 border-emerald-600/30 bg-emerald-50/20 p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-800">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider">Officially Verified Certificate</span>
              </div>

              <div className="border-t border-emerald-600/20 pt-3">
                <dl className="divide-y divide-emerald-600/10 text-xs">
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Certificate Serial</dt>
                    <dd className="font-mono font-bold text-navy-950">{certQuery.data.serialNo}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Trainee Name</dt>
                    <dd className="font-semibold text-navy-950">{certQuery.data.traineeName}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Programme & Discipline</dt>
                    <dd className="text-slate-800">{certQuery.data.degree} · {certQuery.data.discipline}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Project Title / Topic</dt>
                    <dd className="font-medium text-slate-900 max-w-[260px] text-right">{certQuery.data.topic}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Training Period</dt>
                    <dd className="text-slate-800">
                      {certQuery.data.startDate ? new Date(certQuery.data.startDate).toLocaleDateString() : '—'} to{' '}
                      {certQuery.data.endDate ? new Date(certQuery.data.endDate).toLocaleDateString() : '—'}
                    </dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Date of Issue</dt>
                    <dd className="text-slate-800">{new Date(certQuery.data.issuedAt).toLocaleDateString()}</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-500">Issuing Authority</dt>
                    <dd className="font-medium text-navy-950">Aeronautical Development Agency</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
