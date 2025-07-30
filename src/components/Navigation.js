import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="brand-link">
            <span className="brand-icon">🏀</span>
            <span className="brand-text">CourtAI</span>
          </Link>
        </div>
        
        <div className="nav-links">
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Home</span>
          </Link>
          
          <Link 
            to="/game-logs" 
            className={`nav-link ${isActive('/game-logs') ? 'active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Game Logs</span>
          </Link>
          
          <Link 
            to="/team-matchup" 
            className={`nav-link ${isActive('/team-matchup') ? 'active' : ''}`}
          >
            <span className="nav-icon">⚔️</span>
            <span className="nav-text">Team Matchup</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 