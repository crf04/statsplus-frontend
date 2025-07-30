import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage.js';
import GameLogFilter from './GameLogFilter.js';
import TeamMatchupPage from './TeamMatchupPage.js';
import Navigation from './components/Navigation.js';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game-logs" element={<GameLogFilter />} />
          <Route path="/team-matchup" element={<TeamMatchupPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
