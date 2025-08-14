import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Spinner, Modal } from 'react-bootstrap';
import { Search, CheckCircle, AlertCircle, Brain, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from './config';
import './ModernSearch.css';

const NaturalLanguageQuery = ({ onFiltersApplied, onPlayerSelected, onQueryUpdate, resetToLanding, gameLogsLoading, onLoadingComplete }) => {
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
      setHasSearched(false);
      setQuery('');
      setError('');
      setLastResult(null);
      setIsExpanded(false);
    }
  }, [resetToLanding]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setLastResult(null);
    setHasSearched(true);

    try {
      const response = await axios.post(getApiUrl('NL_QUERY'), {
        query: query.trim()
      });

      const result = response.data;
      setLastResult(result);

      // Convert NL result to frontend filter format
      const filters = convertNLToFilters(result);
      console.log('NL Query - original result:', result);
      console.log('NL Query - converted filters:', filters);
      
      // Apply filters to the parent component (includes player selection)
      if (onFiltersApplied) {
        // Pass a callback to clear this component's loading state
        onFiltersApplied(filters, () => setLoading(false));
      }
      
      // Update parent with the successful query
      if (onQueryUpdate) {
        onQueryUpdate(query.trim());
      }
      
      // Keep search expanded to show result/loading state
      // setIsExpanded(false); // Commented out to keep search visible during/after API calls
      
      // Note: Player selection is now handled via filters to prevent duplicate API calls
      // Don't set loading to false here - let the parent component handle it via gameLogsLoading

    } catch (err) {
      console.error('NL Query Error:', err);
      setError(err.response?.data?.error || 'Failed to process query. Please try again.');
      setLoading(false); // Only set loading to false on error
    }
  };

  const convertNLToFilters = (nlResult) => {
    const filters = {};
    
    // Include player name in filters to avoid separate API call
    if (nlResult.player_name) {
      filters.selectedPlayer = nlResult.player_name;
    }
    
    // Map common NL results to backend API format (snake_case)
    if (nlResult.game_count) {
      filters.game_filter = nlResult.game_count;
    }
    
    if (nlResult.location) {
      // Convert "home"/"away" to backend format
      filters.location_filter = nlResult.location === 'home' ? 'Home' : 
                               nlResult.location === 'away' ? 'Away' : 'Both';
    }
    
    // Convert players_on/off to backend array format
    if (nlResult.players_on && nlResult.players_on.length > 0) {
      filters['players_on[]'] = nlResult.players_on;
    }
    
    if (nlResult.players_off && nlResult.players_off.length > 0) {
      filters['players_off[]'] = nlResult.players_off;
    }
    
    if (nlResult.season) {
      filters.season_filter = nlResult.season;
    }

    if (nlResult.teams_against && nlResult.teams_against.length > 0) {
      filters['teams_against[]'] = nlResult.teams_against;
    }
    
    if (nlResult.rank_filter && nlResult.rank_filter.length > 0) {
      filters['rank_filter[]'] = nlResult.rank_filter;
    }

    // Handle minutes filter - convert to comma-separated string format for (min, max) tuple
    if (nlResult.minutes_filter) {
      if (Array.isArray(nlResult.minutes_filter) && nlResult.minutes_filter.length === 2) {
        // If it's already an array with 2 elements, join with comma for (min, max) format
        filters.minutes_filter = nlResult.minutes_filter.join(',');
      } else if (typeof nlResult.minutes_filter === 'string') {
        // If it's already a string, use as is
        filters.minutes_filter = nlResult.minutes_filter;
      } else if (typeof nlResult.minutes_filter === 'object' && nlResult.minutes_filter.min !== undefined && nlResult.minutes_filter.max !== undefined) {
        // If it's an object with min/max properties, convert to (min, max) format
        filters.minutes_filter = `${nlResult.minutes_filter.min},${nlResult.minutes_filter.max}`;
      }
    }

    // Handle self filters - convert SelfFilter objects to backend format
    if (nlResult.self_filters && Array.isArray(nlResult.self_filters)) {
      // Convert SelfFilter objects to the old format that the route expects
      const selfFiltersDict = {};
      
      nlResult.self_filters.forEach(filter => {
        if (filter && filter.stat_column && filter.operator && filter.value !== undefined) {
          const statName = filter.stat_column;
          
          if (filter.operator === 'between' && filter.value2 !== undefined) {
            // Range filter: between value and value2
            selfFiltersDict[statName] = [filter.value, filter.value2];
          } else if (filter.operator === 'gte') {
            // Greater than or equal: use value as minimum, set high maximum
            selfFiltersDict[statName] = [filter.value, 999];
          } else if (filter.operator === 'gt') {
            // Greater than: use value+1 as minimum, set high maximum
            selfFiltersDict[statName] = [filter.value + 1, 999];
          } else if (filter.operator === 'lte') {
            // Less than or equal: use 0 as minimum, value as maximum
            selfFiltersDict[statName] = [0, filter.value];
          } else if (filter.operator === 'lt') {
            // Less than: use 0 as minimum, value-1 as maximum
            selfFiltersDict[statName] = [0, filter.value - 1];
          } else if (filter.operator === 'eq') {
            // Equal: use value as both minimum and maximum
            selfFiltersDict[statName] = [filter.value, filter.value];
          }
        }
      });
      
      // Convert the dictionary to the format expected by the route
      Object.entries(selfFiltersDict).forEach(([statName, [minVal, maxVal]]) => {
        filters[`self_filters[${statName}]`] = `${minVal},${maxVal}`;
      });
    } else if (nlResult.self_filters && typeof nlResult.self_filters === 'object' && !Array.isArray(nlResult.self_filters)) {
      // Handle legacy format (direct object)
      Object.entries(nlResult.self_filters).forEach(([statName, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            // If it's an array, join with comma
            filters[`self_filters[${statName}]`] = value.join(',');
          } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
            // If it's an object with min/max properties
            filters[`self_filters[${statName}]`] = `${value.min},${value.max}`;
          } else {
            // If it's a single value, convert to string
            filters[`self_filters[${statName}]`] = String(value);
          }
        }
      });
    }

    return filters;
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

  const sampleQueries = [
    "LeBron James last 10 games",
    "Stephen Curry with Jimmy Butler",
    "Giannis at home since November",
    "Kevin Durant without Devin Booker",
    "Luka last 5 games against top 10 defenses"
  ];

  // Landing page interface (before first search)
  if (!hasSearched) {
    return (
      <div className="landing-page">
        <div className="landing-container">
          <div className="landing-header">
            <h1 className="landing-title">CourtAI</h1>
            <button 
              className="prompting-guide-button"
              onClick={() => setShowPromptingGuide(true)}
              title="Prompting Guide"
            >
              <HelpCircle size={20} />
              <span>Prompting Guide</span>
            </button>
          </div>
          
          <div className="landing-search-wrapper">
            <Form onSubmit={handleSubmit} className="landing-search-form">
              <div className="landing-input-wrapper">
                <Search className="landing-search-icon" size={24} />
                <Form.Control
                  type="text"
                  placeholder={isLoading ? "Processing query..." : "Ask anything about NBA stats..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                  className={`landing-search-input ${isLoading ? 'loading' : ''}`}
                />
                <Button 
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="landing-search-button"
                >
                  {isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <Brain size={20} />
                  )}
                </Button>
              </div>
            </Form>
          </div>

          <div className="landing-samples">
            <div className="landing-samples-grid">
              {sampleQueries.map((sample, index) => (
                <div
                  key={index}
                  className="landing-sample-pill"
                  onClick={() => setQuery(sample)}
                >
                  {sample}
                </div>
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
                <p>To get started, just type in a query and click the search button. You can also click on the sample queries to get started.</p>
                <p>Think about your favorite player's upcoming matchups and see how they've performed in certain matchups.</p>
              </div>
            </div>

            {/* Player Queries Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>🏀 Player Queries</h4>
              <div style={modalStyles.content}>
                <p style={modalStyles.introText}>Pick a player and you can see an overview of their stats.</p>
                
                <div style={modalStyles.exampleBlock}>
                  <p style={modalStyles.label}>Basic Example:</p>
                  <code style={modalStyles.exampleCode}>"Steph Curry this year"</code>
                  <p style={modalStyles.description}>See stats for the 2024-2025 season</p>
                </div>

                <p style={modalStyles.highlight}>The cool thing is: you can enter much more complex queries with filters.</p>
                
                <div style={modalStyles.exampleBlock}>
                  <p style={modalStyles.label}>Try These:</p>
                  <div style={modalStyles.exampleList}>
                    <code style={modalStyles.exampleCode}>"LeBron James last 10 games"</code>
                    <code style={modalStyles.exampleCode}>"Giannis at home since November"</code>
                    <code style={modalStyles.exampleCode}>"Kevin Durant without Devin Booker"</code>
                  </div>
                </div>

                <p>You can remove outliers by adding filters like <code style={modalStyles.inlineCode}>"playing 30+ minutes"</code>.</p>
                
                <div style={modalStyles.advancedBlock}>
                  <p style={modalStyles.advancedTitle}>📈 Advanced Scenario:</p>
                  <p>Let's say the Hawks are playing without Trae Young against the Wizards. We can query games for Jalen Johnson specifically without Trae Young:</p>
                  <code style={modalStyles.exampleCode}>"Jalen Johnson games without Trae Young"</code>
                  
                  <p>Once you get the results, you can even see the Wizards defensive stats. Since they're a poor defense, you can further filter:</p>
                  <code style={modalStyles.exampleCode}>"Trae Young games without Jalen Johnson against bottom 10 defenses playing 25+ minutes"</code>
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

            {/* Advanced Examples Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>⚡ Advanced Examples</h4>
              <div style={modalStyles.content}>
                <p style={modalStyles.introText}>Complex multi-filter queries for detailed analysis:</p>
                
                <div style={modalStyles.exampleList}>
                  <div style={modalStyles.advancedExample}>
                    <code style={modalStyles.exampleCode}>"LeBron James games without Anthony Davis and with Austin Reaves last 15 games"</code>
                  </div>
                  
                  <div style={modalStyles.advancedExample}>
                    <code style={modalStyles.exampleCode}>"Trae Young games without Jalen Johnson against bottom 10 defenses since January 1st"</code>
                  </div>
                  
                  <div style={modalStyles.advancedExample}>
                    <code style={modalStyles.exampleCode}>"Giannis games at home with 10+ FGA playing 30+ minutes"</code>
                  </div>
                  
                  <div style={modalStyles.advancedExample}>
                    <code style={modalStyles.exampleCode}>"Anthony Davis games with Kyrie Irving and Klay Thompson"</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Pro Tips Section */}
            <div style={modalStyles.section}>
              <h4 style={modalStyles.sectionTitle}>💡 Pro Tips</h4>
              <div style={modalStyles.content}>
                <p style={modalStyles.introText}>Try to phrase queries in structured formats so it will be easier to understand.</p>
                
                <div style={modalStyles.tipsList}>
                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"last"</span>
                    <span style={modalStyles.tipText}>Use if you want to see the last 10 games</span>
                  </div>
                  
                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"since"</span>
                    <span style={modalStyles.tipText}>Use if you want to see games since a certain date</span>
                  </div>
                  
                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"without"</span>
                    <span style={modalStyles.tipText}>Use if you want to see games without a certain player</span>
                  </div>
                  
                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"with"</span>
                    <span style={modalStyles.tipText}>Use if you want to see games with a certain player</span>
                  </div>
                  
                  <div style={modalStyles.tip}>
                    <span style={modalStyles.keyword}>"against"</span>
                    <span style={modalStyles.tipText}>Use if you want to see games against an opponent filter</span>
                  </div>
                </div>
                
                <p style={modalStyles.noteText}>Currently supported opponent filters are:</p>
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
      {!isExpanded ? (
        <button 
          className="search-toggle-button"
          onClick={() => setIsExpanded(true)}
          aria-label="Open search"
        >
          <Search size={20} />
        </button>
      ) : (
        <div className="compact-search-container expanded">
          <Form onSubmit={handleSubmit} className="compact-search-form">
            <div className="compact-input-wrapper">
              <Search className="compact-search-icon" size={18} />
              <Form.Control
                type="text"
                placeholder={isLoading ? "Processing query..." : "Ask anything about NBA stats..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
                className={`compact-search-input ${isLoading ? 'loading' : ''}`}
                autoFocus
              />
              <Button 
                type="submit"
                disabled={isLoading || !query.trim()}
                className="compact-search-button"
              >
                {isLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <Brain size={16} />
                )}
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
                <div className={`compact-confidence-badge confidence-${getConfidenceColor(lastResult.confidence)}`}>
                  {getConfidenceIcon(lastResult.confidence)}
                  <span>{Math.round(lastResult.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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
};

export default NaturalLanguageQuery;
