import { Component, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useFirstTouchSender } from './attribution/firstTouch';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminProtectedRoute from './components/Auth/AdminProtectedRoute';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import WaitlistBanner from './components/Auth/WaitlistBanner';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import { FeedbackProvider } from './feedback/FeedbackContext';
import FeedbackButton from './feedback/FeedbackButton';
import SiteFooter from './legal/SiteFooter';
import { reportRenderError } from './errorReporting';
import { isReloadingForMissingAsset } from './staleBuild';
import './App.css';
// PROTOTYPE (throwaway, branch prototype/profiles-simplify): no-login replay build.
import { PROTO_STANDALONE } from './profilesPrototype/mode';
import { DEMO_URL, installMockApi } from './profilesPrototype/mock/install';

if (PROTO_STANDALONE) {
  installMockApi();
  if (!window.location.search) window.history.replaceState(null, '', DEMO_URL);
}

const GameLogFilter = lazy(() => import('./GameLogFilter.js'));
const SlatePage = lazy(() => import('./SlatePage'));
const MatchupDetailPage = lazy(() => import('./matchups/MatchupDetailPage'));
const OperationsPage = lazy(() => import('./operations/OperationsPage'));
const TargetsPage = lazy(() => import('./targets/TargetsPage'));
const TargetDetailPage = lazy(() => import('./targets/TargetDetailPage'));
const QueryReferencePage = lazy(() => import('./help/QueryReferencePage'));
const ConnectPage = lazy(() => import('./connect/ConnectPage'));
const InjuryBriefSkillPage = lazy(() => import('./skills/InjuryBriefSkillPage'));
const ReportPage = lazy(() => import('./reports/ReportPage'));
const PrivacyPage = lazy(() => import('./legal/PrivacyPage'));
const TermsPage = lazy(() => import('./legal/TermsPage'));

class RouteErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (!isReloadingForMissingAsset()) reportRenderError(error, info);
  }

  render() {
    if (this.state.failed && isReloadingForMissingAsset()) {
      return <p role="status">Loading page…</p>;
    }
    if (this.state.failed) {
      return (
        <div role="alert">
          <p>Could not load this page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteContent({ children }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary key={pathname}>
      <Suspense fallback={<p role="status">Loading page…</p>}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

function AppNav() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <header className="app-header">
      <nav className="app-nav" aria-label="Primary">
        <NavLink className="app-brand" to="/">
          CourtAI
        </NavLink>
        <div className="app-links">
          <NavLink to="/" end>
            Search
          </NavLink>
          <NavLink to="/matchups">Matchups</NavLink>
          <NavLink to="/targets">Targets</NavLink>
          <NavLink to="/connect">Connect</NavLink>
          {isAuthenticated && isAdmin && <NavLink to="/operations">Operations</NavLink>}
        </div>
        <div className="app-auth">
          {isAuthenticated ? (
            <>
              <FeedbackButton />
              <UserProfile />
            </>
          ) : (
            <LoginButton size="sm" />
          )}
        </div>
      </nav>
    </header>
  );
}

// A waitlisted account has nothing signed-in to show but the public home page
// the legal pages and public reports: a banner explains why, and every other path returns home
// until it signs out.
function WaitlistedShell() {
  const { pathname, search } = useLocation();
  // A link's query string would open the workspace, which a waitlisted account
  // cannot use, so it too returns to the bare home page. Other pages ignore it.
  if (pathname === '/' && search) return <Navigate to="/" replace />;
  return (
    <>
      <AppNav />
      <RouteContent>
        <Routes>
          <Route path="/" element={<GameLogFilter notice={<WaitlistBanner />} />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/reports/:id" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteContent>
      <SiteFooter />
    </>
  );
}

function SignedInShell() {
  const { isAuthenticated, waitlist, currentUser } = useAuth();
  useFirstTouchSender(currentUser?.uid);
  if (isAuthenticated && waitlist) return <WaitlistedShell />;

  return (
    <>
      <AppNav />
      <RouteContent>
        <Routes>
          <Route path="/" element={<GameLogFilter />} />
          <Route path="/help" element={<QueryReferencePage />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/skills/injury-brief" element={<InjuryBriefSkillPage />} />
          <Route path="/reports/:id" element={<ReportPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/matchups" element={<SlatePage />} />
          <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
          <Route path="/targets" element={<TargetsPage />} />
          <Route path="/targets/:targetId" element={<TargetDetailPage />} />
          <Route
            path="/operations"
            element={
              <AdminProtectedRoute>
                <OperationsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/operations"
            element={
              <AdminProtectedRoute>
                <OperationsPage />
              </AdminProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteContent>
      <SiteFooter />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FeedbackProvider>
          <div className="App">
            <ProtectedRoute>
              <SignedInShell />
            </ProtectedRoute>
          </div>
        </FeedbackProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
