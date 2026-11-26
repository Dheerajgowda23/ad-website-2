import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const initialSerial = searchParams.get('serial') || '';

  const [serialNo, setSerialNo] = useState(initialSerial);
  const [searchSerial, setSearchSerial] = useState(initialSerial);

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
    <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans">
      <Navbar />

      <main className="mx-auto max-w-xl flex-1 px-6 py-12 w-full space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-blue-700 font-bold block mb-1">
              // CREDENTIAL INTEGRITY
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Public Certificate Verification</h1>
            <p className="mt-2 text-xs text-slate-500">
              Verify the digital authenticity and cryptographic checksum of an official ADA Training Certificate.
            </p>
          </div>

          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <label className="label">Certificate Serial Number</label>
              <input
                type="text"
                placeholder="ADA-CERT-2026-0001"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value.toUpperCase())}
                required
                className="field font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={certQuery.isFetching}
              className="btn mt-2"
            >
              {certQuery.isFetching ? 'Verifying Signature…' : 'Validate Certificate →'}
            </button>
          </form>

          {certQuery.isLoading && (
            <div className="mt-6 text-center text-xs font-mono text-blue-600 animate-pulse">
              [Checking cryptographic registry]...
            </div>
          )}

          {certQuery.isError && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-mono text-red-700">
              [VERIFICATION_FAILED]: {(certQuery.error as ApiError).message || 'Certificate serial number not recognized.'}
            </div>
          )}

          {certQuery.isSuccess && certQuery.data && (
            <div className="mt-8 rounded-lg border border-emerald-300 bg-emerald-50/50 p-5 space-y-3 font-mono text-xs text-slate-800">
              <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase tracking-wider text-[11px] pb-2 border-b border-emerald-200">
                <span>✓</span> Official ADA Certificate Validated
              </div>
              <div className="flex justify-between border-b border-emerald-100 pb-2">
                <span className="text-slate-500">SERIAL NO:</span>
                <span className="font-bold text-slate-900">{certQuery.data.serialNo}</span>
              </div>
              <div className="flex justify-between border-b border-emerald-100 pb-2">
                <span className="text-slate-500">RECIPIENT:</span>
                <span className="font-bold text-slate-900">{certQuery.data.traineeName}</span>
              </div>
              <div className="flex justify-between border-b border-emerald-100 pb-2">
                <span className="text-slate-500">LABORATORY:</span>
                <span className="font-bold text-slate-900">{certQuery.data.lab}</span>
              </div>
              {certQuery.data.topic && (
                <div className="flex justify-between border-b border-emerald-100 pb-2">
                  <span className="text-slate-500">TOPIC:</span>
                  <span className="font-bold text-slate-900 text-right max-w-[240px]">{certQuery.data.topic}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">ISSUED DATE:</span>
                <span className="font-bold text-blue-700">
                  {new Date(certQuery.data.issuedAt).toLocaleDateString()}
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
