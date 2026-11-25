import { Link } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export const GuidelinesPage = () => {
  return (
    <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans">
      {/* Top classification header */}
      <div className="border-b border-slate-200 bg-slate-900 text-slate-300 text-[11px] py-2 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <span className="font-medium text-slate-300">OFFICIAL POLICY DIRECTIVE &amp; GUIDELINES</span>
          <span className="font-mono text-[10px] text-slate-400">REF: ADA/ADM/EST/0267/4/S.Trng</span>
        </div>
      </div>

      <Navbar />

      <main className="mx-auto max-w-6xl flex-1 px-6 py-10 space-y-8 w-full">
        {/* Policy Overview Header */}
        <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Official Guidelines · Ref ADA/ADM/EST/0267/4/S.Trng: 2025
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Internship &amp; Project Work Training at <span className="text-blue-600">ADA DRDO</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 max-w-3xl">
            Aeronautical Development Agency (ADA), Ministry of Defence, Government of India, offers project training
            and internship opportunities to eligible Indian engineering students. Training is conducted at ADA Bengaluru
            under the direct guidance of senior scientists and engineers.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition shadow-sm"
            >
              Redeem Referral Code &amp; Apply &rarr;
            </Link>
            <Link
              to="/status-check"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition"
            >
              Check Application Status
            </Link>
          </div>
        </section>

        {/* Eligibility Table */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              Eligibility &amp; Fixed Concurrent Capacity
            </h2>
            <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Cap: 75 Concurrent
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 uppercase font-mono tracking-wider">
                <tr>
                  <th className="p-3.5 border-b border-slate-200">Category</th>
                  <th className="p-3.5 border-b border-slate-200">Academic Programme</th>
                  <th className="p-3.5 border-b border-slate-200">Permitted Duration</th>
                  <th className="p-3.5 border-b border-slate-200">Concurrent Capacity</th>
                  <th className="p-3.5 border-b border-slate-200">Conditions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="p-3.5 font-bold text-slate-900 font-mono">Category (a)</td>
                  <td className="p-3.5">BE / B.Tech (UG) Engineering (after 4th or 6th semester)</td>
                  <td className="p-3.5 font-bold text-blue-700 font-mono">12 to 20 weeks (max)</td>
                  <td className="p-3.5 font-bold text-slate-900 font-mono">50 Students</td>
                  <td className="p-3.5 text-slate-500">Referral from active ADA / DRDO employee required</td>
                </tr>
                <tr className="hover:bg-slate-50/70 transition">
                  <td className="p-3.5 font-bold text-slate-900 font-mono">Category (b)</td>
                  <td className="p-3.5">ME / M.Tech (PG) Engineering (3rd &amp; 4th semester)</td>
                  <td className="p-3.5 font-bold text-blue-700 font-mono">6 to 12 months</td>
                  <td className="p-3.5 font-bold text-slate-900 font-mono">25 Students</td>
                  <td className="p-3.5 text-slate-500">Project dissertation topic aligned to ADA research wings</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Core Policy Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
              Key Policy Rules
            </h3>
            <ul className="text-xs space-y-2.5 text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Referral-Only Intake:</strong> No open public form. An active referral generated by an ADA or DRDO employee is mandatory.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">No Stipend / No Fee:</strong> Purely educational training under DRDO guidelines. Apprentices Act 1961 does not apply.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">College Recommendation:</strong> Original physical signature &amp; seal from the College Principal/HoD on institutional letterhead.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Strict Attendance:</strong> 100% attendance required to be eligible for certificate issuance.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Citizenship:</strong> Indian nationals only.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
              Reporting Day &amp; Security Protocol
            </h3>
            <ul className="text-xs space-y-2.5 text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Police Clearance Certificate (PCC):</strong> Mandatory on reporting day along with original Government ID.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Strict Media Prohibition:</strong> Mobile phones, cameras, laptops, and USB drives are prohibited inside ADA laboratory blocks.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Guide Clearance:</strong> Project report, code artifacts, and clearance sign-off must be approved before certificate release.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong className="text-slate-900">Cryptographic Certificate:</strong> Certificates are serialized with a cryptographic QR code for online validation.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Formats & Verification */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Official Formats &amp; Public Portals
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Standard templates issued under ADA Policy Ref: ADA/ADM/EST/0267/4/S.Trng.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <a
              href="/api/public/info/guidelines/annexure-blank"
              download="ADA-Annexure-II-College-Recommendation-Blank.pdf"
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 hover:bg-white transition flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition block">
                  Annexure - II Format
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  College Recommendation Letter Template (PDF)
                </p>
              </div>
              <span className="mt-4 text-[11px] font-mono text-blue-600 font-bold uppercase tracking-wider">
                Download Format &darr;
              </span>
            </a>

            <Link
              to="/verify"
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 hover:bg-white transition flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition block">
                  Certificate Verification
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Online Serial &amp; Cryptographic QR Validation
                </p>
              </div>
              <span className="mt-4 text-[11px] font-mono text-blue-600 font-bold uppercase tracking-wider">
                Verify Certificate &rarr;
              </span>
            </Link>

            <Link
              to="/status-check"
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 hover:bg-white transition flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition block">
                  Application Status
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Real-time Screening &amp; Allocation Lookup
                </p>
              </div>
              <span className="mt-4 text-[11px] font-mono text-blue-600 font-bold uppercase tracking-wider">
                Check Status &rarr;
              </span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Aeronautical Development Agency · P.B. No. 1718, Vimanapura Post, Bengaluru 560017
      </footer>
    </div>
  );
};
