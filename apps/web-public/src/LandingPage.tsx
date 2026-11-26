import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export const LandingPage: React.FC = () => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Who is eligible to apply for ADA internships?',
      a: 'Eligibility is restricted to Indian nationals currently pursuing B.E/B.Tech (completed 4th or 6th semester) or M.E/M.Tech (3rd or 4th semester) in Aeronautical, Aerospace, Mechanical, Electronics, Computer Science, or allied engineering branches.',
    },
    {
      q: 'What is the permitted duration of project training?',
      a: 'Category (a) UG students: 12 to 20 weeks maximum. Category (b) PG students: 6 to 12 months for complete dissertation work aligned with ADA research divisions.',
    },
    {
      q: 'How is seat capacity managed?',
      a: 'ADA maintains a fixed concurrent ceiling of 75 students at any given time (50 Undergraduate seats + 25 Postgraduate seats). Applications exceeding capacity are queued for subsequent cohorts.',
    },
    {
      q: 'Is an employee referral mandatory?',
      a: 'Yes. In strict accordance with Ministry of Defence regulations, there is no open public registration. Every applicant must hold an authenticated referral code issued by an active ADA or DRDO employee.',
    },
    {
      q: 'Is security clearance required?',
      a: 'Yes. Candidates undergo administrative vetting and must present an original Police Clearance Certificate (PCC) and photo ID on reporting day for facility access pass issuance.',
    },
  ];

  // Student-facing stages, in the order the portal moves an application.
  const stages = [
    ['01', 'Sponsored by ADA / DRDO Employee', 'Referral code redeemed'],
    ['02', 'Application Submitted', 'Form complete and submitted'],
    ['03', 'Under Scrutiny', 'HR eligibility verification'],
    ['04', 'Committee Review', 'Selection committee scoring'],
    ['05', 'Approved', 'Director approval and offer issued'],
    ['06', 'Reporting Day', 'PCC, photo ID and security pass'],
    ['07', 'Training In Progress', 'Guide assigned, attendance recorded'],
    ['08', 'Completion Pending', 'Guide clearance and report copy'],
    ['09', 'Certificate Issued', 'Download with QR verification'],
  ];

  return (
    <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative">
      {/* Main Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 pt-12 pb-20 lg:pt-16 lg:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Narrative Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Official ADA & DRDO crests */}
              <div className="flex items-center gap-3">
                <img
                  src="/brand/ada-logo.png"
                  alt="Aeronautical Development Agency"
                  className="h-14 w-auto object-contain"
                />
                <span className="h-10 w-px bg-slate-200" aria-hidden="true"></span>
                <img src="/brand/drdo-logo.png" alt="DRDO" className="h-12 w-auto object-contain" />
                <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/90 px-3 py-1 text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  Intake 2025–2026
                </span>
              </div>

              {/* High-Impact Headline */}
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.14]">
                  ADA Internship &amp; Project Training Portal
                </h1>
                <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                  Aeronautical Development Agency (ADA), Ministry of Defence, Bengaluru invites
                  applications for internship and project training. Entry is referral-only: a valid
                  code from an ADA or DRDO employee is required to open the application form.
                </p>
              </div>

              {/* Entry actions: Redeem Code & Apply, or Track. No referral entry here. */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-w-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-blue-700 uppercase">
                    START OR TRACK AN APPLICATION
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">REFERRAL ONLY</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Link
                    to="/login"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition"
                  >
                    Redeem Code &amp; Apply
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                  <Link
                    to="/status-check"
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Track Application
                  </Link>
                </div>

                <p className="mt-3 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                  The referral code is entered on the next screen, never on this page. Already
                  applied? Use <span className="font-semibold text-slate-700">Track Application</span>{' '}
                  with your application number and date of birth.
                </p>
              </div>

              {/* Signature Dashed Divider */}
              <div className="pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tracking-tight text-slate-900">
                    About <span className="text-blue-600 font-bold">Project &amp; Intake</span>
                  </span>
                  <div className="flex-1 border-t-2 border-dashed border-slate-300"></div>
                  <span className="text-xs font-mono text-slate-400 uppercase">M0–M6 Pipeline</span>
                </div>

                {/* Key Spec Stats */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Duration :
                    </div>
                    <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                      12–20 Wks <span className="text-xs font-normal text-slate-500">/ 1 Yr</span>
                    </div>
                    <div className="text-[11px] text-blue-600 font-medium">UG &amp; PG Training</div>
                  </div>

                  <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Screens :
                    </div>
                    <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                      25+ Screens
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium">Air-gapped Intranet</div>
                  </div>

                  <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Capacity :
                    </div>
                    <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                      75 Seats
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">50 UG + 25 PG</div>
                  </div>

                  <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Clearance :
                    </div>
                    <div className="mt-0.5 text-base font-bold text-emerald-700 font-mono">
                      DRDO Verified
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Security Pass Issued</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Jet Visual Column */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              {/* Soft decorative ambient glow */}
              <div className="absolute w-80 h-80 bg-blue-100/70 rounded-full blur-3xl pointer-events-none -z-10" />

              <div className="relative w-full max-w-md aspect-[4/5] flex items-center justify-center p-3">
                <svg
                  viewBox="0 0 500 620"
                  className="w-full h-full drop-shadow-xl select-none"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="fuselageLight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#cbd5e1" />
                      <stop offset="50%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                    <linearGradient id="canopyLight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e40af" />
                      <stop offset="50%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>

                  {/* Signature Dashed Cutout Outline */}
                  <path
                    d="M250 20 L275 80 L310 180 L440 370 L430 405 L370 400 L320 425 L300 480 L290 540 L265 570 L250 580 L235 570 L210 540 L200 480 L180 425 L130 400 L70 405 L60 370 L190 180 L225 80 Z"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeDasharray="9 7"
                    fill="rgba(37, 99, 235, 0.04)"
                  />

                  {/* Tactical CAD Grid Lines */}
                  <line x1="250" y1="10" x2="250" y2="590" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                  <line x1="40" y1="380" x2="460" y2="380" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                  <circle cx="250" cy="315" r="135" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />

                  {/* Compound Delta Wing Main Airframe */}
                  <polygon
                    points="250,90 280,210 425,385 365,392 310,410 295,490 250,530 205,490 190,410 135,392 75,385 220,210"
                    fill="url(#fuselageLight)"
                    stroke="#334155"
                    strokeWidth="2.5"
                  />

                  {/* Shading & Elevon Control Surfaces */}
                  <polygon points="250,220 410,380 370,388 310,405" fill="#475569" opacity="0.45" />
                  <polygon points="250,220 90,380 130,388 190,405" fill="#475569" opacity="0.55" />

                  <line x1="320" y1="395" x2="415" y2="380" stroke="#1e293b" strokeWidth="1.5" />
                  <line x1="180" y1="395" x2="85" y2="380" stroke="#1e293b" strokeWidth="1.5" />

                  {/* Wingtip Pylons */}
                  <rect x="67" y="360" width="8" height="35" rx="2" fill="#1e293b" />
                  <rect x="425" y="360" width="8" height="35" rx="2" fill="#1e293b" />

                  {/* Centerline Fuselage */}
                  <path
                    d="M250 50 L262 130 L266 280 L264 470 L258 520 L250 535 L242 520 L236 470 L234 280 L238 130 Z"
                    fill="#e2e8f0"
                    stroke="#1e293b"
                    strokeWidth="2"
                  />

                  {/* Glass Canopy */}
                  <ellipse cx="250" cy="165" rx="12" ry="40" fill="url(#canopyLight)" stroke="#0f172a" strokeWidth="2" />
                  <ellipse cx="247" cy="155" rx="4" ry="24" fill="#ffffff" opacity="0.4" />

                  {/* Radome Nose & Pitot Probe */}
                  <polygon points="250,45 258,110 242,110" fill="#334155" />
                  <line x1="250" y1="28" x2="250" y2="45" stroke="#0f172a" strokeWidth="2" />

                  {/* Afterburner Nozzle */}
                  <ellipse cx="250" cy="532" rx="14" ry="6" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />

                  {/* IAF Roundel Left */}
                  <g transform="translate(145, 345)">
                    <circle cx="0" cy="0" r="15" fill="#f97316" />
                    <circle cx="0" cy="0" r="10" fill="#ffffff" />
                    <circle cx="0" cy="0" r="5.5" fill="#15803d" />
                    <circle cx="0" cy="0" r="2" fill="#1e3a8a" />
                  </g>

                  {/* IAF Roundel Right */}
                  <g transform="translate(355, 345)">
                    <circle cx="0" cy="0" r="15" fill="#f97316" />
                    <circle cx="0" cy="0" r="10" fill="#ffffff" />
                    <circle cx="0" cy="0" r="5.5" fill="#15803d" />
                    <circle cx="0" cy="0" r="2" fill="#1e3a8a" />
                  </g>
                </svg>

                {/* Floating Telemetry Badges */}
                <div className="absolute top-4 right-0 rounded-lg bg-slate-900/90 backdrop-blur-md px-3.5 py-2 text-white border border-slate-700 shadow-md text-left">
                  <div className="text-[9px] font-mono tracking-wider text-blue-400">PROGRAM</div>
                  <div className="text-xs font-bold">LCA Tejas Mk1A / Mk2</div>
                  <div className="text-[10px] text-slate-300">Mach 1.6+ Supersonic</div>
                </div>

                <div className="absolute bottom-6 left-0 rounded-lg bg-white px-3.5 py-2 text-slate-800 border border-slate-200 shadow-lg text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[9px] font-mono font-bold uppercase text-slate-500">ADA R&amp;D WING</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">National Flight Test Centre</div>
                  <div className="text-[10px] text-blue-700 font-medium">Bengaluru 12.97° N, 77.59° E</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to apply and how to track */}
      <section className="py-16 bg-white border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Apply, then track your application
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6">
              <h3 className="font-bold text-slate-900 mb-3">How to apply</h3>
              <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Get a one-time referral code from an ADA or DRDO employee.</li>
                <li>Click <span className="font-semibold text-slate-800">Redeem Code &amp; Apply</span>.</li>
                <li>Enter the referral code and verify the email OTP.</li>
                <li>Fill every step of the form, then press <span className="font-semibold text-slate-800">Submit</span>.</li>
                <li>Note the application number shown after submission.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6">
              <h3 className="font-bold text-slate-900 mb-3">How to track</h3>
              <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Click <span className="font-semibold text-slate-800">Track Application</span> in the header.</li>
                <li>Enter your application number exactly, e.g. ADA/INT/R/2026/0001.</li>
                <li>Enter the same date of birth you used in the form.</li>
                <li>Press <span className="font-semibold text-slate-800">Search Dossier Status</span> to see the current stage.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Core Research Wings */}
      <section className="py-20 bg-white border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
                DRDO Lab Ecosystem
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Core Research Divisions at ADA
              </h2>
            </div>
            <p className="text-sm text-slate-500 max-w-md">
              Selected candidates work directly under senior scientists and project directors
              on national aeronautical defence projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 hover:border-blue-300 hover:bg-white hover:shadow-md transition">
              <span className="text-xs font-mono font-bold text-blue-700 mb-2 block tracking-wider">
                MODULE 01
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Aerodynamics &amp; Stealth
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 mb-6">
                Computational Fluid Dynamics (CFD), transonic wind tunnel investigations,
                stealth radar cross-section (RCS) reduction, and store-separation dynamics for AMCA.
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-500 uppercase">Complexity</span>
                  <span className="text-blue-700 font-bold">LEVEL_CRITICAL</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-blue-600"></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 hover:border-blue-300 hover:bg-white hover:shadow-md transition border-t-2 border-t-blue-600">
              <span className="text-xs font-mono font-bold text-blue-700 mb-2 block tracking-wider">
                MODULE 02
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Flight Control &amp; Avionics
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 mb-6">
                Design and validation of Quadruplex Digital Fly-by-Wire Flight Control Systems (DFCS),
                AESA Radar integration, electronic warfare suites, and real-time mission computers.
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-500 uppercase">Complexity</span>
                  <span className="text-blue-700 font-bold">LEVEL_HIGH</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-4/5 bg-blue-600"></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 hover:border-blue-300 hover:bg-white hover:shadow-md transition">
              <span className="text-xs font-mono font-bold text-blue-700 mb-2 block tracking-wider">
                MODULE 03
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Structures &amp; Advanced Composites
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 mb-6">
                Pioneering carbon-composite airframe design, structural health monitoring, aeroelastic
                flutter analysis, and naval arrester-hook landing stress simulations.
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-500 uppercase">Complexity</span>
                  <span className="text-blue-700 font-bold">LEVEL_MID</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-3/5 bg-blue-600"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9-Stage Application Tracker */}
      <section className="py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
              Application Tracker
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Your 9-Stage Journey
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Every application moves through these stages. Track Application shows the stage your
              dossier has reached.
            </p>
          </div>

          <div className="space-y-2 max-w-3xl mx-auto">
            {stages.map(([no, title, detail]) => (
              <div
                key={no}
                className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-mono font-bold text-blue-700">
                  {no}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{title}</div>
                  <div className="text-xs text-slate-500">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lookup & Verification Cards */}
      <section className="py-16 bg-white border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                  ✓
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Track Application Status
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sign in with your registered email to reopen the submitted dossier, or query the
                  screening stage with your application number and date of birth.
                </p>
                <ol className="mt-3 space-y-1.5 text-xs text-slate-600 list-decimal list-inside">
                  <li>Track progress: application number + date of birth.</li>
                  <li>Edit or download the packet, offer or certificate: sign in on My Application.</li>
                </ol>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link
                  to="/status-check"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  Track by Application Number &rarr;
                </Link>
                <Link
                  to="/application"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Open My Application &rarr;
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Verify Issued Certificate
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Digitally validate the cryptographic authenticity and QR checksum of an official ADA training certificate.
                </p>
              </div>
              <div className="mt-5">
                <Link
                  to="/verify"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                >
                  Validate Certificate ID &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission FAQ Section */}
      <section className="py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
              Clearance &amp; Procedures
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-5 cursor-pointer shadow-2xs hover:border-slate-300 transition"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-900">
                    {faq.q}
                  </h4>
                  <span className="text-blue-600 font-mono text-base font-bold ml-4">
                    {activeFaq === idx ? '−' : '+'}
                  </span>
                </div>
                {activeFaq === idx && (
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 bg-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-blue-50/60 to-slate-50/60 p-10 sm:p-14 shadow-sm">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Ready to contribute to India&apos;s <span className="text-blue-600">Aerospace Future?</span>
            </h2>
            <p className="text-slate-600 text-sm max-w-xl mx-auto mb-8 leading-relaxed">
              Applications for the 2025–2026 academic cohort are actively processed.
              Have your referral code and college recommendation letter ready.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition shadow-sm"
            >
              Redeem Code &amp; Apply
            </Link>
            <div className="mt-8 flex justify-center gap-6 text-[11px] font-mono text-slate-400">
              <span>REF: ADA_RD_2025</span>
              <span>·</span>
              <span>CAPACITY: 75 SEATS</span>
              <span>·</span>
              <span>BENGALURU SITE</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-400 py-14 px-6 lg:px-10 text-xs">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/brand/ada-logo.png"
                alt="Aeronautical Development Agency"
                className="h-9 w-9 rounded bg-white object-contain p-0.5"
              />
              <div>
                <div className="text-sm font-semibold text-white">
                  Aeronautical Development Agency
                </div>
                <div className="text-[11px] text-slate-400">
                  Department of Defence R&amp;D, Ministry of Defence, Govt. of India
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              P.B. No. 1718, Vimanapura Post, Bengaluru – 560017, Karnataka, India.
              The nodal agency for the design &amp; development of India&apos;s Light Combat Aircraft.
            </p>
          </div>

          <div>
            <div className="font-semibold text-white mb-3">Portal Navigation</div>
            <ul className="space-y-2">
              <li>
                <Link to="/guidelines" className="hover:text-white transition">
                  Guidelines &amp; Policy
                </Link>
              </li>
              <li>
                <Link to="/downloads" className="hover:text-white transition">
                  Annexures &amp; Downloads
                </Link>
              </li>
              <li>
                <Link to="/status-check" className="hover:text-white transition">
                  Application Status
                </Link>
              </li>
              <li>
                <Link to="/verify" className="hover:text-white transition">
                  Certificate Verification
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-white mb-3">Compliance &amp; Regulations</div>
            <p className="text-slate-400 leading-relaxed">
              Internship intake strictly follows Government of India guidelines.
              Commercial agents and unsolicited requests are prohibited.
            </p>
            <div className="mt-3 text-[11px] text-slate-500">
              © {new Date().getFullYear()} Aeronautical Development Agency. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
