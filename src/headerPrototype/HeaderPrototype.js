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

/* ---- I: fused with the ticker ---------------------------------------------
   A compact bar in the ticker's own ink with no rule between them, so header
   and scoreboard read as one console. Nav sits beside the brand; the active
   page gets the ticker's gold-soft label treatment. */
const VariantI = () => {
  const links = useLinks();
  return (
    <header className="hpI">
      <div className="hpI-inner">
        <NavLink className="hpI-brand" to={links[0].href}>
          <Mark size={20} />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpI-nav" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <AccountMenu className="hpI-account" />
      </div>
    </header>
  );
};

/* ---- J: quiet, everything right -------------------------------------------
   The brand stands alone on the left; nav and account share the right edge,
   so the centre stays empty above the ticker and the big headline. */
const VariantJ = () => {
  const links = useLinks();
  return (
    <header className="hpJ">
      <div className="hpJ-inner">
        <NavLink className="hpJ-brand" to={links[0].href}>
          <Mark size={24} />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpJ-nav" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <span className="hpJ-rule" aria-hidden="true" />
        <AccountMenu showName={false} className="hpJ-account" />
      </div>
    </header>
  );
};

/* ---- K: search docks into the header --------------------------------------
   Sticky compact bar. On the home page the search box joins the header only
   once the hero search scrolls away; on every other page it is always there.
   Clicking it returns to the hero search. */
const useHeroSearchHidden = (onHome) => {
  const [hidden, setHidden] = useState(!onHome);
  useEffect(() => {
    if (!onHome) {
      setHidden(true);
      return undefined;
    }
    setHidden(false);
    let observer;
    const timer = setInterval(() => {
      const hero = document.querySelector('.landing-search-form');
      if (!hero) return;
      clearInterval(timer);
      observer = new IntersectionObserver(([entry]) => setHidden(!entry.isIntersecting), {
        rootMargin: '-64px 0px 0px 0px',
      });
      observer.observe(hero);
    }, 200);
    return () => {
      clearInterval(timer);
      observer?.disconnect();
    };
  }, [onHome]);
  return hidden;
};

const focusHeroSearch = () => {
  document.querySelector('.landing-page')?.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => document.querySelector('.landing-search-form input')?.focus(), 350);
};

const VariantK = () => {
  const links = useLinks();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const onHome = pathname === '/' && !search;
  const showSearch = useHeroSearchHidden(onHome);
  const goSearch = () => {
    if (!onHome) navigate({ pathname: '/', hash });
    focusHeroSearch();
  };
  return (
    <header className="hpK">
      <div className="hpK-inner">
        <NavLink className="hpK-brand" to={links[0].href}>
          <Mark size={20} />
          <span>CourtAI</span>
        </NavLink>
        <nav className="hpK-nav" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.href} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className={`hpK-search${showSearch ? ' is-shown' : ''}`}
          onClick={goSearch}
          tabIndex={showSearch ? 0 : -1}
          aria-hidden={!showSearch}
        >
          <Search size={15} />
          <span>LeBron James this year</span>
        </button>
        <AccountMenu showName={false} className="hpK-account" />
      </div>
    </header>
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

/* ---- F: tall masthead that shrinks on scroll ------------------------------
   Big at the top of the page, compact once you scroll into the data. */
// The home page scrolls inside its own fixed overlay, other pages scroll the
// window; listen in the capture phase to hear both.
const scrollTopOf = (target) =>
  target && target !== document && target.scrollTop !== undefined
    ? target.scrollTop
    : window.scrollY;

const useScrolled = (threshold = 40) => {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setScrolled(false);
    const onScroll = (event) => setScrolled(scrollTopOf(event.target) > threshold);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [threshold, pathname]);
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
  I: VariantI,
  J: VariantJ,
  K: VariantK,
  A: VariantA,
  D: VariantD,
  F: VariantF,
  Now: VariantNow,
};

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
