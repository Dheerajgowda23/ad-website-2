import { Navbar } from './Navbar.js';

const QA: { q: string; a: string }[] = [
  {
    q: 'How do I apply? There is no Apply button.',
    a: 'Correct - there is no open application. Entry is only by redeeming a referral code issued by an ADA or DRDO employee. Ask the employee to issue a code from the intranet portal; you then redeem it here with your own email address.',
  },
  {
    q: 'Is there a stipend, fee or industrial training?',
    a: 'No. ADA does not pay a stipend, does not charge a fee, and this is not an industrial training placement. It is project work or internship training under an ADA guide.',
  },
  {
    q: 'Who is eligible?',
    a: 'UG: BE/B.Tech students after the 4th or 6th semester, for 12 to 20 weeks. PG: ME/M.Tech students in the 3rd or 4th semester, for 6 to 12 months. Seats are limited (50 UG and 25 PG at a time).',
  },
  {
    q: 'Do I need a college login?',
    a: 'No. There are no college accounts and no college logins. Your college signs and stamps the recommendation letter on paper; you scan it and upload it, and ADA Admin & HR verifies that scan.',
  },
  {
    q: 'Can I edit my application after submitting it?',
    a: 'Yes, while it is SUBMITTED or returned for correction. Every save is stored as an immutable revision with a hash, and editing locks when Admin & HR opens the packet for screening. You will see the lock notice on your application page.',
  },
  {
    q: 'What documents will I be asked for?',
    a: 'The signed college recommendation letter is mandatory. Depending on the stage, a photo, signed undertaking/declaration, and at reporting time a police clearance and photo ID.',
  },
  {
    q: 'How do I check my status?',
    a: 'Use Status Check with your application number and date of birth. Before submission there is no application number; the number is allocated at submission.',
  },
  {
    q: 'Is my Aadhaar number stored?',
    a: 'No. Only the last four digits and a keyed hash used for de-duplication are stored, and the number is masked everywhere, including PDFs.',
  },
  {
    q: 'How is my certificate verified?',
    a: 'Every certificate carries a serial number and a QR code. Anyone can confirm it on the Verify Certificate page; a certificate cannot be issued twice for the same application.',
  },
  {
    q: 'Who do I contact about a referral code?',
    a: 'The ADA or DRDO employee who referred you, or Admin & HR at ADA for policy questions. Referral codes are single-use and expire.',
  },
];

export const FaqPage = () => (
  <div className="min-h-screen bg-slate-50">
    <Navbar />
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-navy-950">Frequently asked questions</h1>
      <p className="mt-2 text-sm text-slate-600">
        Policy questions about internship and project-work training at ADA, Bengaluru.
      </p>

      <div className="mt-8 space-y-4">
        {QA.map((item) => (
          <details key={item.q} className="group rounded-md border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-navy-900 marker:text-teal-600">
              {item.q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Reference: ADA/ADM/EST/0267/4/S.Trng: 2025 dated 31 Dec 2025. Where this page and the
        signed guidelines differ, the guidelines prevail.
      </p>
    </main>
  </div>
);
