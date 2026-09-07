import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminProtectedRoute from './components/Auth/AdminProtectedRoute';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import './App.css';

const GameLogFilter = lazy(() => import('./GameLogFilter.js'));
const SlatePage = lazy(() => import('./SlatePage'));
const MatchupDetailPage = lazy(() => import('./matchups/MatchupDetailPage'));
const OperationsPage = lazy(() => import('./operations/OperationsPage'));
const TargetsPage = lazy(() => import('./targets/TargetsPage'));
const TargetDetailPage = lazy(() => import('./targets/TargetDetailPage'));
const QueryReferencePage = lazy(() => import('./help/QueryReferencePage'));

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
          <ProtectedRoute>
            <AppNav />
            <Suspense fallback={<p role="status">Loading page…</p>}>
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
            </Suspense>
          </ProtectedRoute>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
