import { useState, useEffect, useRef, useCallback } from 'react';
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
import { cleanFilterParams, filtersForDisplay, toGameLogParams } from './filterUtils';

const GameLogFilter = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
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
  const [showLandingPage, setShowLandingPage] = useState(true); // Track if landing page should show
  const [currentQuery, setCurrentQuery] = useState(''); // Track the current search query
  const [resetToLanding, setResetToLanding] = useState(false); // Signal to reset NL component
  const [isGameLogsLoading, setIsGameLogsLoading] = useState(false); // Track game logs API loading
  const [gameLogsError, setGameLogsError] = useState(null);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState(null);
  const listRequestRef = useRef({ id: 0, controller: null });
  const gameLogsRequestRef = useRef({ id: 0, controller: null });
  const teamsRef = useRef([]);

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

  const handleApplyFilters = (filterParams, isFromNL = false, nlLoadingCallback = null) => {
    const cleanedFilters = cleanFilterParams(filterParams);
    const appliedFilters = filtersForDisplay(filterParams, { naturalLanguage: isFromNL });
    setAppliedFilters(appliedFilters);

    if (Object.keys(cleanedFilters).length === 0) {
      setGameLogsError('Add at least one filter before loading game logs.');
      if (isFromNL && nlLoadingCallback) nlLoadingCallback(false);
      return Promise.resolve({ ok: false, empty: true });
    }

    const request = requestGameLogs(cleanedFilters, {
      includeInitial: isFromNL,
      updateSelectedTeam: true,
    });

    if (!isFromNL) return request;

    return request.then((result) => {
      // Each callback is scoped to the NL query that created it. The callback
      // itself guards against clearing a newer query, so stale/cancelled game
      // log requests still settle their own loading state.
      if (nlLoadingCallback) {
        nlLoadingCallback(result.ok === true);
      }
      return result;
    });
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
              onClick={() => {
                abortGameLogsRequest();
                setShowLandingPage(true);
                setCurrentQuery('');
                setSelectedPlayer('None');
                setDisplayPlayer('None');
                setGameLogsError(null);
                setResetToLanding(true);
                // Reset the flag after a brief delay to allow the effect to trigger
                setTimeout(() => setResetToLanding(false), 100);
              }}
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
