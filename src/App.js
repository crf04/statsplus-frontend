import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import TeamStats from './pages/TeamStats';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team-stats" element={<TeamStats />} />
      </Routes>
    </Router>
  );
}

export default App;
