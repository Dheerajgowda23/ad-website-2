import { Link } from 'react-router-dom';

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 lg:px-10 h-20">
        {/* Brand: official ADA and DRDO crests, bundled locally for offline use */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <div className="flex items-center gap-1.5">
            <img
              src="/brand/ada-logo.png"
              alt="Aeronautical Development Agency"
              className="h-10 w-10 object-contain"
            />
            <span className="h-8 w-px bg-slate-200" aria-hidden="true"></span>
            <img
              src="/brand/drdo-logo.png"
              alt="DRDO"
              className="h-10 w-10 object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <h1 className="serif-heading text-lg font-bold text-navy-950 tracking-tight">
              Aeronautical <span className="text-blue-600">Development Agency</span>
            </h1>
            <span className="block text-[10px] text-slate-500 tracking-[0.2em] font-semibold uppercase">
              Ministry of Defence · Bengaluru
            </span>
          </div>
        </Link>

        {/* Entry actions: the two things an applicant ever needs */}
        <div className="flex items-center gap-2">
          <Link
            to="/status-check"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-xs uppercase tracking-[0.12em] font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Track
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-xs uppercase tracking-[0.12em] font-bold text-white hover:bg-blue-700 active:bg-blue-800 transition-all shadow-sm"
          >
            Redeem & Apply
          </Link>
        </div>
      </div>
    </header>
  );
};