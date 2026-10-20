import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Button } from 'react-bootstrap';
import { Search, CheckCircle, AlertCircle, Brain, ArrowRight } from 'lucide-react';
import { apiClient, getApiUrl } from './config';
import { useAuth } from './contexts/AuthContext';
import { useSignUpThen } from './components/Auth/useSignUpThen';
import {
  BROWSE_PARAM,
  applyPlayerChoices,
  convertNLToFilters,
  getPlayerChoices,
} from './filterUtils';
import { getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import { NL_QUERY_TIMEOUT } from './apiSettings';
import QueryLadder from './help/QueryLadder';
import LandingCourt from './LandingCourt';
import HomeTicker from './home/HomeTicker';
import HomeTonight from './home/HomeTonight';
import { useHomeTonight } from './home/useHomeTonight';
import { useLadderAnswers } from './help/useLadderAnswers';
import SiteFooter from './legal/SiteFooter';
import './home/home.css';
import './ModernSearch.css';
import ErrorMessage from './feedback/ErrorMessage';

const sampleQueries = [
  'LeBron James this year',
  'Stephen Curry with Jimmy Butler',
  'Giannis at home since November without Khris Middleton shooting 15+ times',
  'Kevin Durant without Devin Booker playing 30+ minutes',
  'Luka last 10 games against top 10 paint defenses',
];

// Asks which player a name meant. Each reference gets its own group of buttons;
// the Filter Set is applied by the parent once every group has an answer.
const PlayerChoices = ({ choices, chosen, onChoose, variant }) => (
  <div
    className={`player-choices player-choices-${variant}`}
    role="group"
    aria-label="Which player did you mean?"
  >
    <p className="player-choices-title">Which player did you mean?</p>
    {choices.map((choice, index) => (
      <div className="player-choices-reference" role="group" aria-label={choice.text} key={index}>
        <span className="player-choices-text">{choice.text}</span>
        <div className="player-choices-options">
          {choice.candidates.map((candidate, candidateIndex) => (
            <button
              type="button"
              key={candidateIndex}
              className="player-choice-button"
              aria-pressed={chosen[index] === candidateIndex}
              onClick={() => onChoose(index, candidateIndex)}
            >
              {candidate.name}
              {candidate.team && <span className="player-choice-team">{candidate.team}</span>}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const NaturalLanguageQuery = ({
  onFiltersApplied,
  onQueryUpdate,
  gameLogsLoading,
  inWorkspace = false,
  // Present only for a signed-in reader, because only an account has saved
  // Filter Sets to come back to.
  onOpenSavedFilterSets,
  // Shown on the Query Prompt under the ticker, e.g. the waitlist banner.
  notice = null,
}) => {
  const { isAuthenticated, currentUser, waitlist } = useAuth();
  // A waitlisted account has signed up but may not search yet, so it gets the
  // page without the sign-up calls to action and with the prompt disabled.
  const waitlisted = isAuthenticated && !!waitlist;
  const canSearch = isAuthenticated && !waitlisted;
  // Today's games and the ladder's answers are public; only the reader's
  // Targets belong to an admitted account (crf04/statsplus#211).
  const landing = !inWorkspace;
  const tonight = useHomeTonight(landing, canSearch ? currentUser?.uid || null : null);
  const ladderAnswers = useLadderAnswers(landing);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  // A response with ambiguous player references waits here, unapplied, until
  // the reader has picked a player for every one.
  const [pending, setPending] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const wasInWorkspace = useRef(inWorkspace);

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

  // Leaving the Log Workspace starts a fresh query. This watches the
  // transition rather than a signal prop, so there is no flag to resynchronise
  // and no timing workaround. A mount that merely lands on the Query Prompt —
  // arriving from the reference page with a draft, say — is not that
  // transition and must keep what it was seeded with.
  useEffect(() => {
    if (wasInWorkspace.current && !inWorkspace) {
      queryRequestRef.current.controller?.abort();
      queryRequestRef.current = { id: queryRequestRef.current.id + 1, controller: null };
      setLoading(false);
      setQuery('');
      setError('');
      setLastResult(null);
      setPending(null);
      setIsExpanded(false);
    }
    wasInWorkspace.current = inWorkspace;
  }, [inWorkspace]);

  // A question belongs to the page it was asked on. Any navigation — Browse,
  // Back, a link — abandons it; the picker's own apply clears it first.
  useEffect(() => {
    setPending(null);
  }, [location.key]);

  // Close expanded search bar when transitioning to results page
  useEffect(() => {
    if (inWorkspace && !isLoading) {
      setIsExpanded(false);
    }
  }, [inWorkspace, isLoading]);

  // An example chosen on the query reference page arrives as router state.
  useEffect(() => {
    const seeded = location.state?.query;
    if (seeded) setQuery(seeded);
  }, [location.state]);

  // Cycle real example queries through the landing placeholder so the
  // query language demos itself before the user types anything.
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    if (inWorkspace || waitlisted) return undefined;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % sampleQueries.length);
    }, 4000);
    return () => clearInterval(id);
  }, [inWorkspace, waitlisted]);

  // Convert a parsed query to the frontend filter format and hand it to the
  // parent, which includes the player selection.
  const applyParsedQuery = (result, submitted, finishLoading) => {
    const filters = convertNLToFilters(result);

    const application = onFiltersApplied
      ? onFiltersApplied(filters)
      : Object.keys(filters).length === 0
        ? { ok: false, reason: 'empty' }
        : { ok: true };

    if (application?.reason === 'empty') {
      setError(
        'I could not find usable filters in that query. Please try a player or stat filter.',
      );
    }

    finishLoading();

    if (application?.reason === 'empty') return;

    // Update parent with the successful query
    if (onQueryUpdate) {
      onQueryUpdate(submitted);
    }
  };

  // `chosen` holds each reference's candidate index, so two candidates with one
  // name stay distinct; only the name goes into the Filter Set.
  const choosePlayer = (index, candidateIndex) => {
    const chosen = [...pending.chosen];
    chosen[index] = candidateIndex;
    if (pending.choices.every((_, i) => chosen[i] !== undefined)) {
      const { result, choices, submitted } = pending;
      const names = choices.map((choice, i) => choice.candidates[chosen[i]].name);
      setPending(null);
      applyParsedQuery(applyPlayerChoices(result, choices, names), submitted, () => {});
      return;
    }
    setPending({ ...pending, chosen });
  };

  const runQuery = async (submitted) => {
    if (!submitted.trim()) return;

    // A query resumed after sign-in returns to a blank input; show what ran.
    setQuery(submitted);
    setLoading(true);
    setError('');
    setLastResult(null);
    setPending(null);

    queryRequestRef.current.controller?.abort();
    const requestId = queryRequestRef.current.id + 1;
    const controller = new AbortController();
    queryRequestRef.current = { id: requestId, controller };

    const finishLoading = () => {
      if (queryRequestRef.current.id !== requestId) return;
      setLoading(false);
    };

    try {
      const response = await apiClient.post(
        getApiUrl('NL_QUERY'),
        {
          query: submitted.trim(),
        },
        { signal: controller.signal, timeout: NL_QUERY_TIMEOUT },
      );

      if (queryRequestRef.current.id !== requestId) return;

      const result = response.data;
      setLastResult(result);

      const choices = getPlayerChoices(result);
      if (choices.length > 0) {
        // Apply nothing yet: the reader picks first.
        setPending({ result, choices, chosen: [], submitted: submitted.trim() });
        finishLoading();
        return;
      }

      applyParsedQuery(result, submitted.trim(), finishLoading);
    } catch (err) {
      if (isRequestCancelled(err) || queryRequestRef.current.id !== requestId) return;
      console.error('NL Query Error:', err.response?.status || err.message);
      setError(getRequestErrorMessage(err, 'Failed to process query. Please try again.'));
      finishLoading();
      // Stay on the Query Prompt on error so the query can be retried.
    }
  };

  // Signed out, running a query or browsing opens sign-up and then carries on
  // with what was asked.
  const submitQuery = useSignUpThen('query', runQuery);
  const browse = useSignUpThen('browse', () => navigate(`/?${BROWSE_PARAM}=1`));
  const handleSubmit = (e) => {
    e.preventDefault();
    return submitQuery(query);
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

  // The Query Prompt. Whether we are past it is the URL's business, not a flag
  // this component keeps.
  if (!inWorkspace) {
    return (
      <div className="landing-page">
        <div className="landing-stack">
          {tonight.games && (
            <HomeTicker
              slateDate={tonight.slateDate}
              games={tonight.games}
              fallback={tonight.fallback}
            />
          )}
          {notice && <div className="landing-notice">{notice}</div>}
          <div className="landing-container">
            <div className="landing-hero">
              <LandingCourt />
              <div className="landing-header">
                <Link to="/connect" className="landing-connect">
                  <span className="landing-connect-new">New</span> Ask CourtAI in Claude or ChatGPT
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <h1 className="landing-title">
                  Ask the <em>box score</em>
                </h1>
                <p className="landing-tagline">Name a player, add what matters, get the logs.</p>
              </div>

              <div className="landing-search-wrapper">
                <Form onSubmit={handleSubmit} className="landing-search-form">
                  <div className="landing-input-wrapper">
                    <Search
                      className={`landing-search-icon ${isLoading ? 'loading' : ''}`}
                      size={20}
                    />
                    <Form.Control
                      type="text"
                      placeholder={
                        isLoading
                          ? 'Processing query...'
                          : waitlisted
                            ? 'Search opens when your account is off the waitlist'
                            : sampleQueries[placeholderIdx]
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={isLoading || waitlisted}
                      className={`landing-search-input ${isLoading ? 'loading' : ''}`}
                    />
                    <Button
                      type="submit"
                      disabled={isLoading || !query.trim() || waitlisted}
                      className="landing-search-button"
                      aria-label="Run it"
                    >
                      {isLoading ? (
                        <div className="custom-spinner"></div>
                      ) : (
                        <>
                          <span className="landing-search-button-label">Run it</span>
                          <ArrowRight size={18} aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
                {pending && (
                  <PlayerChoices
                    choices={pending.choices}
                    chosen={pending.chosen}
                    onChoose={choosePlayer}
                    variant="landing"
                  />
                )}
                {!isAuthenticated && (
                  <p className="landing-signup-note">
                    Free account. Sign up with Google to run it.
                  </p>
                )}
              </div>

              {/* The deterministic door. Signed out it opens sign-up first, and
              waitlisted it is disabled, so the page does not reflow either way. */}
              <div className="prompt-browse">
                <button
                  type="button"
                  className="prompt-browse-button"
                  disabled={isLoading || waitlisted}
                  onClick={() => browse()}
                >
                  Browse without a query
                </button>
                {onOpenSavedFilterSets && (
                  <button
                    type="button"
                    className="prompt-browse-button"
                    disabled={isLoading}
                    onClick={onOpenSavedFilterSets}
                  >
                    Saved Filter Sets
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="home-wide">
            <QueryLadder
              onUseQuery={setQuery}
              disabled={isLoading || waitlisted}
              currentQuery={query}
              answers={ladderAnswers}
            />

            {tonight.games && (
              <HomeTonight
                games={tonight.games}
                spotlight={tonight.spotlight}
                targets={tonight.targets}
                signUp={!isAuthenticated}
                onUseQuery={setQuery}
                slateDate={tonight.slateDate}
                fallback={tonight.fallback}
              />
            )}

            {error && (
              <div className="landing-error">
                <AlertCircle className="landing-error-icon" size={20} />
                <ErrorMessage message={error} />
              </div>
            )}
          </div>
          {/* The landing page is a fixed, scrolling layer over the app shell, so
          the shell's footer sits beneath it: this one replaces it here. */}
          <SiteFooter />
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
                    : canSearch
                      ? 'Ask about your favorite player'
                      : 'Login to enter a query'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading || !canSearch}
                className={`compact-search-input ${isLoading ? 'loading' : ''}`}
                autoFocus
              />
              <Button
                type="submit"
                disabled={isLoading || !query.trim() || !canSearch}
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
              <ErrorMessage message={error} />
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
      {/* The search closes when a response arrives, but a question still
          waiting for its answer must stay on screen. */}
      {pending && (
        <PlayerChoices
          choices={pending.choices}
          chosen={pending.chosen}
          onChoose={choosePlayer}
          variant="compact"
        />
      )}
    </div>
  );
};

export default NaturalLanguageQuery;
