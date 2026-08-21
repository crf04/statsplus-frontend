import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { apiClient, getApiUrl } from './config';
import './GameLogFilter.css';
import PlayerSelector from './PlayerSelector';
import FilterOptions from './FilterOptions';
import PlayerProfile from './PlayerProfile';
import OpposingTeamProfile from './OpposingTeamProfile';
import PerformanceAverages from './PerformanceAverages';
import ChartComponent from './ChartComponent';
import GameLogsTable from './GameLogsTable';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import PlayerStatsCards from './PlayerStatsCards';
import { useAuth } from './contexts/AuthContext';
import { fetchGameLogsData, getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import {
  cleanFilterParams,
  filterSetFromSearchParams,
  filterSetToSearchParams,
  mergeFilterSet,
  toGameLogParams,
} from './filterUtils';

const listNames = (names) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const GameLogFilter = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // The URL is the game-log API's own query string, so a link is readable
  // against the API documentation and needs no alias vocabulary.
  const { filters: urlFilters, invalid: urlInvalid } = useMemo(
    () => filterSetFromSearchParams(searchParams),
    [searchParams],
  );
  const hasUrlFilterSet = Object.keys(urlFilters).length > 0 || urlInvalid.length > 0;
  const [selectedPlayer, setSelectedPlayer] = useState('None');
  const [displayPlayer, setDisplayPlayer] = useState('None'); // For UI display (includes NL queries)
  const [selectedTeam, setSelectedTeam] = useState('');
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  const [gameLogs, setGameLogs] = useState([]);
  const [averages, setAverages] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [initialGameLogs, setInitialGameLogs] = useState([]);
  const [showLandingPage, setShowLandingPage] = useState(!hasUrlFilterSet);
  const [currentQuery, setCurrentQuery] = useState(''); // Track the current search query
  const [resetToLanding, setResetToLanding] = useState(false); // Signal to reset NL component
  const [isGameLogsLoading, setIsGameLogsLoading] = useState(false); // Track game logs API loading
  const [gameLogsError, setGameLogsError] = useState(null);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState(null);
  const listRequestRef = useRef({ id: 0, controller: null });
  const gameLogsRequestRef = useRef({ id: 0, controller: null });
  const teamsRef = useRef([]);
  const wasInWorkspace = useRef(false);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  // Player/team lists are protected data. Fetch them only after auth has
  // settled, and refetch on every auth transition (login/logout).
  useEffect(() => {
    const previousRequest = listRequestRef.current;
    previousRequest.controller?.abort();
    const requestId = previousRequest.id + 1;
    listRequestRef.current = { id: requestId, controller: null };

    if (authLoading) {
      setListsLoading(false);
      return undefined;
    }

    if (!isAuthenticated) {
      setPlayerList([]);
      setTeams([]);
      setListsError(null);
      setListsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    listRequestRef.current = { id: requestId, controller };
    setListsLoading(true);
    setListsError(null);

    const decodeList = (data, key) => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.[key])) return data[key];
      throw new Error(`The ${key} endpoint returned an invalid list.`);
    };

    Promise.allSettled([
      apiClient.get(getApiUrl('PLAYERS'), { signal: controller.signal }),
      apiClient.get(getApiUrl('TEAMS'), { signal: controller.signal }),
    ])
      .then(([playersResult, teamsResult]) => {
        if (listRequestRef.current.id !== requestId) return;

        const errors = [];
        if (playersResult.status === 'fulfilled') {
          try {
            setPlayerList(decodeList(playersResult.value.data, 'players'));
          } catch (error) {
            errors.push(error.message);
            setPlayerList([]);
          }
        } else if (!isRequestCancelled(playersResult.reason)) {
          errors.push(`Players: ${getRequestErrorMessage(playersResult.reason)}`);
          setPlayerList([]);
        }

        if (teamsResult.status === 'fulfilled') {
          try {
            setTeams(decodeList(teamsResult.value.data, 'teams'));
          } catch (error) {
            errors.push(error.message);
            setTeams([]);
          }
        } else if (!isRequestCancelled(teamsResult.reason)) {
          errors.push(`Teams: ${getRequestErrorMessage(teamsResult.reason)}`);
          setTeams([]);
        }

        setListsError(errors.length > 0 ? errors.join(' ') : null);
      })
      .finally(() => {
        if (listRequestRef.current.id === requestId) {
          setListsLoading(false);
        }
      });

    return () => {
      if (listRequestRef.current.id === requestId) {
        listRequestRef.current = { id: requestId + 1, controller: null };
        controller.abort();
      }
    };
  }, [authLoading, isAuthenticated]);

  const abortGameLogsRequest = useCallback(() => {
    const currentRequest = gameLogsRequestRef.current;
    currentRequest.controller?.abort();
    gameLogsRequestRef.current = { id: currentRequest.id + 1, controller: null };
    setIsGameLogsLoading(false);
  }, []);

  // One request seam owns game-log state transitions. A request may only
  // publish data if it is still the latest request; older requests are
  // cancelled and ignored when their promises settle.
  const requestGameLogs = useCallback(
    (params, { includeInitial = false, updateSelectedTeam = true } = {}) => {
      const previousRequest = gameLogsRequestRef.current;
      previousRequest.controller?.abort();

      const requestId = previousRequest.id + 1;
      const controller = new AbortController();
      gameLogsRequestRef.current = { id: requestId, controller };
      setIsGameLogsLoading(true);
      setGameLogsError(null);

      return fetchGameLogsData(params, { signal: controller.signal })
        .then((data) => {
          if (gameLogsRequestRef.current.id !== requestId) {
            return { stale: true };
          }

          setGameLogs(data.gameLogs);
          setAverages(data.averages);
          if (includeInitial) setInitialGameLogs(data.gameLogs);
          if (updateSelectedTeam) {
            setSelectedTeam(data.nextGame || teamsRef.current[0] || 'Atlanta Hawks');
          }
          return { ok: true, data };
        })
        .catch((error) => {
          const stale = gameLogsRequestRef.current.id !== requestId;
          if (stale || isRequestCancelled(error)) {
            return { stale, cancelled: true };
          }

          setGameLogsError(
            getRequestErrorMessage(error, 'Unable to load game logs. Please try again.'),
          );
          return { ok: false, error };
        })
        .finally(() => {
          if (gameLogsRequestRef.current.id === requestId) {
            setIsGameLogsLoading(false);
          }
        });
    },
    [],
  );

  useEffect(() => {
    // Fetch unfiltered logs when a player is selected manually.
    if (selectedPlayer === 'None') {
      abortGameLogsRequest();
      setGameLogs([]);
      setInitialGameLogs([]);
      setAverages([]);
      setSelectedTeam('');
      return undefined;
    }

    setDisplayPlayer(selectedPlayer);
    requestGameLogs(
      { player_name: selectedPlayer },
      { includeInitial: true, updateSelectedTeam: true },
    );
    return undefined;
  }, [abortGameLogsRequest, requestGameLogs, selectedPlayer]);

  const returnToQueryPrompt = useCallback(() => {
    abortGameLogsRequest();
    setShowLandingPage(true);
    setCurrentQuery('');
    setSelectedPlayer('None');
    setDisplayPlayer('None');
    setAppliedFilters({});
    setGameLogs([]);
    setInitialGameLogs([]);
    setAverages([]);
    setGameLogsError(null);
    setResetToLanding(true);
    // Reset the flag after a brief delay to allow the effect to trigger
    setTimeout(() => setResetToLanding(false), 100);
  }, [abortGameLogsRequest]);

  // A URL carrying a Filter Set opens the Log Workspace with it applied, so a
  // view can be bookmarked, shared, and reloaded. Requests wait for auth rather
  // than firing and failing, and the requested URL is never rewritten.
  useEffect(() => {
    if (!hasUrlFilterSet) {
      // The URL no longer describes a Filter Set, so whatever workspace it
      // opened is over — however the user got here, including by pressing the
      // browser's own Back button. A mount on the bare route is not that
      // transition and must leave a seeded query alone.
      if (!wasInWorkspace.current) return undefined;
      wasInWorkspace.current = false;
      returnToQueryPrompt();
      return undefined;
    }
    wasInWorkspace.current = true;
    setShowLandingPage(false);

    if (urlInvalid.length > 0) {
      abortGameLogsRequest();
      setGameLogs([]);
      setInitialGameLogs([]);
      setAverages([]);
      setAppliedFilters({});
      setGameLogsError(
        `This link could not be opened: ${listNames(urlInvalid)} ` +
          `${urlInvalid.length === 1 ? 'is not a value' : 'are not values'} we can apply. ` +
          'No filters were applied.',
      );
      return undefined;
    }

    setGameLogsError(null);
    setAppliedFilters(urlFilters);
    setDisplayPlayer(urlFilters.player_name || 'None');

    // Signing out mid-flight must not publish protected logs underneath the
    // sign-in prompt, so drop anything already in the air.
    if (!authLoading && !isAuthenticated) {
      abortGameLogsRequest();
      setGameLogs([]);
      setInitialGameLogs([]);
      setAverages([]);
      return undefined;
    }

    // A Filter Set without a player is partial, not malformed: hold it in the
    // panel and wait for the user to choose who to apply it to.
    if (!urlFilters.player_name || authLoading) return undefined;

    requestGameLogs(urlFilters, { includeInitial: true, updateSelectedTeam: true });
    return abortGameLogsRequest;
  }, [
    abortGameLogsRequest,
    authLoading,
    hasUrlFilterSet,
    isAuthenticated,
    requestGameLogs,
    returnToQueryPrompt,
    urlFilters,
    urlInvalid,
  ]);

  /*
   * Applying writes the Filter Set to the URL and stops there. The URL effect
   * above owns the request, so there is one path from "what the user asked
   * for" to "what the API is sent", and it runs through the address bar.
   *
   * The write patches rather than replaces: the panel emits only the controls
   * the user touched, so a parameter it has no control for — a season that
   * arrived from a Parsed Query — survives an apply instead of being dropped.
   */
  const handleApplyFilters = (filterParams, isFromNL = false, nlLoadingCallback = null) => {
    // A Parsed Query resolves to a whole Filter Set, so it replaces; the panel
    // only ever describes part of one, so it patches.
    //
    // The panel's patch is deliberately not cleaned first: a control the user
    // emptied arrives as a blank value, and that blank is the instruction to
    // drop the parameter. Cleaning it away would make clearing a control
    // indistinguishable from never touching it, and the old value would stand.
    const nextFilters = isFromNL
      ? cleanFilterParams(filterParams)
      : mergeFilterSet(urlFilters, filterParams);

    if (Object.keys(nextFilters).length === 0) {
      setGameLogsError('Add at least one filter before loading game logs.');
      if (isFromNL && nlLoadingCallback) nlLoadingCallback(false);
      return Promise.resolve({ ok: false, empty: true });
    }

    // Arriving on a link that carries filters but no player leaves the panel
    // holding a Filter Set with nobody to apply it to. Say so, rather than
    // sending the placeholder and reporting a player the user never named.
    if (!nextFilters.player_name || nextFilters.player_name === 'None') {
      setGameLogsError('Choose a player before applying these filters.');
      if (isFromNL && nlLoadingCallback) nlLoadingCallback(false);
      return Promise.resolve({ ok: false, empty: true });
    }

    const nextSearch = filterSetToSearchParams(nextFilters);
    // An apply that changes nothing is not a place to come back to.
    if (nextSearch.toString() === searchParams.toString()) {
      if (nlLoadingCallback) nlLoadingCallback(true);
      return undefined;
    }
    // Pushed, not replaced, so Back undoes the last filter change.
    setSearchParams(nextSearch, { replace: false });

    // The Filter Set is now recorded, which is all a Parsed Query was for. The
    // game-log request that follows reports itself through gameLogsLoading and
    // the error alert.
    if (nlLoadingCallback) nlLoadingCallback(true);
    return undefined;
  };

  // Handler for natural language query results
  const handleNLQueryResults = (filters, nlLoadingCallback) => {
    const convertedFilters = cleanFilterParams(filters);
    if (Object.keys(convertedFilters).length === 0) {
      if (nlLoadingCallback) nlLoadingCallback(false);
      return Promise.resolve({ ok: false, empty: true });
    }

    const playerName = convertedFilters.selectedPlayer;
    const apiFilters = toGameLogParams(convertedFilters);
    const finishNLRequest = (success) => {
      if (success) {
        if (playerName) setDisplayPlayer(playerName);
        setShowLandingPage(false);
      }
      if (nlLoadingCallback) nlLoadingCallback(success);
    };

    return handleApplyFilters(apiFilters, true, finishNLRequest);
  };

  return (
    <>
      {/* Always render NaturalLanguageQuery - it handles landing page vs compact view internally */}
      <NaturalLanguageQuery
        onFiltersApplied={handleNLQueryResults}
        onQueryUpdate={setCurrentQuery}
        resetToLanding={resetToLanding}
        gameLogsLoading={isGameLogsLoading}
        inWorkspace={!showLandingPage}
      />

      {(authLoading || listsLoading) && (
        <div className="text-center text-light py-2" role="status" aria-live="polite">
          <Spinner animation="border" size="sm" className="me-2" />
          {authLoading ? 'Checking authentication…' : 'Loading players and teams…'}
        </div>
      )}
      {listsError && (
        <Alert variant="warning" className="mx-3" role="alert">
          Unable to load player and team lists. {listsError}
        </Alert>
      )}
      {gameLogsError && (
        <Alert variant="danger" className="mx-3" role="alert">
          {gameLogsError}
        </Alert>
      )}
      {!showLandingPage && !authLoading && !isAuthenticated && (
        <Alert variant="info" className="mx-3" role="status">
          Sign in to load these game logs. This link is kept as-is, so signing in opens exactly what
          it points at.
        </Alert>
      )}
      {isGameLogsLoading && !showLandingPage && (
        <div className="text-center text-light py-2" role="status" aria-live="polite">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading game logs…
        </div>
      )}

      {/* Player Stats Cards - positioned between search and main content */}
      {!showLandingPage && (
        <Container fluid className="pt-2 pb-1">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <button
              // Navigating to the bare route is the whole action: the effect
              // watching the URL is what closes the workspace, so leaving by
              // this button and leaving by the browser's Back button agree.
              onClick={() => setSearchParams(new URLSearchParams(), { replace: false })}
              className="btn btn-back-to-search d-flex align-items-center"
              aria-label="Back to search"
            >
              ←
            </button>
            {currentQuery && (
              <div className="current-query-display">
                <span className="query-label">Query:</span>
                <span className="query-text">"{currentQuery}"</span>
              </div>
            )}
          </div>
          <Card className="dark-card">
            <Card.Body className="p-3">
              <PlayerStatsCards averages={averages} selectedPlayer={displayPlayer} />
            </Card.Body>
          </Card>
        </Container>
      )}

      {/* Only show main content after landing page */}
      {!showLandingPage && (
        <Container fluid className="game-log-filter py-2">
          <Row className="mb-5">
            <Col md={8}>
              <Card className="dark-card">
                <Card.Body>
                  <PlayerSelector
                    selectedPlayer={displayPlayer}
                    setSelectedPlayer={(player) => {
                      setSelectedPlayer(player);
                      setDisplayPlayer(player);
                      setShowLandingPage(false); // Hide landing page on manual selection
                    }}
                    lineType={lineType}
                    setLineType={setLineType}
                    lineValue={lineValue}
                    setLineValue={setLineValue}
                    playerList={playerList}
                    averages={averages}
                  />
                  <ChartComponent
                    gameLogs={gameLogs}
                    lineType={lineType}
                    lineValue={lineValue}
                    averages={averages}
                    appliedFilters={appliedFilters}
                  />
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <FilterOptions
                playerList={playerList}
                onApplyFilters={handleApplyFilters}
                selectedPlayer={selectedPlayer}
                displayPlayer={displayPlayer}
                initialGameLogs={initialGameLogs}
                appliedFilters={appliedFilters}
              />
            </Col>
          </Row>

          <Row className="mb-5">
            <Col md={6}>
              <PlayerProfile selectedPlayer={displayPlayer} selectedTeam={selectedTeam} />
            </Col>
            <Col md={6}>
              <OpposingTeamProfile
                teams={teams}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
              />
            </Col>
          </Row>

          <div className="stats-layout-container">
            <div className="per36-sidebar">
              <PerformanceAverages averages={averages} appliedFilters={appliedFilters} />
            </div>

            <div className="game-logs-main">
              <GameLogsTable gameLogs={gameLogs} appliedFilters={appliedFilters} />
            </div>
          </div>
        </Container>
      )}
    </>
  );
};

export default GameLogFilter;
