import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import GameLogFilter from './GameLogFilter.js';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import SlatePage from './SlatePage';
import MatchupDetailPage from './matchups/MatchupDetailPage';
import './App.css';

function AppNav() {
  const { isAuthenticated } = useAuth();

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
              <Route path="/matchups" element={<SlatePage />} />
              <Route path="/matchups/:gameId" element={<MatchupDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ProtectedRoute>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
