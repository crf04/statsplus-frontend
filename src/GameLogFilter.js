import { readRevisit } from './revisitCache';
import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { apiClient, getApiUrl } from './config';
import './GameLogFilter.css';
import PlayerSelector from './PlayerSelector';
import { useLineSelection } from './lineSelection';
import FilterOptions from './FilterOptions';
import PerformanceAverages from './PerformanceAverages';
import GameLogsTable from './GameLogsTable';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import PlayerStatsCards from './PlayerStatsCards';
import SavedFilterSetsModal from './SavedFilterSetsModal';
import { useAuth } from './contexts/AuthContext';
import { fetchGameLogsData, getRequestErrorMessage, isRequestCancelled } from './gameLogsApi';
import { fetchNextOpponent } from './nextOpponentApi';
import { TEAM_CODES } from './targets/opponentContextApi';
import {
  BROWSE_PARAM,
  filterQueryString,
  filterSetFromSearchParams,
  filterSetToSearchParams,
  lineTypeFromSearch,
  mergeFilterSet,
  withLineType,
} from './filterUtils';
import { linkPreviewFor } from './linkPreview';
import useDocumentTitle from './useDocumentTitle';
import ErrorMessage from './feedback/ErrorMessage';

// The chart-bearing sections render only in the workspace, so their chart
// libraries load on demand instead of delaying the landing prompt.
const PlayerProfile = lazy(() => import('./PlayerProfile'));
const OpposingTeamProfile = lazy(() => import('./OpposingTeamProfile'));
const ChartComponent = lazy(() => import('./ChartComponent'));

// Renders nothing; mounted beside a lazy section inside the same Suspense
// boundary, its effect runs only once that section's chunk has arrived.
const OnMount = ({ onMount, onUnmount }) => {
  useEffect(() => {
    onMount();
    return onUnmount;
  }, [onMount, onUnmount]);
  return null;
};

const listNames = (names) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

// `notice` is shown at the top of the Query Prompt, under the scoreboard ticker.
const GameLogFilter = ({ notice = null }) => {
  const { isAuthenticated, waitlist, loading: authLoading, currentUser } = useAuth();
  // Every authenticated read and write on this page needs an admitted account:
  // a waitlisted one is refused them all, so it is treated as not searching.
  const canSearch = isAuthenticated && !waitlist;
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  // The URL is the game-log API's own query string, so a link is readable
  // against the API documentation and needs no alias vocabulary.
  // Decoded from the Filter Set's parameters alone, so a change of view such as
  // the Line Type leaves the Filter Set, and everything that follows it, as is.
  const filterQuery = filterQueryString(searchParams);
  const { filters: urlFilters, invalid: urlInvalid } = useMemo(
    () => filterSetFromSearchParams(new URLSearchParams(filterQuery)),
    [filterQuery],
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
  // The player the current team was chosen for, by default or by hand. A load
  // for anyone else picks a new default; a filter change for the same player
  // keeps the team. A ref because requestGameLogs reads it without re-running.
  const teamPlayerRef = useRef(null);
  // The player whose game logs are loading and still need a default opponent,
  // chosen once the logs, the team list and the next-opponent read are all in.
  const [defaultTeamFor, setDefaultTeamFor] = useState(null);
  // The next-opponent read, which the filter panel renders and the default
  // opponent comes from. `player` is whom it last finished for, answered or not.
  const [nextOpponentRead, setNextOpponentRead] = useState({ player: null, data: null });
  // Which stat the chart shows is a view of the results, kept in the URL so a
  // shared link opens on it. It is not a filter, so an unusable value quietly
  // means the default rather than refusing the link.
  const lineType = lineTypeFromSearch(searchParams);
  const setLineType = (next) =>
    setSearchParams((current) => withLineType(current, next), { replace: true });
  // A Parsed Query answers after the reader may have moved on, so a write reads
  // the address bar as it is then, not as it was when the write began.
  const currentSearchRef = useRef(searchParams);
  useEffect(() => {
    currentSearchRef.current = searchParams;
  }, [searchParams]);
  // Writing the Filter Set rebuilds the query string from filters alone, which
  // would silently reset the chart's stat, so the current one is carried over.
  const withCurrentLineType = (nextSearch) =>
    withLineType(nextSearch, lineTypeFromSearch(currentSearchRef.current));
  const [gameLogs, setGameLogs] = useState([]);
  const [averages, setAverages] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  // The player's posted lines for his next game, which the line defaults to.
  const [postedLine, setPostedLine] = useState(null);
  const line = useLineSelection({ player: selectedPlayer, lineType, postedLine, averages });
  // How many games the shown averages cover, against the whole season; null
  // until a game-log response arrives for the current Filter Set.
  const [sampleSize, setSampleSize] = useState(null);
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
  const [showSavedFilterSets, setShowSavedFilterSets] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // The Workspace is revealed in one piece. Each section that reads on its own
  // reports what it last finished reading for, and the Workspace stays behind
  // one loading state until every section has finished for what is on screen.
  const [profileSettledFor, setProfileSettledFor] = useState(null);
  const [opponentSettledFor, setOpponentSettledFor] = useState(null);
  const [chartReady, setChartReady] = useState(false);
  const [panelSettledFor, setPanelSettledFor] = useState(null);
  const handleProfileSettled = useCallback(
    (player, team) => setProfileSettledFor(player === null ? null : `${player}|${team}`),
    [],
  );
  const handleChartReady = useCallback(() => setChartReady(true), []);
  const handleChartGone = useCallback(() => setChartReady(false), []);
  // Each game-log request starts a new load for the Workspace to reveal whole.
  const [workspaceLoad, setWorkspaceLoad] = useState(0);
  const [revealedLoad, setRevealedLoad] = useState(null);
  const listRequestRef = useRef({ id: 0, controller: null });
  const gameLogsRequestRef = useRef({ id: 0, controller: null });
  const wasInWorkspace = useRef(false);

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

    if (!canSearch) {
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
  }, [authLoading, canSearch]);

  const clearSelectedTeam = useCallback(() => {
    teamPlayerRef.current = null;
    setSelectedTeam('');
  }, []);

  // A hand-picked team belongs to the player on screen, so a retry of a failed
  // load keeps it instead of choosing the default again.
  const chooseTeam = useCallback(
    (team) => {
      teamPlayerRef.current = selectedPlayer;
      setSelectedTeam(team);
    },
    [selectedPlayer],
  );

  const abortGameLogsRequest = useCallback(() => {
    const currentRequest = gameLogsRequestRef.current;
    currentRequest.controller?.abort();
    gameLogsRequestRef.current = { id: currentRequest.id + 1, controller: null };
    setIsGameLogsLoading(false);
    setDefaultTeamFor(null);
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

  // The strip and Own stat line share one unfiltered-season read per player.
  const loadSeasonGameLogs = useCallback(() => {
    const player = urlFilters.player_name;
    const season = urlFilters.season_filter;
    if (!player || authLoading || !canSearch) return;
    if (seasonRequestRef.current.player === player && seasonRequestRef.current.season === season)
      return;

    seasonRequestRef.current.controller?.abort();
    const controller = new AbortController();
    seasonRequestRef.current = { player, season, controller };
    setSeasonGameLogsLoading(true);
    setSeasonGameLogsFailed(false);

    // Only the request still on the ref may report anything. Comparing the
    // controller rather than the player is what makes that true whatever order
    // a superseded request settles in, including a second request for the same
    // player after a change away and back.
    const isCurrentRequest = () => seasonRequestRef.current.controller === controller;

    fetchGameLogsData(
      { player_name: player, ...(season ? { season_filter: season } : {}) },
      { signal: controller.signal },
    )
      .then((data) => {
        if (!isCurrentRequest()) return;
        setSeasonGameLogsLoading(false);
        setSeasonGameLogs({ player, season, gameLogs: data.gameLogs });
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
  }, [authLoading, canSearch, urlFilters.player_name, urlFilters.season_filter]);

  // One player's season must never bound another player's sliders.
  const playerSeasonGameLogs = useMemo(
    () =>
      seasonGameLogs.player === selectedPlayer && seasonGameLogs.season === urlFilters.season_filter
        ? seasonGameLogs.gameLogs
        : [],
    [seasonGameLogs, selectedPlayer, urlFilters.season_filter],
  );

  // One request seam owns game-log state transitions. A request may only
  // publish data if it is still the latest request; older requests are
  // cancelled and ignored when their promises settle.
  const requestGameLogs = useCallback(
    (params, { bypass = false } = {}) => {
      const previousRequest = gameLogsRequestRef.current;
      previousRequest.controller?.abort();

      const requestId = previousRequest.id + 1;
      const controller = new AbortController();
      gameLogsRequestRef.current = { id: requestId, controller };
      setIsGameLogsLoading(true);
      setWorkspaceLoad((load) => load + 1);
      setGameLogsError(null);
      setDefaultTeamFor(teamPlayerRef.current === params.player_name ? null : params.player_name);
      // The badges above the table already describe the Filter Set just
      // requested, so whatever is still on screen belongs to nobody. Clearing
      // at the start is what keeps that true while the request is in flight and
      // if it never arrives, rather than only once it does.
      setGameLogs([]);
      setAverages([]);
      setPlayerId(null);
      setPostedLine(null);
      setSampleSize(null);

      return readRevisit(
        'logs',
        currentUser?.uid,
        params,
        () => fetchGameLogsData(params, { signal: controller.signal }),
        { signal: controller.signal, bypass },
      )
        .then((data) => {
          if (gameLogsRequestRef.current.id !== requestId) {
            return { stale: true };
          }

          setGameLogs(data.gameLogs);
          setAverages(data.averages);
          setPlayerId(data.playerId ?? null);
          setPostedLine(data.postedLine ?? null);
          setSampleSize({
            filtered: data.gameLogs.length,
            season: data.seasonGameCount ?? null,
          });
          return { ok: true, data };
        })
        .catch((error) => {
          const stale = gameLogsRequestRef.current.id !== requestId;
          if (stale || isRequestCancelled(error)) {
            if (!stale) setDefaultTeamFor(null);
            return { stale, cancelled: true };
          }

          setDefaultTeamFor(null);

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
    [currentUser?.uid],
  );

  useEffect(() => {
    setNextOpponentRead({ player: null, data: null });
    if (!isAuthenticated || !inWorkspace || isRefusedLink) return undefined;
    const controller = new AbortController();
    fetchNextOpponent(selectedPlayer, { signal: controller.signal })
      .catch(() => null)
      .then((data) => {
        if (!controller.signal.aborted) setNextOpponentRead({ player: selectedPlayer, data });
      });
    return () => controller.abort();
  }, [isAuthenticated, inWorkspace, isRefusedLink, selectedPlayer]);

  // A team already chosen for this player is never here: only a load for a
  // different player sets defaultTeamFor.
  useEffect(() => {
    if (defaultTeamFor === null || defaultTeamFor !== selectedPlayer) return;
    if (isGameLogsLoading || listsLoading || nextOpponentRead.player !== selectedPlayer) return;
    // Matched by tricode: the schedule's opponent_name is the short team name
    // ("Cavaliers"), not the full name the team list uses.
    const opponent = nextOpponentRead.data?.next_game?.opponent;
    const nextOpponent = teams.find((team) => TEAM_CODES[team] === opponent);
    setSelectedTeam(nextOpponent || teams[0] || 'Atlanta Hawks');
    teamPlayerRef.current = selectedPlayer;
    setDefaultTeamFor(null);
  }, [defaultTeamFor, selectedPlayer, isGameLogsLoading, listsLoading, nextOpponentRead, teams]);

  const returnToQueryPrompt = useCallback(() => {
    abortGameLogsRequest();
    setCurrentQuery('');
    setAppliedFilters({});
    setGameLogs([]);
    clearSeasonGameLogs();
    setAverages([]);
    setPlayerId(null);
    setPostedLine(null);
    setSampleSize(null);
    clearSelectedTeam();
    setGameLogsError(null);
  }, [abortGameLogsRequest, clearSeasonGameLogs, clearSelectedTeam]);

  // The URL is the whole view, so sharing it hands over exactly these game
  // logs. Phones get their own share sheet; elsewhere the link is copied.
  const shareLink = async () => {
    const url = `${window.location.origin}${pathname}?${searchParams.toString()}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (error) {
        // Dismissing the share sheet is a choice; any other failure falls
        // back to copying.
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
    } catch {
      // A blocked clipboard leaves the link in the address bar to copy by hand.
    }
  };

  useEffect(() => {
    if (!linkCopied) return undefined;
    const timer = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [linkCopied]);

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
    // Entering the Workspace is a load of its own, even with no game-log
    // request to make, so it is revealed whole like any other.
    if (!wasInWorkspace.current) setWorkspaceLoad((load) => load + 1);
    wasInWorkspace.current = true;

    if (urlInvalid.length > 0) {
      abortGameLogsRequest();
      setGameLogs([]);
      clearSeasonGameLogs();
      setAverages([]);
      setPlayerId(null);
      setPostedLine(null);
      setSampleSize(null);
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
    if (!authLoading && !canSearch) {
      abortGameLogsRequest();
      setGameLogs([]);
      clearSeasonGameLogs();
      setAverages([]);
      setPlayerId(null);
      setPostedLine(null);
      setSampleSize(null);
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
      setPlayerId(null);
      setPostedLine(null);
      setSampleSize(null);
      clearSelectedTeam();
      return undefined;
    }

    if (authLoading) return undefined;

    // A sentinel still sitting beside filters is about to be dropped, which
    // rewrites the URL and re-runs this effect. Let it, rather than firing a
    // request only to abort it.
    if (hasBrowseSentinel) return undefined;

    requestGameLogs(urlFilters);
    return abortGameLogsRequest;
  }, [
    abortGameLogsRequest,
    authLoading,
    clearSeasonGameLogs,
    hasBrowseSentinel,
    inWorkspace,
    canSearch,
    clearSelectedTeam,
    requestGameLogs,
    returnToQueryPrompt,
    urlFilters,
    urlInvalid,
  ]);

  /*
   * The Season select is not a Filter Set apply: it writes the season into the
   * URL beside whatever else is there and stops. Any read follows from the URL
   * like every other change, so a reader with no player yet can still choose a
   * season, and nothing is requested for a player nobody named.
   */
  const handleSeasonChange = (season) => {
    if (isRefusedLink) return;
    const nextSearch = withCurrentLineType(
      filterSetToSearchParams(mergeFilterSet(urlFilters, { season_filter: season })),
    );
    if (nextSearch.toString() === searchParams.toString()) return;
    setSearchParams(nextSearch, { replace: false });
  };

  /*
   * Applying a changed Filter Set writes it to the URL for the effect above
   * to request. Reapplying the current Filter Set explicitly refreshes it.
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

    const nextSearch = withCurrentLineType(filterSetToSearchParams(nextFilters));
    // An apply that changes nothing is not a place to come back to.
    if (nextSearch.toString() === currentSearchRef.current.toString()) {
      if (authLoading || !canSearch) return { ok: false, reason: 'authentication' };
      requestGameLogs(nextFilters, { bypass: true });
      return { ok: true };
    }
    // Pushed, not replaced, so Back undoes the last filter change.
    setSearchParams(nextSearch, { replace: false });

    // The Filter Set is now recorded, which is all a Parsed Query was for. The
    // game-log request that follows reports itself through gameLogsLoading and
    // the error alert.
    return { ok: true };
  };

  const sectionsLoading =
    authLoading ||
    listsLoading ||
    isGameLogsLoading ||
    defaultTeamFor !== null ||
    !chartReady ||
    panelSettledFor !== selectedPlayer ||
    profileSettledFor !== `${selectedPlayer}|${selectedTeam}` ||
    opponentSettledFor !== selectedTeam;
  // The season range is left out on purpose: it is only the panel's strip,
  // which says it is loading in place, and the page stays usable meanwhile.
  // Once a load has been revealed, a section re-reading because the user
  // changed it (another opponent, another profile tab) shows its own progress
  // rather than taking the whole Workspace back behind the loading state.
  useEffect(() => {
    if (!sectionsLoading) setRevealedLoad(workspaceLoad);
  }, [sectionsLoading, workspaceLoad]);
  const showWorkspaceLoading =
    inWorkspace && !isRefusedLink && sectionsLoading && revealedLoad !== workspaceLoad;

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
        notice={notice}
        inWorkspace={inWorkspace}
        // The saved list is reachable from the Query Prompt as well as from the
        // Workspace, so coming back to a saved Filter Set does not require
        // building one first.
        onOpenSavedFilterSets={canSearch ? () => setShowSavedFilterSets(true) : undefined}
      />

      {!inWorkspace && (authLoading || listsLoading) && (
        <div className="text-center text-light py-2" role="status" aria-live="polite">
          <Spinner animation="border" size="sm" className="me-2" />
          {authLoading ? 'Checking authentication…' : 'Loading players and teams…'}
        </div>
      )}
      {listsError && (
        <Alert variant="warning" className="mx-3" role="alert">
          Unable to load player and team lists. <ErrorMessage message={listsError} />
        </Alert>
      )}
      {gameLogsError && (
        <Alert variant="danger" className="mx-3" role="alert">
          <ErrorMessage message={gameLogsError} />
        </Alert>
      )}
      {inWorkspace && !authLoading && !canSearch && (
        <Alert variant="info" className="mx-3" role="status">
          {isAuthenticated
            ? 'Game logs open once your account is off the waitlist.'
            : 'Sign in to load these game logs. This link is kept as-is, so signing in opens exactly what it points at.'}
        </Alert>
      )}
      {showWorkspaceLoading && (
        <div className="text-center text-light py-2" role="status" aria-live="polite">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading game logs…
        </div>
      )}

      {/* Player Stats Cards - positioned between search and main content */}
      {inWorkspace && (
        <Container fluid className="workspace-toolbar pt-2 pb-1">
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
            {/* Saving and the saved list live in the filter panel's Saved
                tab. Share hands on the applied link, so it waits for a URL
                that carries a Filter Set we would open; a refused link has no
                panel, so its way back out to the saved list stays here. */}
            {canSearch && (hasUrlFilterSet || isRefusedLink) && (
              <div className="d-flex align-items-center gap-2 ms-auto">
                {hasUrlFilterSet && !isRefusedLink && (
                  <button type="button" className="btn btn-back-to-search" onClick={shareLink}>
                    <span aria-live="polite">{linkCopied ? 'Copied' : 'Share'}</span>
                  </button>
                )}
                {isRefusedLink && (
                  <button
                    type="button"
                    className="btn btn-back-to-search"
                    onClick={() => setShowSavedFilterSets(true)}
                  >
                    Saved Filter Sets
                  </button>
                )}
              </div>
            )}
          </div>
          <Card className={`dark-card${showWorkspaceLoading ? ' d-none' : ''}`}>
            <Card.Body className="p-3">
              <PlayerStatsCards
                averages={averages}
                selectedPlayer={selectedPlayer}
                playerId={playerId}
              />
            </Card.Body>
          </Card>
        </Container>
      )}

      {/* Only show main content after landing page */}
      {inWorkspace && !isRefusedLink && (
        // Hidden rather than unmounted while loading, so every section reads at
        // once instead of each waiting for the one before it to appear.
        <Container fluid className={`game-log-filter py-2${showWorkspaceLoading ? ' d-none' : ''}`}>
          <Row className="mb-5">
            <Col md={8}>
              <Card className="dark-card">
                <Card.Body>
                  <PlayerSelector
                    selectedPlayer={selectedPlayer}
                    setSelectedPlayer={handleSelectPlayer}
                    lineType={lineType}
                    setLineType={setLineType}
                    lineValue={line.lineValue}
                    onTypeLineValue={line.typeLineValue}
                    lineSource={line.lineSource}
                    onChooseSource={line.chooseSource}
                    playerList={playerList}
                    postedLine={postedLine}
                  />
                  <Suspense fallback={null}>
                    <ChartComponent
                      gameLogs={gameLogs}
                      lineType={lineType}
                      lineValue={line.lineValue}
                      averages={averages}
                      postedLine={postedLine}
                      lineSource={line.lineSource}
                      appliedFilters={appliedFilters}
                    />
                    <OnMount onMount={handleChartReady} onUnmount={handleChartGone} />
                  </Suspense>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <FilterOptions
                playerList={playerList}
                onApplyFilters={handleApplyFilters}
                onSeasonChange={handleSeasonChange}
                selectedPlayer={selectedPlayer}
                seasonGameLogs={playerSeasonGameLogs}
                seasonGameLogsLoading={seasonGameLogsLoading}
                seasonGameLogsFailed={seasonGameLogsFailed}
                onOpenSelfFilters={loadSeasonGameLogs}
                appliedFilters={appliedFilters}
                gameLogs={gameLogs}
                gameLogsLoading={isGameLogsLoading}
                gameLogsError={gameLogsError}
                averages={averages}
                lineType={lineType}
                lineValue={line.lineValue}
                onContextSettled={setPanelSettledFor}
                nextOpponent={
                  nextOpponentRead.player === selectedPlayer ? nextOpponentRead.data : null
                }
                nextOpponentFor={nextOpponentRead.player}
                defaultSaveName={currentQuery || ''}
              />
            </Col>
          </Row>

          <Row className="mb-5">
            <Col md={6}>
              <Suspense fallback={null}>
                <PlayerProfile
                  selectedPlayer={selectedPlayer}
                  selectedTeam={selectedTeam}
                  onSettled={handleProfileSettled}
                />
              </Suspense>
            </Col>
            <Col md={6}>
              <Suspense fallback={null}>
                <OpposingTeamProfile
                  teams={teams}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={chooseTeam}
                  onSettled={setOpponentSettledFor}
                />
              </Suspense>
            </Col>
          </Row>

          <div className="stats-layout-container">
            <div className="per36-sidebar">
              <PerformanceAverages
                averages={averages}
                appliedFilters={appliedFilters}
                sampleSize={isGameLogsLoading ? null : sampleSize}
              />
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

      {/* The saved list belongs to an account, so it does not exist for a
          signed-out reader. */}
      {canSearch && (
        <SavedFilterSetsModal
          show={showSavedFilterSets}
          onHide={() => setShowSavedFilterSets(false)}
        />
      )}
    </>
  );
};

export default GameLogFilter;
