import { Link } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export const GuidelinesPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-5xl flex-1 px-6 py-8 space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-8">
          <div className="inline-block rounded-sm bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
            Official Guidelines · Ref ADA/ADM/EST/0267/4/S.Trng: 2025
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-950">
            Internship & Project Work Training at ADA
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Aeronautical Development Agency (ADA), Ministry of Defence, Government of India, offers project training
            and internship opportunities to eligible Indian engineering students. Training is conducted at ADA Bengaluru
            under the guidance of senior scientists and engineers.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md bg-teal-600 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-teal-500 transition"
            >
              Redeem Referral Code & Apply
            </Link>
            <Link
              to="/status-check"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition"
            >
              Check Application Status
            </Link>
          </div>
        </section>

        {/* Eligibility Table */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-navy-950">Eligibility & Capacity (Fixed by Policy)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="p-3 border-b">Category</th>
                  <th className="p-3 border-b">Programme</th>
                  <th className="p-3 border-b">Permitted Duration</th>
                  <th className="p-3 border-b">Concurrent Capacity</th>
                  <th className="p-3 border-b">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="p-3 font-semibold text-navy-950">Category (a)</td>
                  <td className="p-3">BE / B.Tech (UG) Engineering (after 4th or 6th semester)</td>
                  <td className="p-3 font-medium text-teal-700">12 to 20 weeks (max)</td>
                  <td className="p-3 font-bold text-navy-950">50 students</td>
                  <td className="p-3">Referral from ADA / DRDO employee required</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-navy-950">Category (b)</td>
                  <td className="p-3">ME / M.Tech (PG) Engineering (3rd & 4th semester)</td>
                  <td className="p-3 font-medium text-teal-700">6 to 12 months</td>
                  <td className="p-3 font-bold text-navy-950">25 students</td>
                  <td className="p-3">Project dissertation topic aligned to ADA research</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Core Policy Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wide">Key Policy Rules</h3>
            <ul className="text-xs space-y-2 text-slate-600 list-disc list-inside leading-relaxed">
              <li><strong className="text-slate-900">Referral-Only Entry:</strong> There is no open application channel or self-registration. An active referral code from an ADA or DRDO employee is mandatory.</li>
              <li><strong className="text-slate-900">No Stipend / No Fee:</strong> This is purely educational project work. Apprentices Act 1961 does not apply. No stipend or financial aid is provided.</li>
              <li><strong className="text-slate-900">Signed College Endorsement:</strong> Student must upload a signed & sealed recommendation letter from the College Principal/HoD on official letterhead.</li>
              <li><strong className="text-slate-900">100% Attendance:</strong> Full attendance is mandatory throughout the training tenure to be eligible for certification.</li>
              <li><strong className="text-slate-900">Indian Nationals Only:</strong> Applicants must be citizens of India.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wide">Reporting Day & Security</h3>
            <ul className="text-xs space-y-2 text-slate-600 list-disc list-inside leading-relaxed">
              <li><strong className="text-slate-900">Police Clearance Certificate (PCC):</strong> Mandatory on reporting day along with original photo ID. Students cannot enter without PCC.</li>
              <li><strong className="text-slate-900">Strict Non-Disclosure:</strong> Mobile phones, cameras, laptops, and external storage media (USB/hard drives) are strictly prohibited inside ADA premises.</li>
              <li><strong className="text-slate-900">Guide Clearance:</strong> On completion, data and technical reports must be surrendered, and clearance signed off by the Guide before certificate issuance.</li>
              <li><strong className="text-slate-900">Digital Certificate:</strong> Certificates are digitally serialized with a cryptographic QR code for online verification. No duplicate certificates are re-issued.</li>
            </ul>
          </div>
        </div>

        {/* Official Formats & Downloads */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-navy-950">Official Formats & Downloads</h2>
          <p className="mt-1 text-xs text-slate-500">
            Standard Annexures and templates issued under ADA Policy Ref: ADA/ADM/EST/0267/4/S.Trng: 2025.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <a
              href="/api/public/info/guidelines/annexure-blank"
              download="ADA-Annexure-II-College-Recommendation-Blank.pdf"
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-300 transition group"
            >
              <div>
                <span className="font-bold text-navy-950 group-hover:text-teal-700">Annexure - II Format</span>
                <p className="text-[11px] text-slate-500 mt-0.5">College Recommendation Letter</p>
              </div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>

            <Link
              to="/verify"
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-300 transition group"
            >
              <div>
                <span className="font-bold text-navy-950 group-hover:text-teal-700">Certificate Verification</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Online Serial & QR Verification</p>
              </div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>

            <Link
              to="/status-check"
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-300 transition group"
            >
              <div>
                <span className="font-bold text-navy-950 group-hover:text-teal-700">Application Status</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Lookup by App No & DOB</p>
              </div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Process Flow */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-navy-950">Application Lifecycle</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="rounded border border-slate-200 p-3 bg-slate-50">
              <span className="font-bold text-teal-700">1. Referral</span>
              <p className="mt-1 text-slate-600">Employee generates referral code for student.</p>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50">
              <span className="font-bold text-teal-700">2. Submission</span>
              <p className="mt-1 text-slate-600">Student redeems code, fills form, uploads college letter & submits.</p>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50">
              <span className="font-bold text-teal-700">3. Scrutiny & Committee</span>
              <p className="mt-1 text-slate-600">Admin & HR screens eligibility; Committee scores packet.</p>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50">
              <span className="font-bold text-teal-700">4. Decision & Joining</span>
              <p className="mt-1 text-slate-600">Director approves; offer issued; reporting day pass and training start.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Aeronautical Development Agency · P.B. No. 1718, Vimanapura Post, Bengaluru 560017
      </footer>
    </div>
  );
};
