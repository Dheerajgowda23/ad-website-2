import { Navbar } from './Navbar.js';

interface DownloadItem {
  title: string;
  detail: string;
  href?: string;
  note?: string;
}

const ITEMS: DownloadItem[] = [
  {
    title: 'Internship & project work guidelines',
    detail: 'Eligibility, duration, attendance and certificate rules (ADA/ADM/EST/0267/4/S.Trng: 2025, 31 Dec 2025).',
    href: '/guidelines',
  },
  {
    title: 'Annexure II - College recommendation letter (blank format)',
    detail: 'Print on college letterhead, get it signed and sealed by the Principal / Head of Institution, scan and upload it with your application.',
    href: '/api/public/info/guidelines/annexure-blank',
  },
  {
    title: 'Pre-filled recommendation letter',
    detail: 'Once you have redeemed a referral code and signed in, the portal fills this letter with your details and the proposed topic.',
    href: '/login',
    note: 'Available after sign-in',
  },
  {
    title: 'Application summary (PDF)',
    detail: 'A printable copy of the submitted application, generated from the live record.',
    href: '/login',
    note: 'Available after sign-in',
  },
  {
    title: 'Offer of training and certificate',
    detail: 'Issued by the portal when the Director approves and when training is completed; the certificate carries a serial number and QR code.',
    href: '/login',
    note: 'Issued by ADA',
  },
];

export const DownloadsPage = () => (
  <div className="min-h-screen bg-slate-50">
    <Navbar />
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-navy-950">Downloads</h1>
      <p className="mt-2 text-sm text-slate-600">
        Formats, guidelines and the documents the portal produces. Files are generated from the
        current policy record, so there is no stale copy to download.
      </p>

      <ul className="mt-8 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {ITEMS.map((item) => (
          <li key={item.title} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="pr-4">
              <p className="text-sm font-semibold text-navy-900">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
            </div>
            {item.href ? (
              <a
                href={item.href}
                className="shrink-0 rounded bg-navy-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800"
              >
                {item.note ?? 'Open'}
              </a>
            ) : (
              <span className="shrink-0 text-xs text-slate-400">{item.note}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        The signed college letter is the legal artefact for v1. There is no eSign integration: the
        scan you upload is verified by a person in Admin & HR, and the verification is recorded with
        who did it and when.
      </p>
    </main>
  </div>
);
