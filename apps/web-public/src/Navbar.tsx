import { Link, useLocation } from 'react-router-dom';

export const Navbar = () => {
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Overview' },
    { to: '/guidelines', label: 'Guidelines' },
    { to: '/downloads', label: 'Downloads' },
    { to: '/faq', label: 'FAQ' },
    { to: '/verify', label: 'Verify Certificate' },
    { to: '/application', label: 'My Application' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 lg:px-10 h-20">
        {/* Brand: official ADA and DRDO crests, bundled locally for offline use */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <div className="flex items-center gap-1.5">
            <img
              src="/brand/ada-logo.png"
              alt="Aeronautical Development Agency"
              className="h-11 w-11 object-contain"
            />
            <span className="h-8 w-px bg-slate-200" aria-hidden="true"></span>
            <img src="/brand/drdo-logo.png" alt="DRDO" className="h-10 w-10 object-contain" />
          </div>
          <div className="leading-tight hidden sm:block">
            <span className="block text-[10px] text-blue-700 tracking-[0.25em] font-bold uppercase">
              DRDO Nodal Centre // Bengaluru
            </span>
            <h1 className="serif-heading text-lg font-bold text-navy-950 tracking-tight">
              Aeronautical <span className="text-blue-600">Development Agency</span>
            </h1>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden xl:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`text-xs uppercase tracking-[0.14em] font-medium transition-all ${
                  isActive
                    ? 'text-blue-600 font-bold border-b-2 border-blue-600 pb-1'
                    : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

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
            Redeem &amp; Apply
          </Link>
        </div>
      </div>
    </header>
  );
};
