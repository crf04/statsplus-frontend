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
import './App.css';

const PROTO = process.env.NODE_ENV !== 'production';

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
          {/* PROTOTYPE (throwaway) */}
          {PROTO && <NavLink to="/prototype/targets">Targets</NavLink>}
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
          <ProtectedRoute>
            <AppNav />
            <Routes>
              <Route path="/" element={<GameLogFilter />} />
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
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
