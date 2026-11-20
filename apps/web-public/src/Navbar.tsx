import { Link, useLocation } from 'react-router-dom';

export const Navbar = () => {
  const location = useLocation();

  const navLinks = [
    { to: '/guidelines', label: 'Guidelines & Policy' },
    { to: '/status-check', label: 'Status Check' },
    { to: '/verify', label: 'Verify Certificate' },
    { to: '/application', label: 'My Application' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link to="/guidelines" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-navy-950 text-[11px] font-bold tracking-widest text-white">
            ADA
          </div>
          <div className="text-sm leading-tight text-navy-950 font-semibold">
            Aeronautical Development Agency
            <div className="text-[11px] font-normal text-slate-500">Internship & Project Work Portal</div>
          </div>
        </Link>

        <nav className="flex items-center gap-5">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`text-xs font-medium transition ${
                  isActive ? 'text-teal-600 font-semibold border-b-2 border-teal-600 pb-1' : 'text-slate-600 hover:text-navy-950'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
