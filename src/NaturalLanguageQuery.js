import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { Search, CheckCircle, AlertCircle, Brain } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from './config';
import './ModernSearch.css';

const NaturalLanguageQuery = ({ onFiltersApplied, onPlayerSelected, onQueryUpdate, resetToLanding }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
      
      // Apply filters to the parent component (includes player selection)
      if (onFiltersApplied) {
        onFiltersApplied(filters);
      }
      
      // Update parent with the successful query
      if (onQueryUpdate) {
        onQueryUpdate(query.trim());
      }
      
      // Close search after successful submission
      setIsExpanded(false);
      
      // Note: Player selection is now handled via filters to prevent duplicate API calls

    } catch (err) {
      console.error('NL Query Error:', err);
      setError(err.response?.data?.error || 'Failed to process query. Please try again.');
    } finally {
      setLoading(false);
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
    "Giannis at home this season",
    "Kevin Durant without Devin Booker",
    "Luka last 5 games against top teams"
  ];

  // Landing page interface (before first search)
  if (!hasSearched) {
    return (
      <div className="landing-page">
        <div className="landing-container">
          <div className="landing-header">
            <h1 className="landing-title">CourtAI</h1>
          </div>
          
          <div className="landing-search-wrapper">
            <Form onSubmit={handleSubmit} className="landing-search-form">
              <div className="landing-input-wrapper">
                <Search className="landing-search-icon" size={24} />
                <Form.Control
                  type="text"
                  placeholder="Ask anything about NBA stats..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                  className="landing-search-input"
                />
                <Button 
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="landing-search-button"
                >
                  {loading ? (
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
                placeholder="Ask anything about NBA stats..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                className="compact-search-input"
                autoFocus
              />
              <Button 
                type="submit"
                disabled={loading || !query.trim()}
                className="compact-search-button"
              >
                {loading ? (
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

export default NaturalLanguageQuery;
