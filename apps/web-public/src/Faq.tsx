import { Navbar } from './Navbar.js';

const QA: { q: string; a: string }[] = [
  {
    q: 'How do I apply? There is no public Apply button.',
    a: 'Correct — there is no open application form. Entry is solely through redeeming a valid one-time referral code issued by an active ADA or DRDO employee via the internal portal. You then redeem that code using your email address.',
  },
  {
    q: 'Is there a stipend, fee, or commercial industrial training placement?',
    a: 'No. ADA does not disburse stipends, does not levy fees, and does not conduct industrial training placements. It is academic project work and research internship training under an authorized ADA scientist guide.',
  },
  {
    q: 'Who is eligible to participate?',
    a: 'UG: BE/B.Tech students after their 4th or 6th semester, for 12 to 20 weeks. PG: ME/M.Tech students in their 3rd or 4th semester, for 6 to 12 months. Seats are strictly limited to 50 UG and 25 PG concurrent seats.',
  },
  {
    q: 'Do colleges have dedicated portal accounts or logins?',
    a: 'No. There are no institutional accounts. Your college issues the signed and stamped recommendation letter (Annexure-II) on physical letterhead, which you scan and upload for ADA HR verification.',
  },
  {
    q: 'Can I edit my application dossier after submission?',
    a: 'Yes, while the status is SUBMITTED or returned for correction. Every edit creates an immutable revision. Once Admin & HR opens the packet for formal screening, editing is temporarily locked.',
  },
  {
    q: 'What verification documents are mandatory?',
    a: 'The physical signed and stamped college recommendation letter is mandatory. At reporting time, an original Police Clearance Certificate (PCC) and Government-issued photo ID are required for facility badge issuance.',
  },
  {
    q: 'How do I check my ongoing application status?',
    a: 'Use the Status Check utility with your official application number (e.g. ADA/INT/R/2026/0001) and registered date of birth.',
  },
  {
    q: 'How is candidate identity and Aadhaar data secured?',
    a: 'Aadhaar numbers are never stored in full. Only the last 4 digits and an HMAC-SHA256 hash are kept for deduplication. Numbers are masked across all administrative screens and generated PDF passes.',
  },
  {
    q: 'How is completion certification authenticated?',
    a: 'Every issued certificate carries an encrypted serial identifier and a cryptographic QR code. Anyone can verify its legitimacy publicly via the Verify Certificate page.',
  },
];

export const FaqPage = () => (
  <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans">
    {/* Top classification indicator */}
    <div className="border-b border-slate-200 bg-slate-900 text-slate-300 text-[11px] py-2 px-6">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <span className="font-medium text-slate-300">MISSION INTELLIGENCE &amp; PROCEDURES</span>
        <span className="font-mono text-[10px] text-slate-400">FAQ REGISTRY</span>
      </div>
    </div>

    <Navbar />

    <main className="mx-auto max-w-4xl flex-1 px-6 py-12 w-full">
      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-blue-700 block mb-1">
        // PROTOCOL QUESTIONS
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Frequently Asked Questions
      </h1>
      <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
        Key regulatory and policy answers regarding undergraduate and postgraduate project-work training
        at Aeronautical Development Agency (ADA), Bengaluru.
      </p>

      <div className="mt-8 space-y-3.5">
        {QA.map((item) => (
          <details key={item.q} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <summary className="cursor-pointer text-sm font-bold text-slate-900 group-open:text-blue-600 transition-colors list-none flex justify-between items-center">
              <span>{item.q}</span>
              <span className="text-blue-600 font-mono text-base font-bold ml-4 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </main>

    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
      Aeronautical Development Agency · P.B. No. 1718, Vimanapura Post, Bengaluru 560017
    </footer>
  </div>
);
