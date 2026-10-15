/*
 * PROTOTYPE — throwaway. Four structurally different app headers, switched by
 * the floating bar at the bottom (← / → keys). See ./README.md.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { Activity, Bookmark, ChevronDown, LogOut, Plug, Search, Swords, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginButton from '../components/Auth/LoginButton';
import UserProfile from '../components/Auth/UserProfile';
import PrototypeSwitcher from './PrototypeSwitcher';
import slate from './mock/slate.json';
import './prototype.css';

const LINKS = [
  { to: '/', label: 'Search', icon: Search, end: true },
  { to: '/matchups', label: 'Matchups', icon: Swords },
  { to: '/targets', label: 'Targets', icon: Target },
  { to: '/connect', label: 'Connect', icon: Plug },
];
const OPS = { to: '/operations', label: 'Operations', icon: Activity, admin: true };

const initialsOf = (user) =>
  (user?.displayName || user?.email || 'U')
    .split(/[\s@]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .slice(0, 2)
    .join('');

/* Keep --ct-header-height true for whichever header is showing; floating page
   controls clear the header by it. */
const usePublishHeight = (ref) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const publish = () =>
      document.documentElement.style.setProperty('--ct-header-height', `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--ct-header-height');
    };
  }, [ref]);
};

const useLinks = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const { hash } = useLocation();
  const links = isAuthenticated && isAdmin ? [...LINKS, OPS] : LINKS;
  // Carry the hash so the chosen variant survives navigation.
  return links.map((link) => ({ ...link, href: { pathname: link.to, hash } }));
};

const Mark = ({ size = 22 }) => (
  <svg className="hp-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M1.5 12h21M12 1.5v21M5 4.6c2.6 2 4 4.6 4 7.4s-1.4 5.4-4 7.4M19 4.6c-2.6 2-4 4.6-4 7.4s1.4 5.4 4 7.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const Avatar = ({ user, className = '' }) => (
  <span className={`hp-avatar ${className}`}>{initialsOf(user)}</span>
);

/* One account menu, re-skinned per variant through `className`. The items are
   inert in the prototype. */
const AccountMenu = ({ showName = true, className = '' }) => {
  const { currentUser, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginButton size="sm" />;
  const name = currentUser.displayName || currentUser.email?.split('@')[0];
  return (
    <Dropdown align="end" className={`hp-account ${className}`}>
      <Dropdown.Toggle bsPrefix="hp-account-toggle" aria-label={`Account: ${name}`}>
        <Avatar user={currentUser} />
        {showName && <span className="hp-account-name">{name}</span>}
        <ChevronDown size={14} className="hp-account-chev" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="hp-account-menu">
        <div className="hp-account-head">
          <strong>{name}</strong>
          <span>{currentUser.email}</span>
        </div>
        <Dropdown.Item className="d-flex align-items-center gap-2">
          <Bookmark size={16} /> Saved Filter Sets
        </Dropdown.Item>
        <Dropdown.Item className="d-flex align-items-center gap-2">
          <LogOut size={16} /> Sign out
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

/* ---- A: pill track ---------------------------------------------------------
   Compact bar; the nav is one segmented control, the active page a filled
   pill. Account collapses to an avatar. */
const VariantA = () => {
  const links = useLinks();
  return (
    <header className="hpA">
      <div className="hpA-inner">
        <NavLink className="hpA-brand" to={links[0].href}>
          <Mark />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpA-track" aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.href}
              end={link.end}
              className={link.admin ? 'hpA-admin' : undefined}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <AccountMenu showName={false} className="hpA-account" />
      </div>
    </header>
  );
};

/* ---- B: tab rail -----------------------------------------------------------
   Left-aligned tabs that sit on the bottom border, active one underlined in
   gold. The right side gets a search trigger, since Search is the home page. */
const VariantB = () => {
  const links = useLinks();
  const navigate = useNavigate();
  const { hash } = useLocation();
  return (
    <header className="hpB">
      <div className="hpB-inner">
        <NavLink className="hpB-brand" to={links[0].href}>
          <Mark size={20} />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpB-tabs" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
              {link.admin && <span className="hpB-badge">Admin</span>}
            </NavLink>
          ))}
        </nav>
        <div className="hpB-right">
          <button
            type="button"
            className="hpB-search"
            onClick={() => navigate({ pathname: '/', hash })}
          >
            <Search size={15} />
            <span>Ask about a player…</span>
            <kbd>/</kbd>
          </button>
          <AccountMenu className="hpB-account" />
        </div>
      </div>
    </header>
  );
};

/* ---- C: broadcast ----------------------------------------------------------
   A thin slate strip (date, game count, account) over a scoreboard bar with
   big condensed uppercase nav. Admin moves up into the strip. */
const slateLabel = () => {
  const date = new Date(`${slate.slate_date}T12:00:00`);
  const day = date
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
  return { day, games: slate.games.length };
};

const VariantC = () => {
  const links = useLinks();
  const main = links.filter((link) => !link.admin);
  const ops = links.find((link) => link.admin);
  const { day, games } = slateLabel();
  return (
    <header className="hpC">
      <div className="hpC-strip">
        <div className="hpC-inner">
          <span className="hpC-live">
            <i /> {day} · {games} GAMES
          </span>
          <span className="hpC-strip-right">
            {ops && (
              <NavLink to={ops.href} className="hpC-ops">
                <Activity size={13} /> Operations
              </NavLink>
            )}
            <AccountMenu className="hpC-account" />
          </span>
        </div>
      </div>
      <div className="hpC-bar">
        <div className="hpC-inner">
          <NavLink className="hpC-brand" to={links[0].href}>
            COURT<b>AI</b>
          </NavLink>
          <nav className="hpC-nav" aria-label="Primary">
            {main.map((link) => (
              <NavLink key={link.to} to={link.href} end={link.end}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

/* ---- D: floating dock ------------------------------------------------------
   Desktop: a floating capsule with icon + label items. Phone: a slim top bar
   and a bottom tab bar within thumb reach. */
const VariantD = () => {
  const links = useLinks();
  return (
    <>
      <header className="hpD">
        <div className="hpD-capsule">
          <NavLink className="hpD-brand" to={links[0].href} aria-label="CourtAI home">
            <Mark size={22} />
            <span>CourtAI</span>
          </NavLink>
          <nav className="hpD-nav" aria-label="Primary">
            {links.map(({ to, href, end, label, icon: Icon }) => (
              <NavLink key={to} to={href} end={end}>
                <Icon size={16} strokeWidth={2} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <AccountMenu showName={false} className="hpD-account" />
        </div>
      </header>
      <nav className="hpD-tabbar" aria-label="Primary (phone)">
        {links.map(({ to, href, end, label, icon: Icon }) => (
          <NavLink key={to} to={href} end={end}>
            <Icon size={20} strokeWidth={1.9} />
            <span>{label === 'Operations' ? 'Ops' : label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};

/* ---- E: the current layout, scaled up -------------------------------------
   Same grid as today; taller bar, larger type, bigger avatar. Answers "is
   it just too small?" on its own. */
const VariantE = () => {
  const links = useLinks();
  return (
    <header className="hpE">
      <div className="hpE-inner">
        <NavLink className="hpE-brand" to={links[0].href}>
          <Mark size={28} />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpE-links" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <AccountMenu className="hpE-account" />
      </div>
    </header>
  );
};

/* ---- F: tall masthead that shrinks on scroll ------------------------------
   Big at the top of the page, compact once you scroll into the data. */
const useScrolled = (threshold = 40) => {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
};

const VariantF = () => {
  const links = useLinks();
  const scrolled = useScrolled();
  return (
    <header className={`hpF${scrolled ? ' is-compact' : ''}`}>
      <div className="hpF-inner">
        <NavLink className="hpF-brand" to={links[0].href}>
          <Mark size={scrolled ? 22 : 34} />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpF-links" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <AccountMenu showName={!scrolled} className="hpF-account" />
      </div>
    </header>
  );
};

/* ---- G: left sidebar ------------------------------------------------------
   No top bar on desktop: the page gets the full height, nav gets room for
   icons and an admin section. Phone falls back to a slim top bar. */
const VariantG = () => {
  const links = useLinks();
  const main = links.filter((link) => !link.admin);
  const ops = links.find((link) => link.admin);
  const item = ({ to, href, end, label, icon: Icon }) => (
    <NavLink key={to} to={href} end={end}>
      <Icon size={18} strokeWidth={1.9} />
      <span>{label}</span>
    </NavLink>
  );
  return (
    <aside className="hpG">
      <NavLink className="hpG-brand" to={links[0].href}>
        <Mark size={26} />
        <span>CourtAI</span>
      </NavLink>
      <nav className="hpG-nav" aria-label="Primary">
        {main.map(item)}
        {ops && (
          <>
            <span className="hpG-section">Admin</span>
            {item(ops)}
          </>
        )}
      </nav>
      <AccountMenu className="hpG-account" />
    </aside>
  );
};

/* ---- H: centered masthead -------------------------------------------------
   A publication-style masthead: big centred wordmark, nav on its own row
   beneath, account tucked in the corner. */
const VariantH = () => {
  const links = useLinks();
  const { day, games } = slateLabel();
  return (
    <header className="hpH">
      <div className="hpH-top">
        <span className="hpH-date">
          {day} · {games} games
        </span>
        <NavLink className="hpH-brand" to={links[0].href}>
          <Mark size={30} />
          <span>CourtAI</span>
        </NavLink>
        <AccountMenu className="hpH-account" />
      </div>
      <nav className="hpH-nav" aria-label="Primary">
        {links.map((link) => (
          <NavLink key={link.to} to={link.href} end={link.end}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

/* ---- Now: the current header, verbatim, for comparison -------------------- */
const VariantNow = () => {
  const { isAuthenticated } = useAuth();
  const links = useLinks();
  return (
    <header className="app-header">
      <nav className="app-nav" aria-label="Primary">
        <NavLink className="app-brand" to={links[0].href}>
          CourtAI
        </NavLink>
        <div className="app-links">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="app-auth">{isAuthenticated ? <UserProfile /> : <LoginButton size="sm" />}</div>
      </nav>
    </header>
  );
};

const VARIANTS = {
  E: VariantE,
  F: VariantF,
  G: VariantG,
  H: VariantH,
  A: VariantA, B: VariantB, C: VariantC, D: VariantD, Now: VariantNow };

const HeaderPrototype = ({ variant, step }) => {
  const ref = useRef(null);
  usePublishHeight(ref);
  const Variant = VARIANTS[variant];
  return (
    <div ref={ref} className={`hp-root hp-root-${variant}`}>
      <Variant />
      <PrototypeSwitcher variant={variant} onStep={step} />
    </div>
  );
};

export default HeaderPrototype;
