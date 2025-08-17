import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import GameLogFilter from './GameLogFilter.js';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <ProtectedRoute>
          <GameLogFilter />
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}

export default App;
