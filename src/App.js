import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminProtectedRoute from './components/Auth/AdminProtectedRoute';
import GameLogFilter from './GameLogFilter.js';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import SlatePage from './SlatePage';
import MatchupDetailPage from './matchups/MatchupDetailPage';
import OperationsPage from './operations/OperationsPage';
import QueryReferencePage from './help/QueryReferencePage';
// PROTOTYPE (throwaway, branch prototype/targets-look): a Targets page and
// nav link, never in production. Delete these lines and the PROTOTYPE blocks
// below to remove.
import TargetsPrototypePage from './prototype/targets/TargetsPrototypePage';
import SlatePrototypePage from './prototype/targets/SlatePrototypePage';
import { PROTO_ENABLED, PROTO_STANDALONE } from './prototype/targets/prototypeMode';
import './App.css';

const PROTO = PROTO_ENABLED;

function AppNav() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <header className="app-header">
      <nav className="app-nav" aria-label="Primary">
        <NavLink className="app-brand" to="/">
          CourtAI
        </NavLink>
        <div className="app-links">
          {/* PROTOTYPE (throwaway): a standalone prototype build hides the app links. */}
          {!PROTO_STANDALONE && (
            <NavLink to="/" end>
              Search
            </NavLink>
          )}
          {PROTO_STANDALONE ? (
            <NavLink to="/prototype/matchups">Matchups</NavLink>
          ) : (
            <NavLink to="/matchups">Matchups</NavLink>
          )}
          {PROTO && <NavLink to="/prototype/targets">Targets</NavLink>}
          {isAuthenticated && isAdmin && <NavLink to="/operations">Operations</NavLink>}
        </div>
        <div className="app-auth">
          {/* PROTOTYPE (throwaway): standalone build has no sign-in. */}
          {!PROTO_STANDALONE && (isAuthenticated ? <UserProfile /> : <LoginButton size="sm" />)}
        </div>
      </nav>
    </header>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          {/* PROTOTYPE (throwaway): standalone build is only the Targets page, unauthenticated. */}
          {PROTO_STANDALONE ? (
            <>
              <AppNav />
              <Routes>
                <Route path="/prototype/matchups" element={<SlatePrototypePage />} />
                <Route path="/prototype/targets" element={<TargetsPrototypePage />} />
                <Route path="/prototype/targets/:targetId" element={<TargetsPrototypePage />} />
                <Route
                  path="*"
                  element={
                    <Navigate
                      to={{ pathname: '/prototype/matchups', search: window.location.search }}
                      replace
                    />
                  }
                />
              </Routes>
            </>
          ) : (
            <ProtectedRoute>
              <AppNav />
              <Routes>
                {/* PROTOTYPE (throwaway): standalone build lands on the Targets page. */}
                <Route
                  path="/"
                  element={
                    PROTO_STANDALONE ? (
                      <Navigate to="/prototype/targets" replace />
                    ) : (
                      <GameLogFilter />
                    )
                  }
                />
                <Route path="/help" element={<QueryReferencePage />} />
                <Route path="/matchups" element={<SlatePage />} />
                <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
                {/* PROTOTYPE (throwaway) */}
                {PROTO && <Route path="/prototype/targets" element={<TargetsPrototypePage />} />}
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
            </ProtectedRoute>
          )}
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
