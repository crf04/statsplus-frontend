import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import GameLogFilter from './GameLogFilter.js';
import MatchupDetailPrototype from './prototype/MatchupDetailPrototype';
import './App.css';

function App() {
  // THROWAWAY PROTOTYPE gate — wayfinder crf04/statsplus#7. Dev-only, mock
  // data, no auth. Open http://localhost:5173/?prototype=matchup
  if (
    process.env.NODE_ENV !== 'production' &&
    new URLSearchParams(window.location.search).get('prototype') === 'matchup'
  ) {
    return <MatchupDetailPrototype />;
  }

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
