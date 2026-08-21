import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Form, Button } from 'react-bootstrap';
import { Search, CheckCircle, AlertCircle, Brain } from 'lucide-react';
import { apiClient, getApiUrl } from './config';
import { useAuth } from './contexts/AuthContext';
import { convertNLToFilters } from './filterUtils';
import { getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import { NL_QUERY_TIMEOUT } from './apiSettings';
import QueryLadder from './help/QueryLadder';
import './ModernSearch.css';

const sampleQueries = [
  'LeBron James this year',
  'Stephen Curry with Jimmy Butler',
  'Giannis at home since November without Khris Middleton shooting 15+ times',
  'Kevin Durant without Devin Booker playing 30+ minutes',
  'Luka last 10 games against top 10 paint defenses',
];

const NaturalLanguageQuery = ({
  onFiltersApplied,
  onQueryUpdate,
  resetToLanding,
  gameLogsLoading,
  inWorkspace = false,
}) => {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  // Combined loading state: true if either NL query or game logs are loading
  const isLoading = loading || gameLogsLoading;
  const searchRef = useRef(null);
  const queryRequestRef = useRef({ id: 0, controller: null });

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Reset to landing page when requested by parent
  useEffect(() => {
    if (resetToLanding) {
      queryRequestRef.current.controller?.abort();
      queryRequestRef.current = { id: queryRequestRef.current.id + 1, controller: null };
      setLoading(false);
      setHasSearched(false);
      setQuery('');
      setError('');
      setLastResult(null);
      setIsExpanded(false);
    }
  }, [resetToLanding]);

  // Close expanded search bar when transitioning to results page
  useEffect(() => {
    if (hasSearched && !isLoading) {
      setIsExpanded(false);
    }
  }, [hasSearched, isLoading]);

  // An example chosen on the query reference page arrives as router state.
  useEffect(() => {
    const seeded = location.state?.query;
    if (seeded) setQuery(seeded);
  }, [location.state]);

  // Cycle real example queries through the landing placeholder so the
  // query language demos itself before the user types anything.
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    if (hasSearched || !isAuthenticated) return undefined;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % sampleQueries.length);
    }, 4000);
    return () => clearInterval(id);
  }, [hasSearched, isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setLastResult(null);

    queryRequestRef.current.controller?.abort();
    const requestId = queryRequestRef.current.id + 1;
    const controller = new AbortController();
    queryRequestRef.current = { id: requestId, controller };

    const finishLoading = (success) => {
      if (queryRequestRef.current.id !== requestId) return;
      setLoading(false);
      if (success) setHasSearched(true);
    };

    try {
      const response = await apiClient.post(
        getApiUrl('NL_QUERY'),
        {
          query: query.trim(),
        },
        { signal: controller.signal, timeout: NL_QUERY_TIMEOUT },
      );

      if (queryRequestRef.current.id !== requestId) return;

      const result = response.data;
      setLastResult(result);

      // Convert NL result to frontend filter format
      const filters = convertNLToFilters(result);

      // A successful parser response can still contain no usable filters.
      // Finish the request explicitly so the search UI cannot remain locked.
      if (Object.keys(filters).length === 0) {
        setError(
          'I could not find usable filters in that query. Please try a player or stat filter.',
        );
        finishLoading(false);
        return;
      }

      // Apply filters to the parent component (includes player selection)
      if (onFiltersApplied) {
        // Pass a callback to clear this component's loading state
        const application = onFiltersApplied(filters, finishLoading);
        // Parent handlers normally resolve after the game-log request and call
        // finishLoading themselves. This fallback also supports lightweight
        // embedders that return a promise but do not use the callback seam.
        if (application && typeof application.then === 'function') {
          application
            .then((result) => {
              if (
                queryRequestRef.current.id === requestId &&
                queryRequestRef.current.controller === controller
              ) {
                finishLoading(result?.ok === true);
              }
            })
            .catch(() => finishLoading(false));
        }
      } else {
        finishLoading(true);
      }

      // Update parent with the successful query
      if (onQueryUpdate) {
        onQueryUpdate(query.trim());
      }
    } catch (err) {
      if (isRequestCancelled(err) || queryRequestRef.current.id !== requestId) return;
      console.error('NL Query Error:', err.response?.status || err.message);
      setError(getRequestErrorMessage(err, 'Failed to process query. Please try again.'));
      finishLoading(false);
      // Don't set hasSearched to true on error - keep user on landing page to retry
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'danger';
  };

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 0.8) return <CheckCircle size={16} />;
    if (confidence >= 0.6) return <AlertCircle size={16} />;
    return <AlertCircle size={16} />;
  };

  // Landing page interface (before first search)
  if (!hasSearched && !inWorkspace) {
    return (
      <div className="landing-page">
        <svg className="court-lines" viewBox="0 0 1200 800" aria-hidden="true" focusable="false">
          {/* half-court line */}
          <line x1="0" y1="400" x2="1200" y2="400" />
          {/* center circle behind the search bar */}
          <circle cx="600" cy="400" r="150" />
          <circle cx="600" cy="400" r="48" />
          {/* three-point arc + key, entering from the bottom */}
          <path d="M 240 800 L 240 720 A 360 360 0 0 1 960 720 L 960 800" />
          <rect x="480" y="640" width="240" height="160" />
          <circle cx="600" cy="640" r="72" className="court-dash" />
        </svg>
        <div className="landing-container">
          <div className="landing-header">
            <h1 className="landing-title">
              <span className="dynamic-title-text">CourtAI</span>
            </h1>
            <p className="landing-tagline">NBA game-log analytics, asked in plain English.</p>
          </div>

          <div className="landing-search-wrapper">
            <Form onSubmit={handleSubmit} className="landing-search-form">
              <div className="landing-input-wrapper">
                <Search className={`landing-search-icon ${isLoading ? 'loading' : ''}`} size={22} />
                <Form.Control
                  type="text"
                  placeholder={
                    isLoading
                      ? 'Processing query...'
                      : isAuthenticated
                        ? sampleQueries[placeholderIdx]
                        : 'Sign in to enter a query...'
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading || !isAuthenticated}
                  className={`landing-search-input ${isLoading ? 'loading' : ''}`}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !query.trim() || !isAuthenticated}
                  className="landing-search-button"
                >
                  {isLoading ? <div className="custom-spinner"></div> : <Brain size={18} />}
                </Button>
              </div>
            </Form>
          </div>

          <QueryLadder
            onUseQuery={setQuery}
            disabled={isLoading || !isAuthenticated}
            currentQuery={query}
          />

          {error && (
            <div className="landing-error">
              <AlertCircle className="landing-error-icon" size={20} />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compact interface (after search)
  return (
    <div className="compact-search-wrapper" ref={searchRef}>
      <div className="compact-header-controls">
        {!isExpanded ? (
          <button
            className="search-toggle-button"
            onClick={() => setIsExpanded(true)}
            aria-label="Open search"
          >
            <Search size={22} />
          </button>
        ) : null}
      </div>
      {isExpanded ? (
        <div className="compact-search-container expanded">
          <Form onSubmit={handleSubmit} className="compact-search-form">
            <div className="compact-input-wrapper">
              <Search className={`compact-search-icon ${isLoading ? 'loading' : ''}`} size={20} />
              <Form.Control
                type="text"
                placeholder={
                  isLoading
                    ? 'Processing query...'
                    : isAuthenticated
                      ? 'Ask about your favorite player'
                      : 'Login to enter a query'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading || !isAuthenticated}
                className={`compact-search-input ${isLoading ? 'loading' : ''}`}
                autoFocus
              />
              <Button
                type="submit"
                disabled={isLoading || !query.trim() || !isAuthenticated}
                className="compact-search-button"
              >
                {isLoading ? <div className="custom-spinner-compact"></div> : <Brain size={16} />}
              </Button>
              <Button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="compact-close-button"
                aria-label="Close search"
              >
                ×
              </Button>
            </div>
          </Form>

          {error && (
            <div className="compact-error">
              <AlertCircle className="compact-error-icon" size={16} />
              {error}
            </div>
          )}

          {lastResult && (
            <div className="compact-results">
              <div className="compact-results-header">
                <span className="compact-results-title">Query Understanding</span>
                <div
                  className={`compact-confidence-badge confidence-${getConfidenceColor(lastResult.confidence)}`}
                >
                  {getConfidenceIcon(lastResult.confidence)}
                  <span>{Math.round(lastResult.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NaturalLanguageQuery;
