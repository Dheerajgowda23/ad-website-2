import { Navbar } from './Navbar.js';

interface DownloadItem {
  title: string;
  detail: string;
  href?: string;
  note?: string;
}

const ITEMS: DownloadItem[] = [
  {
    title: 'Internship & Project Work Guidelines',
    detail: 'Eligibility, duration, attendance, and certification rules (ADA/ADM/EST/0267/4/S.Trng: 2025).',
    href: '/guidelines',
  },
  {
    title: 'Annexure II - College Recommendation Letter (Blank Format)',
    detail: 'Print on college letterhead, obtain signature and seal of Principal / Head of Institution, scan and upload.',
    href: '/api/public/info/guidelines/annexure-blank',
  },
  {
    title: 'Pre-filled Recommendation Letter',
    detail: 'Automated document pre-populated with sponsor details, laboratory, and proposed research topic.',
    href: '/login',
    note: 'Requires Active Session',
  },
  {
    title: 'Application Dossier Summary (PDF)',
    detail: 'Printable archival copy of your submitted application generated from the verified database record.',
    href: '/login',
    note: 'Requires Active Session',
  },
  {
    title: 'Official Offer of Training & Completion Certificate',
    detail: 'Formal induction offer and digitally serialized completion certificate with cryptographic QR verification.',
    href: '/login',
    note: 'Issued upon Committee Approval',
  },
];

export const DownloadsPage = () => (
  <div className="min-h-screen blueprint-bg text-slate-800 flex flex-col font-sans">
    {/* Top classification indicator */}
    <div className="border-b border-slate-200 bg-slate-900 text-slate-300 text-[11px] py-2 px-6">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <span className="font-medium text-slate-300">REPOSITORY OF OFFICIAL DOCUMENTS</span>
        <span className="font-mono text-[10px] text-slate-400">FORMATS &amp; ANNEXURES</span>
      </div>
    </div>

    <Navbar />

    <main className="mx-auto max-w-4xl flex-1 px-6 py-12 w-full">
      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-blue-700 block mb-1">
        // DOCUMENT ARCHIVE
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Official Downloads &amp; Annexures
      </h1>
      <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
        Standard formats, circulars, and regulatory templates issued under ADA Policy Ref: ADA/ADM/EST/0267.
        All digital documents are dynamically generated from verified database records.
      </p>

      <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 transition">
            <div className="pr-4">
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.detail}</p>
            </div>
            {item.href ? (
              <a
                href={item.href}
                className="inline-flex items-center justify-center rounded-md bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all shrink-0 self-start sm:self-auto shadow-2xs"
              >
                {item.note ?? 'Download / View →'}
              </a>
            ) : (
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{item.note}</span>
            )}
          </div>
        ))}
      </div>
    </main>

    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
      Aeronautical Development Agency · P.B. No. 1718, Vimanapura Post, Bengaluru 560017
    </footer>
  </div>
);
