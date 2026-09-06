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
import TargetsPage from './targets/TargetsPage';
import TargetDetailPage from './targets/TargetDetailPage';
import QueryReferencePage from './help/QueryReferencePage';
// PROTOTYPE (throwaway, branch prototype/targets-page-look): a standalone
// build is the Targets prototype and nothing else. Delete to remove.
import { PROTO_STANDALONE } from './prototype/targets-page/prototypeMode';
import './App.css';

function PrototypeApp() {
  return (
    <>
      <header className="app-header">
        <nav className="app-nav" aria-label="Primary">
          <span className="app-brand">CourtAI</span>
          <div className="app-links">
            <NavLink to="/targets">Targets</NavLink>
          </div>
          <div className="app-auth">
            <span
              style={{ color: 'var(--ct-dim)', fontFamily: 'var(--ct-mono)', fontSize: '0.7rem' }}
            >
              prototype · captured data · no sign-in
            </span>
          </div>
        </nav>
      </header>
      <Routes>
        <Route path="/targets" element={<TargetsPage />} />
        <Route path="*" element={<Navigate to="/targets?proto=targets&v=A" replace />} />
      </Routes>
    </>
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
          {isAuthenticated && isAdmin && <NavLink to="/operations">Operations</NavLink>}
        </div>
        <div className="app-auth">
          {isAuthenticated ? <UserProfile /> : <LoginButton size="sm" />}
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
          {PROTO_STANDALONE && <PrototypeApp />}
          {!PROTO_STANDALONE && (
            <ProtectedRoute>
              <AppNav />
              <Routes>
                <Route path="/" element={<GameLogFilter />} />
                <Route path="/help" element={<QueryReferencePage />} />
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
            </ProtectedRoute>
          )}
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
