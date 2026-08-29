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
import SaveFilterSetModal from './SaveFilterSetModal';
import SavedFilterSetsModal from './SavedFilterSetsModal';
import { useAuth } from './contexts/AuthContext';
import { fetchGameLogsData, getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import {
  BROWSE_PARAM,
  filterSetFromSearchParams,
  filterSetToSearchParams,
  mergeFilterSet,
} from './filterUtils';
import { linkPreviewFor } from './linkPreview';
import useDocumentTitle from './useDocumentTitle';

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
  const hasBrowseSentinel = searchParams.has(BROWSE_PARAM);
  const inWorkspace = hasBrowseSentinel || hasUrlFilterSet;
  // A refused link decoded to nothing, so there is no Filter Set to show, edit,
  // or patch a player into — only the refusal naming what has to be fixed.
  const isRefusedLink = urlInvalid.length > 0;
  // The player is a parameter of the Filter Set like any other, so it is read
  // back out of the URL rather than held beside it. One source of truth is what
  // keeps the applied-filter badges describing the data actually on screen.
  const selectedPlayer = urlFilters.player_name || 'None';
  // The tab and any link preview say the same thing about the same URL.
  useDocumentTitle(linkPreviewFor(searchParams)?.title);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  const [gameLogs, setGameLogs] = useState([]);
  const [averages, setAverages] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  // The player's season with no filter applied. It is what the Self Filters
  // controls offer stats and slider bounds from, so it must never be a filtered
  // result set: ranges taken from one cannot be widened back out.
  const [seasonGameLogs, setSeasonGameLogs] = useState({ player: null, gameLogs: [] });
  const [seasonGameLogsLoading, setSeasonGameLogsLoading] = useState(false);
  const [seasonGameLogsFailed, setSeasonGameLogsFailed] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(''); // Track the current search query
  const [isGameLogsLoading, setIsGameLogsLoading] = useState(false); // Track game logs API loading
  const [gameLogsError, setGameLogsError] = useState(null);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState(null);
  const [showSaveFilterSet, setShowSaveFilterSet] = useState(false);
  const [showSavedFilterSets, setShowSavedFilterSets] = useState(false);
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

  const seasonRequestRef = useRef({ player: null, controller: null });

  const clearSeasonGameLogs = useCallback(() => {
    seasonRequestRef.current.controller?.abort();
    seasonRequestRef.current = { player: null, controller: null };
    setSeasonGameLogsLoading(false);
    setSeasonGameLogsFailed(false);
    setSeasonGameLogs({ player: null, gameLogs: [] });
  }, []);

  // Nothing in flight outlives the workspace.
  useEffect(() => clearSeasonGameLogs, [clearSeasonGameLogs]);

  /*
   * The game-log endpoint is the slowest in the application and most sessions
   * never touch Self Filters, so the season is asked for only when that control
   * is opened, and only once per player. It is its own request rather than a
   * by-product of the filtered one, because the whole point of it is that no
   * filter is applied.
   */
  const loadSeasonGameLogs = useCallback(() => {
    const player = urlFilters.player_name;
    if (!player || authLoading || !isAuthenticated) return;
    if (seasonRequestRef.current.player === player) return;

    seasonRequestRef.current.controller?.abort();
    const controller = new AbortController();
    seasonRequestRef.current = { player, controller };
    setSeasonGameLogsLoading(true);
    setSeasonGameLogsFailed(false);

    // Only the request still on the ref may report anything. Comparing the
    // controller rather than the player is what makes that true whatever order
    // a superseded request settles in, including a second request for the same
    // player after a change away and back.
    const isCurrentRequest = () => seasonRequestRef.current.controller === controller;

    fetchGameLogsData({ player_name: player }, { signal: controller.signal })
      .then((data) => {
        if (!isCurrentRequest()) return;
        setSeasonGameLogsLoading(false);
        setSeasonGameLogs({ player, gameLogs: data.gameLogs });
      })
      .catch((error) => {
        if (!isCurrentRequest()) return;
        // Forget the attempt so that re-opening the control asks again rather
        // than offering nothing forever. A cancelled request was superseded
        // deliberately and has nothing to report.
        seasonRequestRef.current = { player: null, controller: null };
        setSeasonGameLogsLoading(false);
        setSeasonGameLogsFailed(!isRequestCancelled(error));
      });
  }, [authLoading, isAuthenticated, urlFilters.player_name]);

  // One player's season must never bound another player's sliders.
  const playerSeasonGameLogs = useMemo(
    () => (seasonGameLogs.player === selectedPlayer ? seasonGameLogs.gameLogs : []),
    [seasonGameLogs, selectedPlayer],
  );

  // One request seam owns game-log state transitions. A request may only
  // publish data if it is still the latest request; older requests are
  // cancelled and ignored when their promises settle.
  const requestGameLogs = useCallback((params, { updateSelectedTeam = true } = {}) => {
    const previousRequest = gameLogsRequestRef.current;
    previousRequest.controller?.abort();

    const requestId = previousRequest.id + 1;
    const controller = new AbortController();
    gameLogsRequestRef.current = { id: requestId, controller };
    setIsGameLogsLoading(true);
    setGameLogsError(null);
    // The badges above the table already describe the Filter Set just
    // requested, so whatever is still on screen belongs to nobody. Clearing
    // at the start is what keeps that true while the request is in flight and
    // if it never arrives, rather than only once it does.
    setGameLogs([]);
    setAverages([]);

    return fetchGameLogsData(params, { signal: controller.signal })
      .then((data) => {
        if (gameLogsRequestRef.current.id !== requestId) {
          return { stale: true };
        }

        setGameLogs(data.gameLogs);
        setAverages(data.averages);
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
  }, []);

  const returnToQueryPrompt = useCallback(() => {
    abortGameLogsRequest();
    setCurrentQuery('');
    setAppliedFilters({});
    setGameLogs([]);
    clearSeasonGameLogs();
    setAverages([]);
    setSelectedTeam('');
    setGameLogsError(null);
  }, [abortGameLogsRequest, clearSeasonGameLogs]);

  // The sentinel only ever says "Workspace, no filters yet". Alongside filters
  // it is already untrue, so it is dropped rather than carried into a link
  // someone shares.
  //
  // Only the sentinel is removed, and the rest of the query string is left
  // exactly as it arrived. Re-encoding the decoded Filter Set instead would
  // erase a link we are refusing — the offending value withholds the whole
  // Filter Set, so there would be nothing left to write and the refusal would
  // be left naming a parameter no longer in the address bar.
  useEffect(() => {
    if (!hasBrowseSentinel || !hasUrlFilterSet) return;
    const withoutSentinel = new URLSearchParams(searchParams);
    withoutSentinel.delete(BROWSE_PARAM);
    setSearchParams(withoutSentinel, { replace: true });
  }, [hasBrowseSentinel, hasUrlFilterSet, searchParams, setSearchParams]);

  // A URL carrying a Filter Set opens the Log Workspace with it applied, so a
  // view can be bookmarked, shared, and reloaded. Requests wait for auth rather
  // than firing and failing, and the requested URL is never rewritten.
  useEffect(() => {
    if (!inWorkspace) {
      // The URL no longer opens a Workspace, so whatever workspace it
      // opened is over — however the user got here, including by pressing the
      // browser's own Back button. A mount on the bare route is not that
      // transition and must leave a seeded query alone.
      if (!wasInWorkspace.current) return undefined;
      wasInWorkspace.current = false;
      returnToQueryPrompt();
      return undefined;
    }
    wasInWorkspace.current = true;

    if (urlInvalid.length > 0) {
      abortGameLogsRequest();
      setGameLogs([]);
      clearSeasonGameLogs();
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

    // Signing out mid-flight must not publish protected logs underneath the
    // sign-in prompt, so drop anything already in the air.
    if (!authLoading && !isAuthenticated) {
      abortGameLogsRequest();
      setGameLogs([]);
      clearSeasonGameLogs();
      setAverages([]);
      return undefined;
    }

    // A Filter Set without a player is partial, not malformed: hold it in the
    // panel and wait for the user to choose who to apply it to. Whatever is on
    // screen belongs to a player this Filter Set no longer names, so it goes
    // rather than sitting under badges that have stopped describing it.
    if (!urlFilters.player_name) {
      abortGameLogsRequest();
      setGameLogs([]);
      clearSeasonGameLogs();
      setAverages([]);
      setSelectedTeam('');
      return undefined;
    }

    if (authLoading) return undefined;

    // A sentinel still sitting beside filters is about to be dropped, which
    // rewrites the URL and re-runs this effect. Let it, rather than firing a
    // request only to abort it.
    if (hasBrowseSentinel) return undefined;

    requestGameLogs(urlFilters, { updateSelectedTeam: true });
    return abortGameLogsRequest;
  }, [
    abortGameLogsRequest,
    authLoading,
    clearSeasonGameLogs,
    hasBrowseSentinel,
    inWorkspace,
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
  const handleApplyFilters = (filterParams, isFromNL = false) => {
    // A refused link has no Filter Set to patch: the decoder withheld the whole
    // of it, so merging into what it returned would publish a URL missing the
    // very parameter the refusal on screen is naming — a link we declined to
    // open, quietly replaced by a different one we did. A Parsed Query is not a
    // patch but a whole Filter Set, so it still supersedes the refused link and
    // stays the way out.
    if (!isFromNL && isRefusedLink) {
      return { ok: false, reason: 'refused' };
    }

    // A Parsed Query resolves to a whole Filter Set, so it replaces; the panel
    // only ever describes part of one, so it patches.
    //
    // The panel's patch is deliberately not cleaned first: a control the user
    // emptied arrives as a blank value, and that blank is the instruction to
    // drop the parameter. Cleaning it away would make clearing a control
    // indistinguishable from never touching it, and the old value would stand.
    const nextFilters = isFromNL ? filterParams : mergeFilterSet(urlFilters, filterParams);

    if (Object.keys(nextFilters).length === 0) {
      if (!isFromNL) setGameLogsError('Add at least one filter before loading game logs.');
      return { ok: false, reason: 'empty' };
    }

    // Arriving on a link that carries filters but no player leaves the panel
    // holding a Filter Set with nobody to apply it to. Say so, rather than
    // sending the placeholder and reporting a player the user never named.
    if (!nextFilters.player_name || nextFilters.player_name === 'None') {
      // A refused link keeps its own alert. That alert names the parameter to
      // fix, and the player selector this advice points at is not on screen to
      // act on — replacing one with the other loses both.
      if (!isRefusedLink) setGameLogsError('Choose a player before applying these filters.');
      return { ok: false, reason: 'needsPlayer' };
    }

    const nextSearch = filterSetToSearchParams(nextFilters);
    // An apply that changes nothing is not a place to come back to.
    if (nextSearch.toString() === searchParams.toString()) {
      return { ok: false, reason: 'unchanged' };
    }
    // Pushed, not replaced, so Back undoes the last filter change.
    setSearchParams(nextSearch, { replace: false });

    // The Filter Set is now recorded, which is all a Parsed Query was for. The
    // game-log request that follows reports itself through gameLogsLoading and
    // the error alert.
    return { ok: true };
  };

  /*
   * Choosing a player patches the player into the Filter Set rather than
   * replacing it, so comparing two players under identical conditions is one
   * action, and a link that carries filters but no player is answered by
   * naming one. It travels the same apply path as the panel, so the request
   * still comes from the address bar.
   */
  const handleSelectPlayer = (player) => handleApplyFilters({ player_name: player });

  // Handler for natural language query results
  const handleNLQueryResults = (filters) => handleApplyFilters(filters, true);

  return (
    <>
      {/* Always render NaturalLanguageQuery - it handles landing page vs compact view internally */}
      <NaturalLanguageQuery
        onFiltersApplied={handleNLQueryResults}
        onQueryUpdate={setCurrentQuery}
        gameLogsLoading={isGameLogsLoading}
        inWorkspace={inWorkspace}
        // The saved list is reachable from the Query Prompt as well as from the
        // Workspace, so coming back to a saved Filter Set does not require
        // building one first.
        onOpenSavedFilterSets={isAuthenticated ? () => setShowSavedFilterSets(true) : undefined}
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
      {inWorkspace && !authLoading && !isAuthenticated && (
        <Alert variant="info" className="mx-3" role="status">
          Sign in to load these game logs. This link is kept as-is, so signing in opens exactly what
          it points at.
        </Alert>
      )}
      {isGameLogsLoading && inWorkspace && (
        <div className="text-center text-light py-2" role="status" aria-live="polite">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading game logs…
        </div>
      )}

      {/* Player Stats Cards - positioned between search and main content */}
      {inWorkspace && (
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
            {isAuthenticated && (
              <div className="d-flex align-items-center gap-2 ms-auto">
                {/* There is nothing to save until the URL carries a Filter
                    Set, and a refused link is one we would not open again —
                    but the saved list is still the way back out of either. */}
                {hasUrlFilterSet && !isRefusedLink && (
                  <button
                    type="button"
                    className="btn btn-back-to-search"
                    onClick={() => setShowSaveFilterSet(true)}
                  >
                    Save Filter Set
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-back-to-search"
                  onClick={() => setShowSavedFilterSets(true)}
                >
                  Saved Filter Sets
                </button>
              </div>
            )}
          </div>
          <Card className="dark-card">
            <Card.Body className="p-3">
              <PlayerStatsCards averages={averages} selectedPlayer={selectedPlayer} />
            </Card.Body>
          </Card>
        </Container>
      )}

      {/* Only show main content after landing page */}
      {inWorkspace && !isRefusedLink && (
        <Container fluid className="game-log-filter py-2">
          <Row className="mb-5">
            <Col md={8}>
              <Card className="dark-card">
                <Card.Body>
                  <PlayerSelector
                    selectedPlayer={selectedPlayer}
                    setSelectedPlayer={handleSelectPlayer}
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
                seasonGameLogs={playerSeasonGameLogs}
                seasonGameLogsLoading={seasonGameLogsLoading}
                seasonGameLogsFailed={seasonGameLogsFailed}
                onOpenSelfFilters={loadSeasonGameLogs}
                appliedFilters={appliedFilters}
              />
            </Col>
          </Row>

          <Row className="mb-5">
            <Col md={6}>
              <PlayerProfile selectedPlayer={selectedPlayer} selectedTeam={selectedTeam} />
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
              <GameLogsTable
                gameLogs={gameLogs}
                appliedFilters={appliedFilters}
                isLoading={isGameLogsLoading}
              />
            </div>
          </div>
        </Container>
      )}

      {/* Saving and the saved list belong to an account, so neither exists for
          a signed-out reader. */}
      {isAuthenticated && (
        <>
          <SaveFilterSetModal
            show={showSaveFilterSet}
            onHide={() => setShowSaveFilterSet(false)}
            // The URL as it stands is what gets saved, so what opens later is
            // the link the user was looking at.
            queryString={searchParams.toString()}
          />
          <SavedFilterSetsModal
            show={showSavedFilterSets}
            onHide={() => setShowSavedFilterSets(false)}
          />
        </>
      )}
    </>
  );
};

export default GameLogFilter;
