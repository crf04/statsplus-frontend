import { Component, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useFirstTouchSender } from './attribution/firstTouch';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminProtectedRoute from './components/Auth/AdminProtectedRoute';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import WaitlistScreen from './components/Auth/WaitlistScreen';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import { reportRenderError } from './errorReporting';
import LegalFooter from './legal/LegalFooter';
import SignInTerms from './legal/SignInTerms';
import { PRIVACY_PATH, RESPONSIBLE_GAMBLING_PATH, TERMS_PATH } from './legal/legalConfig';
import './App.css';

const GameLogFilter = lazy(() => import('./GameLogFilter.js'));
const SlatePage = lazy(() => import('./SlatePage'));
const MatchupDetailPage = lazy(() => import('./matchups/MatchupDetailPage'));
const OperationsPage = lazy(() => import('./operations/OperationsPage'));
const TargetsPage = lazy(() => import('./targets/TargetsPage'));
const TargetDetailPage = lazy(() => import('./targets/TargetDetailPage'));
const QueryReferencePage = lazy(() => import('./help/QueryReferencePage'));
const ConnectPage = lazy(() => import('./connect/ConnectPage'));
const TermsPage = lazy(() => import('./legal/TermsPage'));
const PrivacyPage = lazy(() => import('./legal/PrivacyPage'));
const ResponsibleGamblingPage = lazy(() => import('./legal/ResponsibleGamblingPage'));

class RouteErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    reportRenderError(error, info);
  }

  render() {
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
            <UserProfile />
          ) : (
            <>
              <LoginButton size="sm" />
              <SignInTerms className="legal-signin-header" />
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// A waitlisted account has nothing signed-in to show: the screen replaces the
// header and every route until the user signs out.
function SignedInShell() {
  const { isAuthenticated, waitlist, currentUser } = useAuth();
  useFirstTouchSender(currentUser?.uid);
  if (isAuthenticated && waitlist) return <WaitlistScreen />;

  return (
    <>
      <AppNav />
      <RouteContent>
        <Routes>
          <Route path="/" element={<GameLogFilter />} />
          <Route path="/help" element={<QueryReferencePage />} />
          <Route path="/connect" element={<ConnectPage />} />
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
    </>
  );
}

// The legal pages are public: they are routed ahead of the signed-in shell, which
// sends unknown paths to `/` and shows a waitlisted account only its waitlist.
function LegalShell({ children }) {
  const { currentUser } = useAuth();
  useFirstTouchSender(currentUser?.uid);
  return (
    <>
      <AppNav />
      <RouteContent>{children}</RouteContent>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <ProtectedRoute>
            <Routes>
              <Route
                path={TERMS_PATH}
                element={
                  <LegalShell>
                    <TermsPage />
                  </LegalShell>
                }
              />
              <Route
                path={PRIVACY_PATH}
                element={
                  <LegalShell>
                    <PrivacyPage />
                  </LegalShell>
                }
              />
              <Route
                path={RESPONSIBLE_GAMBLING_PATH}
                element={
                  <LegalShell>
                    <ResponsibleGamblingPage />
                  </LegalShell>
                }
              />
              <Route path="*" element={<SignedInShell />} />
            </Routes>
            <LegalFooter />
          </ProtectedRoute>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
