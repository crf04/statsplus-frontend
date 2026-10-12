// One state model owns draft filters and the URL patch emitted on Apply.
import { useCallback, useEffect, useState } from 'react';
import {
  OPPONENT_FILTERS,
  encodeRankRange,
  mirrorRankRange,
  opponentFilterLabel,
  parseRank,
  rankRangeOf,
} from '../opponentFilters';
import { toFiniteNumber } from '../numberUtils';

const hasFilterValue = (value) => value !== null && value !== undefined && value !== '';

export const DEFENSIVE_CATEGORY_PILL_LABELS = {
  'General defense': 'General',
  'Shot type defense': 'Shot type',
  'Play type defense': 'Play type',
  'Assists allowed': 'Assists',
};

const DEFAULT_DEFENSIVE_CATEGORY = 'General defense';
// The rank slider holds the product scale (30 = allows the most); positions only exist in
// filters and requests. The default is the 10 that allow the most.
const DEFAULT_RANK_RANGE = [21, 30];

/* the stat list is the game-log row shape, known before any season
   request, so the Own stats control can render with no click. Only the slider
   bounds wait for the season. */
export const STAT_COLUMNS = [
  'PTS',
  'REB',
  'AST',
  'FG3M',
  'STL',
  'BLK',
  'TOV',
  'PRA',
  'PR',
  'PA',
  'RA',
  'STKS',
  'FGA',
  'FGM',
  'FG_PCT',
  'FG2A',
  'FG2M',
  'FG3A',
  'FTA',
  'FTM',
  'OREB',
  'DREB',
  'PF',
  'FD_PTS',
  'PLAYTYPE_RTG',
];

export const STAT_LABELS = {
  PTS: 'Points',
  REB: 'Rebounds',
  AST: 'Assists',
  FG3M: '3s made',
  STL: 'Steals',
  BLK: 'Blocks',
  TOV: 'Turnovers',
  PRA: 'Pts+Reb+Ast',
  PR: 'Pts+Reb',
  PA: 'Pts+Ast',
  RA: 'Reb+Ast',
  STKS: 'Stocks',
  FGA: 'FG attempts',
  FGM: 'FG made',
  FG_PCT: 'FG%',
  FG2A: '2PT attempts',
  FG2M: '2PT made',
  FG3A: '3PT attempts',
  FTA: 'FT attempts',
  FTM: 'FT made',
  OREB: 'Off. rebounds',
  DREB: 'Def. rebounds',
  PF: 'Fouls',
  FD_PTS: 'FanDuel pts',
  PLAYTYPE_RTG: 'Playtype rating',
};

export const defensiveCategoryItems = (category) =>
  OPPONENT_FILTERS.find((group) => group.category === category)?.items ?? [];

const useFilterPanel = ({
  playerList,
  onApplyFilters,
  selectedPlayer,
  seasonGameLogs,
  seasonGameLogsLoading,
  seasonGameLogsFailed,
  onOpenSelfFilters,
  appliedFilters,
}) => {
  const [selectedDefensiveFilter, setSelectedDefensiveFilter] = useState('None');
  const [activeDefensiveCategory, setActiveDefensiveCategory] = useState(
    DEFAULT_DEFENSIVE_CATEGORY,
  );
  const [rankRange, setRankRange] = useState(DEFAULT_RANK_RANGE);
  const [activeFilters, setActiveFilters] = useState([]);
  const [playerInput, setPlayerInput] = useState('');
  const [playerStatus, setPlayerStatus] = useState('on');
  const [activePlayers, setActivePlayers] = useState([]);
  const [playerSuggestions, setPlayerSuggestions] = useState([]);
  const [activePlayerSuggestionIndex, setActivePlayerSuggestionIndex] = useState(0);
  const [opponentTricode, setOpponentTricode] = useState('');
  const [locationFilter, setLocationFilter] = useState('Both');
  const [minutesFilter, setMinutesFilter] = useState([0, 48]);
  const [dateFilter, setDateFilter] = useState('');
  const [gameFilter, setGameFilter] = useState(0);
  const [playstyleMatchupRating, setPlaystyleMatchupRating] = useState([0, 200]);
  const [selectedSelfFilter, setSelectedSelfFilter] = useState('');
  const [selfFilterRange, setSelfFilterRange] = useState(null);
  const [activeSelfFilters, setActiveSelfFilters] = useState([]);
  const [columnRanges, setColumnRanges] = useState({});
  const [touchedControls, setTouchedControls] = useState(() => new Set());
  // controls changed since the last apply, for the "n unapplied" hint.
  const [dirty, setDirty] = useState(() => new Set());

  const markControlTouched = useCallback((control) => {
    setTouchedControls((previous) => {
      if (previous.has(control)) return previous;
      const next = new Set(previous);
      next.add(control);
      return next;
    });
    setDirty((previous) => {
      if (previous.has(control)) return previous;
      const next = new Set(previous);
      next.add(control);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!seasonGameLogs || seasonGameLogs.length === 0) {
      setColumnRanges({});
      return;
    }
    const ranges = STAT_COLUMNS.reduce((acc, col) => {
      const values = seasonGameLogs
        .map((log) => toFiniteNumber(log[col]))
        .filter((value) => value !== null);
      if (values.length > 0) acc[col] = { min: Math.min(...values), max: Math.max(...values) };
      return acc;
    }, {});
    setColumnRanges(ranges);
  }, [seasonGameLogs]);

  // a stat picked before the season arrived gets its full range once it does.
  useEffect(() => {
    if (selectedSelfFilter && !selfFilterRange && columnRanges[selectedSelfFilter]) {
      const { min, max } = columnRanges[selectedSelfFilter];
      setSelfFilterRange([min, max]);
    }
  }, [columnRanges, selectedSelfFilter, selfFilterRange]);

  useEffect(() => {
    setSelectedDefensiveFilter('None');
    setActiveDefensiveCategory(DEFAULT_DEFENSIVE_CATEGORY);
    setRankRange(DEFAULT_RANK_RANGE);
    setActiveFilters([]);
    setPlayerInput('');
    setPlayerStatus('on');
    setActivePlayers([]);
    setOpponentTricode('');
    setLocationFilter('Both');
    setMinutesFilter([0, 48]);
    setDateFilter('');
    setGameFilter(0);
    setPlaystyleMatchupRating([0, 200]);
    setSelectedSelfFilter('');
    setSelfFilterRange(null);
    setActiveSelfFilters([]);
    setPlayerSuggestions([]);
    setActivePlayerSuggestionIndex(0);

    const prepopulatedControls = new Set();
    if (appliedFilters && Object.keys(appliedFilters).length > 0) {
      if (appliedFilters.game_filter) {
        setGameFilter(appliedFilters.game_filter);
        prepopulatedControls.add('game_filter');
      }
      if (appliedFilters.location_filter) {
        setLocationFilter(appliedFilters.location_filter);
        prepopulatedControls.add('location_filter');
      }
      if (appliedFilters.opponent_tricode) {
        setOpponentTricode(appliedFilters.opponent_tricode);
        prepopulatedControls.add('opponent_tricode');
      }
      if (appliedFilters.date_filter) {
        setDateFilter(appliedFilters.date_filter);
        prepopulatedControls.add('date_filter');
      }
      if (appliedFilters.minutes_filter && typeof appliedFilters.minutes_filter === 'string') {
        const parts = appliedFilters.minutes_filter.split(',');
        if (parts.length === 2) {
          setMinutesFilter(parts.map(Number));
          prepopulatedControls.add('minutes_filter');
        }
      }
      if (
        hasFilterValue(appliedFilters.playstyle_RTG_min) ||
        hasFilterValue(appliedFilters.playstyle_RTG_max)
      ) {
        setPlaystyleMatchupRating([
          hasFilterValue(appliedFilters.playstyle_RTG_min)
            ? Number(appliedFilters.playstyle_RTG_min)
            : 0,
          hasFilterValue(appliedFilters.playstyle_RTG_max)
            ? Number(appliedFilters.playstyle_RTG_max)
            : 200,
        ]);
        prepopulatedControls.add('playstyle_RTG');
      }
      const playersToAdd = [];
      if (appliedFilters['players_on[]']) {
        []
          .concat(appliedFilters['players_on[]'])
          .forEach((name) => playersToAdd.push({ name, status: 'on' }));
      }
      if (appliedFilters['players_off[]']) {
        []
          .concat(appliedFilters['players_off[]'])
          .forEach((name) => playersToAdd.push({ name, status: 'off' }));
      }
      if (playersToAdd.length > 0) {
        setActivePlayers(playersToAdd);
        prepopulatedControls.add('players');
      }
      if (appliedFilters['teams_against[]'] && appliedFilters['rank_filter[]']) {
        const teamsAgainst = [].concat(appliedFilters['teams_against[]']);
        const rankFilter = [].concat(appliedFilters['rank_filter[]']);
        const filtersToAdd = teamsAgainst
          .map((team, index) => ({ filter: team, number: parseRank(rankFilter[index]) }))
          .filter(({ number }) => number !== null);
        if (filtersToAdd.length > 0) {
          setActiveFilters(filtersToAdd);
          prepopulatedControls.add('teams_against');
        }
      }
      const selfFiltersToAdd = [];
      Object.keys(appliedFilters).forEach((key) => {
        if (key.startsWith('self_filters[') && typeof appliedFilters[key] === 'string') {
          const column = key.match(/\[(.*?)\]/)[1];
          const parts = appliedFilters[key].split(',');
          if (parts.length === 2) selfFiltersToAdd.push({ column, range: parts.map(Number) });
        }
      });
      if (selfFiltersToAdd.length > 0) {
        setActiveSelfFilters(selfFiltersToAdd);
        prepopulatedControls.add('self_filters');
      }
    }
    setTouchedControls(prepopulatedControls);
    setDirty(new Set());
  }, [appliedFilters]);

  const pendingRank = encodeRankRange(mirrorRankRange(rankRange));
  const canAddFilter = selectedDefensiveFilter !== 'None';

  const addDefensiveFilter = () => {
    if (!canAddFilter) return false;
    setActiveFilters([
      ...activeFilters.filter((filter) => filter.filter !== selectedDefensiveFilter),
      { filter: selectedDefensiveFilter, number: pendingRank },
    ]);
    markControlTouched('teams_against');
    setSelectedDefensiveFilter('None');
    return true;
  };

  const editDefensiveFilter = (filter) => {
    const category = OPPONENT_FILTERS.find((group) =>
      group.items.some((item) => item.token === filter.filter),
    );
    setActiveDefensiveCategory(category?.category || DEFAULT_DEFENSIVE_CATEGORY);
    setSelectedDefensiveFilter(filter.filter);
    setRankRange(mirrorRankRange(rankRangeOf(filter.number)));
  };

  const editSelfFilter = (filter) => {
    ensureSeason();
    setSelectedSelfFilter(filter.column);
    setSelfFilterRange(filter.range);
  };

  const removeDefensiveFilter = (index) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
    markControlTouched('teams_against');
  };

  const changeDefensiveCategory = (category) => {
    setActiveDefensiveCategory(category);
    if (!defensiveCategoryItems(category).some((item) => item.token === selectedDefensiveFilter)) {
      setSelectedDefensiveFilter('None');
    }
  };

  const changePlayerSearch = (value) => {
    setPlayerInput(value);
    if (value.length > 0) {
      setPlayerSuggestions(
        (playerList || [])
          .filter((player) => String(player).toLowerCase().includes(value.toLowerCase()))
          .filter((player) => player !== selectedPlayer)
          .slice(0, 6),
      );
    } else {
      setPlayerSuggestions([]);
    }
    setActivePlayerSuggestionIndex(0);
  };

  const addPlayer = (name = playerInput, status = playerStatus) => {
    const trimmed = String(name).trim();
    if (!trimmed || activePlayers.some((p) => p.name === trimmed)) return false;
    setActivePlayers([...activePlayers, { name: trimmed, status }]);
    markControlTouched('players');
    setPlayerInput('');
    setPlayerSuggestions([]);
    setActivePlayerSuggestionIndex(0);
    return true;
  };

  const playerSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setPlayerSuggestions([]);
      return;
    }
    if (playerSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addPlayer();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivePlayerSuggestionIndex((index) => (index + 1) % playerSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivePlayerSuggestionIndex(
        (index) => (index - 1 + playerSuggestions.length) % playerSuggestions.length,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // picking a suggestion adds it straight away; no separate Add click.
      addPlayer(playerSuggestions[activePlayerSuggestionIndex] || playerSuggestions[0]);
    }
  };

  const removePlayer = (player) => {
    setActivePlayers(
      activePlayers.filter((p) => !(p.status === player.status && p.name === player.name)),
    );
    markControlTouched('players');
  };

  // flip a teammate between on and off from the chip itself.
  const togglePlayer = (player) => {
    setActivePlayers(
      activePlayers.map((p) =>
        p.name === player.name ? { ...p, status: p.status === 'on' ? 'off' : 'on' } : p,
      ),
    );
    markControlTouched('players');
  };

  const changeLocation = (value) => {
    setLocationFilter(value);
    markControlTouched('location_filter');
  };
  const changeMinutes = (value) => {
    setMinutesFilter(value);
    markControlTouched('minutes_filter');
  };
  const changePlaytype = (value) => {
    setPlaystyleMatchupRating(value);
    markControlTouched('playstyle_RTG');
  };
  const changeDate = (value) => {
    setDateFilter(value);
    markControlTouched('date_filter');
  };
  const changeGames = (value) => {
    setGameFilter(value);
    markControlTouched('game_filter');
  };
  const clearOpponent = () => {
    setOpponentTricode('');
    markControlTouched('opponent_tricode');
  };

  const ensureSeason = useCallback(() => onOpenSelfFilters(), [onOpenSelfFilters]);

  // one-tap rule from the next-opponent card .
  const addTeamFilter = (token, range) => {
    setActiveFilters((previous) => [
      ...previous.filter((f) => f.filter !== token),
      { filter: token, number: encodeRankRange(range) },
    ]);
    markControlTouched('teams_against');
  };

  const selectSelfStat = (column) => {
    ensureSeason();
    setSelectedSelfFilter(column);
    setSelfFilterRange(
      column && columnRanges[column] ? [columnRanges[column].min, columnRanges[column].max] : null,
    );
  };

  const canAddSelfFilter = Boolean(selectedSelfFilter && selfFilterRange);

  const addSelfFilter = () => {
    if (!canAddSelfFilter) return false;
    setActiveSelfFilters([
      ...activeSelfFilters.filter((f) => f.column !== selectedSelfFilter),
      { column: selectedSelfFilter, range: selfFilterRange },
    ]);
    markControlTouched('self_filters');
    setSelectedSelfFilter('');
    setSelfFilterRange(null);
    return true;
  };

  const removeSelfFilter = (index) => {
    setActiveSelfFilters(activeSelfFilters.filter((_, i) => i !== index));
    markControlTouched('self_filters');
  };

  const buildParams = () => {
    const filterParams = { player_name: selectedPlayer };
    if (touchedControls.has('minutes_filter')) {
      filterParams.minutes_filter = `${minutesFilter[0]},${minutesFilter[1]}`;
    }
    if (touchedControls.has('players')) {
      filterParams['players_on[]'] = activePlayers
        .filter((p) => p.status === 'on')
        .map((p) => p.name);
      filterParams['players_off[]'] = activePlayers
        .filter((p) => p.status === 'off')
        .map((p) => p.name);
    }
    if (touchedControls.has('date_filter')) filterParams.date_filter = dateFilter || null;
    if (touchedControls.has('teams_against')) {
      filterParams['teams_against[]'] = activeFilters.map((filter) => filter.filter);
      filterParams['rank_filter[]'] = activeFilters.map((filter) => filter.number);
    }
    if (touchedControls.has('opponent_tricode')) {
      filterParams.opponent_tricode = opponentTricode || null;
    }
    if (touchedControls.has('location_filter')) filterParams.location_filter = locationFilter;
    if (touchedControls.has('game_filter')) filterParams.game_filter = gameFilter || null;
    if (touchedControls.has('playstyle_RTG')) {
      filterParams.playstyle_RTG_min = playstyleMatchupRating[0];
      filterParams.playstyle_RTG_max = playstyleMatchupRating[1];
    }
    if (touchedControls.has('self_filters')) {
      Object.keys(appliedFilters || {})
        .filter((key) => key.startsWith('self_filters['))
        .forEach((key) => {
          filterParams[key] = null;
        });
      activeSelfFilters.forEach((filter) => {
        filterParams[`self_filters[${filter.column}]`] = filter.range.join(',');
      });
    }
    return filterParams;
  };

  const apply = () => {
    onApplyFilters(buildParams());
    setDirty(new Set());
  };

  // back to API defaults for every control, then apply.
  const resetAll = () => {
    onApplyFilters({
      player_name: selectedPlayer,
      minutes_filter: null,
      'players_on[]': [],
      'players_off[]': [],
      date_filter: null,
      'teams_against[]': [],
      'rank_filter[]': [],
      opponent_tricode: null,
      location_filter: null,
      game_filter: null,
      playstyle_RTG_min: null,
      playstyle_RTG_max: null,
      ...Object.fromEntries(
        Object.keys(appliedFilters || {})
          .filter((key) => key.startsWith('self_filters['))
          .map((key) => [key, null]),
      ),
    });
  };

  // What each control currently says, for summaries. null means "no filter".
  const summary = {
    players: activePlayers.length > 0 ? activePlayers : null,
    date: dateFilter || null,
    games: Number(gameFilter) > 0 ? Number(gameFilter) : null,
    location: locationFilter !== 'Both' ? locationFilter : null,
    minutes: minutesFilter[0] !== 0 || minutesFilter[1] !== 48 ? minutesFilter : null,
    playtype:
      playstyleMatchupRating[0] !== 0 || playstyleMatchupRating[1] !== 200
        ? playstyleMatchupRating
        : null,
    opponent: opponentTricode || null,
    defense: activeFilters.length > 0 ? activeFilters : null,
    self: activeSelfFilters.length > 0 ? activeSelfFilters : null,
  };
  const activeCount =
    (summary.players?.length || 0) +
    (summary.date ? 1 : 0) +
    (summary.games ? 1 : 0) +
    (summary.location ? 1 : 0) +
    (summary.minutes ? 1 : 0) +
    (summary.playtype ? 1 : 0) +
    (summary.opponent ? 1 : 0) +
    (summary.defense?.length || 0) +
    (summary.self?.length || 0);

  return {
    selectedPlayer,
    // teammates
    playerInput,
    playerStatus,
    setPlayerStatus,
    activePlayers,
    playerSuggestions,
    activePlayerSuggestionIndex,
    changePlayerSearch,
    playerSearchKeyDown,
    addPlayer,
    removePlayer,
    togglePlayer,
    // games
    dateFilter,
    changeDate,
    gameFilter,
    changeGames,
    locationFilter,
    changeLocation,
    minutesFilter,
    changeMinutes,
    playstyleMatchupRating,
    changePlaytype,
    opponentTricode,
    clearOpponent,
    // defense
    activeDefensiveCategory,
    changeDefensiveCategory,
    selectedDefensiveFilter,
    setSelectedDefensiveFilter,
    rankRange,
    setRankRange,
    canAddFilter,
    addDefensiveFilter,
    addTeamFilter,
    removeDefensiveFilter,
    editDefensiveFilter,
    editSelfFilter,
    activeFilters,
    opponentFilterLabel,
    // own stats
    ensureSeason,
    selectedSelfFilter,
    selectSelfStat,
    selfFilterRange,
    setSelfFilterRange,
    canAddSelfFilter,
    addSelfFilter,
    removeSelfFilter,
    activeSelfFilters,
    columnRanges,
    seasonGameLogsLoading,
    seasonGameLogsFailed,
    // apply
    apply,
    resetAll,
    dirtyCount: dirty.size,
    summary,
    activeCount,
  };
};

export default useFilterPanel;
