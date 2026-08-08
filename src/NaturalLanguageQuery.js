import { useState, useRef, useEffect } from 'react';
import { Form, Button, Modal } from 'react-bootstrap';
import { Search, CheckCircle, AlertCircle, Brain, HelpCircle } from 'lucide-react';
import { apiClient, getApiUrl } from './config';
import { useAuth } from './contexts/AuthContext';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import { convertNLToFilters } from './filterUtils';
import { getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
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
}) => {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPromptingGuide, setShowPromptingGuide] = useState(false);

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
        { signal: controller.signal },
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
  if (!hasSearched) {
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
            <div className="landing-auth-section">
              {isAuthenticated ? <UserProfile /> : <LoginButton size="sm" />}
            </div>
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
                <button
                  type="button"
                  className="landing-help-icon-right"
                  onClick={() => setShowPromptingGuide(true)}
                  title="Need help with your query? Click for examples and tips!"
                >
                  <HelpCircle size={18} />
                </button>
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

          <div className="landing-samples">
            <div className="landing-samples-label">Try a query</div>
            <div className="landing-samples-grid">
              {[sampleQueries[0], sampleQueries[3], sampleQueries[2]].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className={`landing-sample-pill ${isLoading ? 'loading-state' : ''}`}
                  onClick={() => setQuery(sample)}
                  disabled={isLoading || !isAuthenticated}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="landing-error">
              <AlertCircle className="landing-error-icon" size={20} />
              {error}
            </div>
          )}
        </div>

        {/* Prompting Guide Modal */}
        <Modal
          show={showPromptingGuide}
          onHide={() => setShowPromptingGuide(false)}
          size="lg"
          backdrop="static"
          style={modalStyles.modal}
        >
          <Modal.Header closeButton style={modalStyles.modalHeader}>
            <Modal.Title style={modalStyles.modalTitle}>📝 Prompting Guide</Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalStyles.modalBody}>
            {/* Getting Started Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>🚀 Getting Started</h4>
              <div style={modalStyles.content}>
                <div style={modalStyles.gettingStartedGrid}>
                  <div style={modalStyles.startStep}>
                    <div style={modalStyles.stepNumber}>1</div>
                    <div style={modalStyles.stepContent}>
                      <h5 style={modalStyles.stepTitle}>Type Your Query</h5>
                      <p style={modalStyles.stepText}>
                        Enter any question about NBA stats in natural language
                      </p>
                    </div>
                  </div>

                  <div style={modalStyles.startStep}>
                    <div style={modalStyles.stepNumber}>2</div>
                    <div style={modalStyles.stepContent}>
                      <h5 style={modalStyles.stepTitle}>Click Search</h5>
                      <p style={modalStyles.stepText}>
                        Hit the brain icon or press Enter to analyze your query
                      </p>
                    </div>
                  </div>

                  <div style={modalStyles.startStep}>
                    <div style={modalStyles.stepNumber}>3</div>
                    <div style={modalStyles.stepContent}>
                      <h5 style={modalStyles.stepTitle}>Explore Results</h5>
                      <p style={modalStyles.stepText}>
                        View detailed stats, charts, and game logs instantly
                      </p>
                    </div>
                  </div>
                </div>

                <div style={modalStyles.quickTip}>
                  <span style={modalStyles.quickTipIcon}>💡</span>
                  <span style={modalStyles.quickTipText}>
                    Try the sample queries below or think about your favorite player's upcoming
                    matchups!
                  </span>
                </div>
              </div>
            </div>

            {/* Player Queries Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>🏀 Player Queries</h4>
              <div style={modalStyles.content}>
                <p style={modalStyles.introText}>
                  Pick a player and you can see an overview of their stats.
                </p>

                <div style={modalStyles.exampleBlock}>
                  <p style={modalStyles.label}>Basic Example:</p>
                  <code style={modalStyles.exampleCode}>"Steph Curry this year"</code>
                  <p style={modalStyles.description}>See stats for the 2024-2025 season</p>
                </div>

                <p style={modalStyles.highlight}>
                  The cool thing is: you can enter much more complex queries with filters.
                </p>

                <div style={modalStyles.exampleBlock}>
                  <p style={modalStyles.label}>Try These:</p>
                  <div style={modalStyles.exampleList}>
                    <code style={modalStyles.exampleCode}>"LeBron James last 10 games"</code>
                    <code style={modalStyles.exampleCode}>"Giannis at home since November"</code>
                    <code style={modalStyles.exampleCode}>"Kevin Durant without Devin Booker"</code>
                  </div>
                </div>

                <p>
                  You can remove outliers by adding filters like{' '}
                  <code style={modalStyles.inlineCode}>"playing 30+ minutes"</code>.
                </p>

                <div style={modalStyles.advancedBlock}>
                  <p style={modalStyles.advancedTitle}>📈 Advanced Scenario:</p>
                  <p>
                    Let's say the Hawks are playing without Trae Young against the Wizards. We can
                    query games for Jalen Johnson specifically without Trae Young:
                  </p>
                  <code style={modalStyles.exampleCode}>
                    "Jalen Johnson games without Trae Young"
                  </code>

                  <p>
                    Once you get the results, you can even see the Wizards defensive stats. Since
                    they're a poor defense, you can further filter:
                  </p>
                  <code style={modalStyles.exampleCode}>
                    "Trae Young games without Jalen Johnson against bottom 10 defenses playing 25+
                    minutes"
                  </code>
                </div>
              </div>
            </div>

            {/* Pro Tips Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>💡 Pro Tips</h4>
              <div style={modalStyles.content}>
                <p style={modalStyles.introText}>
                  Try to phrase queries in structured formats for better understanding:
                </p>

                <div style={modalStyles.tipsList}>
                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"last"</span>
                    <span style={modalStyles.tipText}>
                      Use if you want to see the last 10 games
                    </span>
                  </div>

                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"since"</span>
                    <span style={modalStyles.tipText}>
                      Use if you want to see games since a certain date
                    </span>
                  </div>

                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"without"</span>
                    <span style={modalStyles.tipText}>
                      Use if you want to see games without a certain player
                    </span>
                  </div>

                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"with"</span>
                    <span style={modalStyles.tipText}>
                      Use if you want to see games with a certain player
                    </span>
                  </div>

                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"against"</span>
                    <span style={modalStyles.tipText}>
                      Use if you want to see games against an opponent filter
                    </span>
                  </div>
                </div>

                <div style={modalStyles.opponentFiltersSection}>
                  <h5 style={modalStyles.subSectionTitle}>🛡️ Opponent Filter Guide</h5>
                  <p style={modalStyles.filterNote}>
                    Use <code style={modalStyles.inlineCode}>"top"</code> for best defenses or{' '}
                    <code style={modalStyles.inlineCode}>"bottom"</code> for worst defenses.
                    Negative numbers = better matchups for the player.
                  </p>

                  <div style={modalStyles.filterGrid}>
                    <div style={modalStyles.filterCategory}>
                      <h6 style={modalStyles.categoryTitle}>📊 General Defense</h6>
                      <div style={modalStyles.filterList}>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_PTS:</strong> overall defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_REB:</strong> rebounds allowed
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_AST:</strong> assists allowed
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_STOCKS:</strong> steals+blocks allowed
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_FTA:</strong> fouls (FT attempts)
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_TOV:</strong> turnovers forced
                        </span>
                      </div>
                    </div>

                    <div style={modalStyles.filterCategory}>
                      <h6 style={modalStyles.categoryTitle}>🎯 Shot Type Defense</h6>
                      <div style={modalStyles.filterList}>
                        <span style={modalStyles.filterItem}>
                          <strong>C&S PTS:</strong> catch-and-shoot defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>PU PTS:</strong> pull-up shot defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>Less Than 10 ft:</strong> paint protection
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OPP_FG3M:</strong> threes allowed
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>C&S 3A:</strong> catch-shoot 3PT attempts
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>PU 2s/3s:</strong> pull-up defense
                        </span>
                      </div>
                    </div>

                    <div style={modalStyles.filterCategory}>
                      <h6 style={modalStyles.categoryTitle}>⚡ Play Type Defense</h6>
                      <div style={modalStyles.filterList}>
                        <span style={modalStyles.filterItem}>
                          <strong>Transition:</strong> fast-break defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>Isolation:</strong> iso defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>Spotup:</strong> spot-up defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>Handoff:</strong> handoff defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>OffScreen:</strong> off-screen defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>Postup:</strong> post-up defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>PRBallHandler/PRRollMan:</strong> pick-roll defense
                        </span>
                        <span style={modalStyles.filterItem}>
                          <strong>Cut:</strong> cutting defense
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Examples Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>⚡ Advanced Examples</h4>
              <div style={modalStyles.content}>
                <p style={modalStyles.introText}>
                  Complex multi-filter queries for detailed analysis:
                </p>

                <div style={modalStyles.compactExampleList}>
                  <code style={modalStyles.compactExampleCode}>
                    "LeBron James games without Anthony Davis and with Austin Reaves last 15 games"
                  </code>
                  <code style={modalStyles.compactExampleCode}>
                    "Trae Young games without Jalen Johnson against bottom 10 defenses since January
                    1st"
                  </code>
                  <code style={modalStyles.compactExampleCode}>
                    "Giannis games at home with 10+ FGA playing 30+ minutes"
                  </code>
                  <code style={modalStyles.compactExampleCode}>
                    "Anthony Davis games with Kyrie Irving and Klay Thompson against bottom 10 paint
                    defenses"
                  </code>
                </div>
              </div>
            </div>

            {/* Team Queries Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>🏟️ Team Queries</h4>
              <div style={modalStyles.content}>
                <p>Coming soon!</p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={modalStyles.modalFooter}>
            <Button
              variant="outline-warning"
              onClick={() => setShowPromptingGuide(false)}
              style={modalStyles.closeButton}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
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

const modalStyles = {
  modal: {
    color: '#ffffff',
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: 'none',
    borderBottom: '2px solid #f59e0b',
    color: '#ffffff',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  modalBody: {
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    color: '#ffffff',
    maxHeight: '70vh',
    overflowY: 'auto',
    padding: '30px',
  },
  modalFooter: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: 'none',
    borderTop: '1px solid #333333',
  },
  closeButton: {
    borderColor: '#f59e0b',
    color: '#f59e0b',
    fontWeight: '600',
  },
  section: {
    marginBottom: '30px',
    padding: '20px',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: '1px solid #333333',
    borderRadius: '12px',
    borderLeft: '4px solid #f59e0b',
  },
  sectionTitle: {
    color: '#f59e0b',
    marginBottom: '15px',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderBottom: '1px solid #333333',
    paddingBottom: '10px',
  },
  content: {
    color: '#cccccc',
    lineHeight: '1.6',
    fontSize: '0.95rem',
  },
  introText: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: '20px',
  },
  highlight: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#f59e0b',
    margin: '20px 0',
    fontStyle: 'italic',
  },
  exampleBlock: {
    background: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    margin: '16px 0',
  },
  advancedBlock: {
    background: 'rgba(76, 175, 80, 0.05)',
    border: '1px solid rgba(76, 175, 80, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    margin: '20px 0',
  },
  advancedTitle: {
    color: '#4caf50',
    fontWeight: '600',
    fontSize: '1rem',
    marginBottom: '12px',
  },
  label: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: '0.9rem',
    marginBottom: '8px',
  },
  description: {
    color: '#aaa',
    fontSize: '0.85rem',
    marginTop: '8px',
    fontStyle: 'italic',
  },
  exampleCode: {
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    color: '#f59e0b',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
    border: '1px solid #333',
    display: 'block',
    margin: '8px 0',
    whiteSpace: 'pre-wrap',
  },
  inlineCode: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
  },
  exampleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  advancedExample: {
    margin: '12px 0',
  },
  tipsList: {
    margin: '16px 0',
  },
  tip: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  keyword: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #ff8c00 100%)',
    color: '#000',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: '600',
    fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
    minWidth: '80px',
    textAlign: 'center',
  },
  tipText: {
    color: '#ccc',
    fontSize: '0.9rem',
  },
  noteText: {
    color: '#aaa',
    fontSize: '0.9rem',
    marginTop: '20px',
    fontStyle: 'italic',
  },
  // New styles for Getting Started section
  gettingStartedGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    margin: '20px 0',
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  startStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    padding: '20px',
    background: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '12px',
    transition: 'all 0.3s ease',
    width: '100%',
  },
  stepNumber: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #ff8c00 100%)',
    color: '#000',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: '700',
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#f59e0b',
    fontSize: '1rem',
    fontWeight: '600',
    margin: '0 0 8px 0',
  },
  stepText: {
    color: '#cccccc',
    fontSize: '0.9rem',
    lineHeight: '1.4',
    margin: 0,
  },
  quickTip: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(76, 175, 80, 0.05)',
    border: '1px solid rgba(76, 175, 80, 0.2)',
    borderRadius: '8px',
    marginTop: '20px',
  },
  quickTipIcon: {
    fontSize: '1.2rem',
  },
  quickTipText: {
    color: '#4caf50',
    fontSize: '0.95rem',
    fontWeight: '500',
  },
  // New styles for compact examples
  compactExampleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  compactExampleCode: {
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    color: '#f59e0b',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
    border: '1px solid #333',
    display: 'block',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.3',
  },
  // New styles for opponent filters section
  opponentFiltersSection: {
    marginTop: '30px',
    padding: '20px',
    background: 'rgba(30, 30, 30, 0.5)',
    border: '1px solid #444',
    borderRadius: '8px',
  },
  subSectionTitle: {
    color: '#f59e0b',
    fontSize: '1.1rem',
    fontWeight: '600',
    margin: '0 0 15px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #444',
  },
  filterNote: {
    color: '#cccccc',
    fontSize: '0.9rem',
    marginBottom: '20px',
    lineHeight: '1.5',
  },
  filterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  filterCategory: {
    background: 'rgba(20, 20, 20, 0.5)',
    padding: '15px',
    borderRadius: '6px',
    border: '1px solid #333',
    flex: '0 0 280px',
    minWidth: '280px',
    maxWidth: '320px',
  },
  categoryTitle: {
    color: '#f59e0b',
    fontSize: '0.95rem',
    fontWeight: '600',
    margin: '0 0 12px 0',
    paddingBottom: '6px',
    borderBottom: '1px solid #333',
  },
  filterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterItem: {
    color: '#cccccc',
    fontSize: '0.8rem',
    lineHeight: '1.3',
    display: 'block',
  },
};

export default NaturalLanguageQuery;
