import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Button,
  InputGroup,
  FormControl,
  Badge,
  ToggleButtonGroup,
  ToggleButton,
  Row,
  Col,
  ListGroup,
} from 'react-bootstrap';
import ReactSlider from 'react-slider';
import { OPPONENT_FILTERS, opponentFilterLabel } from './opponentFilters';
import { formatNumber, toFiniteNumber } from './numberUtils';
import './FilterOptions.css';

const hasFilterValue = (value) => value !== null && value !== undefined && value !== '';

// The pills sit in a single row inside a narrow panel, so each category wears a
// shortened name. A category without an entry falls back to its full name.
const DEFENSIVE_CATEGORY_PILL_LABELS = {
  'General defense': 'General',
  'Shot type defense': 'Shot type',
  'Play type defense': 'Play type',
  'Assists allowed': 'Assists',
};

const DEFAULT_DEFENSIVE_CATEGORY = 'General defense';

const defensiveCategoryItems = (category) =>
  OPPONENT_FILTERS.find((group) => group.category === category)?.items ?? [];

const FilterOptions = ({
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
  const [filterNumber, setFilterNumber] = useState('');
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
  const [selfFilterColumns, setSelfFilterColumns] = useState([]);
  const [selectedSelfFilter, setSelectedSelfFilter] = useState('');
  const [selfFilterRange, setSelfFilterRange] = useState([0, 0]);
  const [activeSelfFilters, setActiveSelfFilters] = useState([]);
  const [columnRanges, setColumnRanges] = useState({});
  const [selfFiltersOpen, setSelfFiltersOpen] = useState(false);
  // Only controls the user touched are emitted, so the API applies its own
  // defaults to the rest. Touched-ness is tracked rather than compared against
  // a copy of those defaults, which would drift from the API.
  const [touchedControls, setTouchedControls] = useState(() => new Set());

  const markControlTouched = (control) => {
    setTouchedControls((previous) => {
      if (previous.has(control)) return previous;
      const next = new Set(previous);
      next.add(control);
      return next;
    });
  };

  // The stats on offer and the bounds of their sliders describe the player's
  // whole season, so a filter narrowed to it can always be widened out again.
  useEffect(() => {
    if (!seasonGameLogs || seasonGameLogs.length === 0) {
      setSelfFilterColumns([]);
      setColumnRanges({});
      return;
    }

    const columns = Object.keys(seasonGameLogs[0]).filter(
      (col) =>
        typeof seasonGameLogs[0][col] === 'number' &&
        !['GAME_ID', 'GAME_DATE', 'MIN'].includes(col),
    );
    setSelfFilterColumns(columns);

    const ranges = columns.reduce((acc, col) => {
      const values = seasonGameLogs
        .map((log) => toFiniteNumber(log[col]))
        .filter((value) => value !== null);
      if (values.length > 0) {
        acc[col] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
      return acc;
    }, {});
    setColumnRanges(ranges);
  }, [seasonGameLogs]);

  // The season is asked for when the control that needs it is opened, and an
  // open control follows a player change onto that player's season. A control
  // never opened asks for nothing at all.
  useEffect(() => {
    if (!selfFiltersOpen) return;
    onOpenSelfFilters();
  }, [onOpenSelfFilters, selfFiltersOpen]);

  // Reset all filters to defaults and then pre-populate with new query filters
  useEffect(() => {
    // Always reset all form fields to their defaults first
    setSelectedDefensiveFilter('None');
    setActiveDefensiveCategory(DEFAULT_DEFENSIVE_CATEGORY);
    setFilterNumber('');
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
    setSelfFilterRange([0, 0]);
    setActiveSelfFilters([]);
    setPlayerSuggestions([]);
    setActivePlayerSuggestionIndex(0);

    // A control pre-populated from an existing filter set counts as touched, so
    // a later apply preserves it instead of dropping it.
    const prepopulatedControls = new Set();

    // Then pre-populate with new applied filters if they exist
    if (appliedFilters && Object.keys(appliedFilters).length > 0) {
      // Pre-populate game filter
      if (appliedFilters.game_filter) {
        setGameFilter(appliedFilters.game_filter);
        prepopulatedControls.add('game_filter');
      }

      // Pre-populate location filter
      if (appliedFilters.location_filter) {
        setLocationFilter(appliedFilters.location_filter);
        prepopulatedControls.add('location_filter');
      }

      // Pre-populate the one specific opponent the Filter Set fixes
      if (appliedFilters.opponent_tricode) {
        setOpponentTricode(appliedFilters.opponent_tricode);
        prepopulatedControls.add('opponent_tricode');
      }

      // Pre-populate date filter
      if (appliedFilters.date_filter) {
        setDateFilter(appliedFilters.date_filter);
        prepopulatedControls.add('date_filter');
      }

      // Pre-populate minutes filter
      if (appliedFilters.minutes_filter && typeof appliedFilters.minutes_filter === 'string') {
        const parts = appliedFilters.minutes_filter.split(',');
        if (parts.length === 2) {
          const [min, max] = parts.map(Number);
          setMinutesFilter([min, max]);
          prepopulatedControls.add('minutes_filter');
        }
      }

      // Pre-populate playstyle rating. Presence, not truthiness: the API's own
      // lower bound is 0, so a link carrying it must reach the slider or a later
      // apply would silently drop the bound the user arrived with. Either bound
      // alone is still a range: the side the link left out is the API's own
      // default, so the slider can show exactly what the request applied.
      if (
        hasFilterValue(appliedFilters.playstyle_RTG_min) ||
        hasFilterValue(appliedFilters.playstyle_RTG_max)
      ) {
        setPlaystyleMatchupRating([
          hasFilterValue(appliedFilters.playstyle_RTG_min) ? appliedFilters.playstyle_RTG_min : 0,
          hasFilterValue(appliedFilters.playstyle_RTG_max) ? appliedFilters.playstyle_RTG_max : 200,
        ]);
        prepopulatedControls.add('playstyle_RTG');
      }

      // Pre-populate players on/off
      const playersToAdd = [];
      // Check for both possible key formats
      if (appliedFilters['players_on[]']) {
        const playersOn = Array.isArray(appliedFilters['players_on[]'])
          ? appliedFilters['players_on[]']
          : [appliedFilters['players_on[]']];
        playersOn.forEach((player) => playersToAdd.push({ name: player, status: 'on' }));
      }
      if (appliedFilters['players_off[]']) {
        const playersOff = Array.isArray(appliedFilters['players_off[]'])
          ? appliedFilters['players_off[]']
          : [appliedFilters['players_off[]']];
        playersOff.forEach((player) => playersToAdd.push({ name: player, status: 'off' }));
      }
      if (playersToAdd.length > 0) {
        setActivePlayers(playersToAdd);
        prepopulatedControls.add('players');
      }

      // Pre-populate opponent filters
      if (appliedFilters['teams_against[]'] && appliedFilters['rank_filter[]']) {
        const teamsAgainst = Array.isArray(appliedFilters['teams_against[]'])
          ? appliedFilters['teams_against[]']
          : [appliedFilters['teams_against[]']];
        const rankFilter = Array.isArray(appliedFilters['rank_filter[]'])
          ? appliedFilters['rank_filter[]']
          : [appliedFilters['rank_filter[]']];

        // Same rule as adding by hand: a rank of zero matches no team, so an
        // unusable rank drops its filter rather than silently emptying the table.
        const filtersToAdd = teamsAgainst
          .map((team, index) => ({ filter: team, number: parseInt(rankFilter[index], 10) }))
          .filter(({ number }) => !Number.isNaN(number) && number !== 0);
        if (filtersToAdd.length > 0) {
          setActiveFilters(filtersToAdd);
          prepopulatedControls.add('teams_against');
        }
      }

      // Pre-populate self filters
      const selfFiltersToAdd = [];
      Object.keys(appliedFilters).forEach((key) => {
        if (
          key.startsWith('self_filters[') &&
          appliedFilters[key] &&
          typeof appliedFilters[key] === 'string'
        ) {
          const column = key.match(/\[(.*?)\]/)[1];
          const parts = appliedFilters[key].split(',');
          if (parts.length === 2) {
            const [min, max] = parts.map(Number);
            selfFiltersToAdd.push({ column, range: [min, max] });
          }
        }
      });
      if (selfFiltersToAdd.length > 0) {
        setActiveSelfFilters(selfFiltersToAdd);
        prepopulatedControls.add('self_filters');
      }
    }

    setTouchedControls(prepopulatedControls);
  }, [appliedFilters]);

  // A rank is a league position: positive counts from the best defenses, negative
  // from the worst. Zero asks for the top nothing, which silently matches no team
  // and returns an empty table, so it is not an addable filter.
  const parsedFilterRank = parseInt(filterNumber, 10);
  const canAddFilter =
    selectedDefensiveFilter !== 'None' &&
    !Number.isNaN(parsedFilterRank) &&
    parsedFilterRank !== 0 &&
    !activeFilters.some((f) => f.filter === selectedDefensiveFilter);

  const handleAddFilter = () => {
    if (!canAddFilter) return;
    setActiveFilters([
      ...activeFilters,
      { filter: selectedDefensiveFilter, number: parsedFilterRank },
    ]);
    markControlTouched('teams_against');
    setSelectedDefensiveFilter('None');
    setFilterNumber('');
  };

  const handleRemoveFilter = (index) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  // The select only ever offers one category, so a selection made under the old
  // category would otherwise stay applied while invisible. It survives only
  // when the new category is the one it came from.
  const handleDefensiveCategoryChange = (category) => {
    setActiveDefensiveCategory(category);
    const items = defensiveCategoryItems(category);
    if (!items.some((item) => item.token === selectedDefensiveFilter)) {
      setSelectedDefensiveFilter('None');
    }
  };

  const handlePlayerSearchChange = (e) => {
    const value = e.target.value;
    setPlayerInput(value);

    if (value.length > 0) {
      const filteredPlayers = (playerList || [])
        .filter((player) => String(player).toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5); // Limit to 5 suggestions
      setPlayerSuggestions(filteredPlayers);
      setActivePlayerSuggestionIndex(0);
    } else {
      setPlayerSuggestions([]);
      setActivePlayerSuggestionIndex(0);
    }
  };

  const handlePlayerSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setPlayerSuggestions([]);
      setActivePlayerSuggestionIndex(0);
      return;
    }

    if (playerSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddPlayer();
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
      handlePlayerSuggestionClick(
        playerSuggestions[activePlayerSuggestionIndex] || playerSuggestions[0],
      );
    }
  };

  const handlePlayerSuggestionClick = (player) => {
    setPlayerInput(player);
    setPlayerSuggestions([]);
    setActivePlayerSuggestionIndex(0);
  };

  const handleAddPlayer = () => {
    if (playerInput.trim() && !activePlayers.some((p) => p.name === playerInput.trim())) {
      setActivePlayers([...activePlayers, { name: playerInput.trim(), status: playerStatus }]);
      markControlTouched('players');
      setPlayerInput('');
      setPlayerSuggestions([]);
      setActivePlayerSuggestionIndex(0);
    }
  };

  const handleLocationChange = (val) => {
    setLocationFilter(val);
    markControlTouched('location_filter');
  };

  const handleMinutesFilterChange = (newValues) => {
    setMinutesFilter(newValues);
    markControlTouched('minutes_filter');
  };

  const handlePlaystyleMatchupRatingChange = (newRange) => {
    setPlaystyleMatchupRating(newRange);
    markControlTouched('playstyle_RTG');
  };

  const handleSelfFilterSelect = (column) => {
    setSelectedSelfFilter(column);
    if (column && columnRanges[column]) {
      setSelfFilterRange([columnRanges[column].min, columnRanges[column].max]);
    }
  };

  const handleSelfFilterRangeChange = (newValues) => {
    setSelfFilterRange(newValues);
  };

  const handleAddSelfFilter = () => {
    if (selectedSelfFilter) {
      const newFilter = {
        column: selectedSelfFilter,
        range: selfFilterRange,
      };
      setActiveSelfFilters([...activeSelfFilters, newFilter]);
      markControlTouched('self_filters');
      setSelectedSelfFilter('');
      setSelfFilterRange([0, 0]);
    }
  };

  const handleRemoveSelfFilter = (index) => {
    setActiveSelfFilters(activeSelfFilters.filter((_, i) => i !== index));
    markControlTouched('self_filters');
  };

  const handleApplyFilters = () => {
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
    if (touchedControls.has('date_filter')) {
      filterParams.date_filter = dateFilter || null;
    }
    if (touchedControls.has('teams_against')) {
      filterParams['teams_against[]'] = activeFilters.map((filter) => filter.filter);
      filterParams['rank_filter[]'] = activeFilters.map((filter) => filter.number);
    }
    if (touchedControls.has('opponent_tricode')) {
      filterParams.opponent_tricode = opponentTricode || null;
    }
    if (touchedControls.has('location_filter')) {
      filterParams.location_filter = locationFilter;
    }
    if (touchedControls.has('game_filter')) {
      filterParams.game_filter = gameFilter || null;
    }
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

    onApplyFilters(filterParams);
  };

  return (
    <Card className="dark-card">
      <Card.Body>
        <Form.Group className="mb-4">
          <Form.Label htmlFor="filter-player-input">Player Filter:</Form.Label>
          <div className="position-relative">
            <InputGroup>
              <FormControl
                type="text"
                value={playerInput}
                onChange={handlePlayerSearchChange}
                onKeyDown={handlePlayerSearchKeyDown}
                placeholder="Search for a player..."
                className="player-selector-input"
                id="filter-player-input"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={playerSuggestions.length > 0}
                aria-controls="filter-player-suggestions"
                aria-activedescendant={
                  playerSuggestions.length > 0
                    ? `filter-player-suggestion-${activePlayerSuggestionIndex}`
                    : undefined
                }
              />
              <ToggleButtonGroup
                type="radio"
                name="playerStatus"
                value={playerStatus}
                onChange={setPlayerStatus}
              >
                <ToggleButton id="tbg-radio-1" value="on" variant="outline-success">
                  ON
                </ToggleButton>
                <ToggleButton id="tbg-radio-2" value="off" variant="outline-danger">
                  OFF
                </ToggleButton>
              </ToggleButtonGroup>
              <Button type="button" variant="outline-primary" onClick={handleAddPlayer}>
                Add
              </Button>
            </InputGroup>
            {playerSuggestions.length > 0 && (
              <ListGroup
                id="filter-player-suggestions"
                className="suggestions-list position-absolute w-100"
                style={{ zIndex: 1000 }}
                role="listbox"
              >
                {playerSuggestions.map((player, index) => (
                  <ListGroup.Item
                    key={player}
                    id={`filter-player-suggestion-${index}`}
                    as="button"
                    type="button"
                    action
                    role="option"
                    aria-selected={index === activePlayerSuggestionIndex}
                    onClick={() => handlePlayerSuggestionClick(player)}
                    className="py-2"
                  >
                    {player}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
          <div className="mt-2">
            {(() => {
              const onPlayers = activePlayers.filter((p) => p.status === 'on');
              const offPlayers = activePlayers.filter((p) => p.status === 'off');
              const badges = [];

              if (onPlayers.length > 0) {
                onPlayers.forEach((player, index) => {
                  badges.push(
                    <Badge key={`on-player-${index}`} bg="success" className="me-1 mb-1 p-2">
                      (ON) {player.name}
                      <Button
                        type="button"
                        aria-label={`Remove ${player.name} from ON players`}
                        title="Remove player"
                        variant="link"
                        size="sm"
                        className="text-light p-0 ms-2"
                        onClick={() => {
                          setActivePlayers(
                            activePlayers.filter(
                              (p) => !(p.status === 'on' && p.name === player.name),
                            ),
                          );
                        }}
                      >
                        ×
                      </Button>
                    </Badge>,
                  );
                });
              }

              if (offPlayers.length > 0) {
                offPlayers.forEach((player, index) => {
                  badges.push(
                    <Badge key={`off-player-${index}`} bg="danger" className="me-1 mb-1 p-2">
                      (OFF) {player.name}
                      <Button
                        type="button"
                        aria-label={`Remove ${player.name} from OFF players`}
                        title="Remove player"
                        variant="link"
                        size="sm"
                        className="text-light p-0 ms-2"
                        onClick={() => {
                          setActivePlayers(
                            activePlayers.filter(
                              (p) => !(p.status === 'off' && p.name === player.name),
                            ),
                          );
                        }}
                      >
                        ×
                      </Button>
                    </Badge>,
                  );
                });
              }

              return badges;
            })()}
          </div>
        </Form.Group>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-4">
              <Form.Label htmlFor="filter-date">Date Filter:</Form.Label>
              <Form.Control
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  markControlTouched('date_filter');
                }}
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Location:</Form.Label>
              <ToggleButtonGroup
                type="radio"
                name="locationOptions"
                value={locationFilter}
                onChange={handleLocationChange}
                className="w-100"
              >
                <ToggleButton
                  id="tbg-radio-3"
                  variant="outline-primary"
                  value="Both"
                  className="w-100"
                >
                  Both
                </ToggleButton>
                <ToggleButton
                  id="tbg-radio-4"
                  variant="outline-primary"
                  value="Home"
                  className="w-100"
                >
                  Home
                </ToggleButton>
                <ToggleButton
                  id="tbg-radio-5"
                  variant="outline-primary"
                  value="Away"
                  className="w-100"
                >
                  Away
                </ToggleButton>
              </ToggleButtonGroup>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-4">
              <Form.Label htmlFor="filter-last-games">Last N games:</Form.Label>
              <Form.Control
                id="filter-last-games"
                type="number"
                min="0"
                value={gameFilter}
                onChange={(e) => {
                  setGameFilter(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  markControlTouched('game_filter');
                }}
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>
                Playtype Matchup Rating: {playstyleMatchupRating[0]} - {playstyleMatchupRating[1]}
              </Form.Label>
              <ReactSlider
                className="horizontal-slider"
                thumbClassName="thumb"
                trackClassName="track"
                value={playstyleMatchupRating}
                ariaLabel={['Lower thumb', 'Upper thumb']}
                ariaValuetext={(state) => `Thumb value ${state.valueNow}`}
                renderThumb={(props, state) => <div {...props}>{state.valueNow}</div>}
                pearling
                minDistance={1}
                min={0}
                max={200}
                step={1}
                onChange={handlePlaystyleMatchupRatingChange}
              />
            </Form.Group>
          </Col>
        </Row>
        <Form.Group className="mb-4">
          <Form.Label>
            Minute Range: {minutesFilter[0]} - {minutesFilter[1]}
          </Form.Label>
          <ReactSlider
            className="horizontal-slider"
            thumbClassName="thumb"
            trackClassName="track"
            value={minutesFilter}
            ariaLabel={['Lower thumb', 'Upper thumb']}
            ariaValuetext={(state) => `Thumb value ${state.valueNow}`}
            renderThumb={(props, state) => <div {...props}>{state.valueNow}</div>}
            pearling
            minDistance={1}
            min={0}
            max={48}
            onChange={handleMinutesFilterChange}
          />
        </Form.Group>
        {/* A specific opponent only ever arrives with the Filter Set — from a
            link, or from a Target handing off into the Log Workspace — so the
            panel names the opponent in force and offers the way out of it
            rather than a picker for choosing one. */}
        {opponentTricode && (
          <Form.Group className="mb-4">
            <Form.Label>Opponent:</Form.Label>
            <div>
              <Badge bg="primary" className="me-1 mb-1 p-2">
                vs {opponentTricode}
                <Button
                  type="button"
                  aria-label={`Remove ${opponentTricode} opponent filter`}
                  title="Remove filter"
                  variant="link"
                  size="sm"
                  className="text-light p-0 ms-2"
                  onClick={() => {
                    setOpponentTricode('');
                    markControlTouched('opponent_tricode');
                  }}
                >
                  ×
                </Button>
              </Badge>
            </div>
          </Form.Group>
        )}
        <Form.Group className="mb-4">
          <Form.Label htmlFor="defensive-filter">Defensive Filter:</Form.Label>
          <div className="defensive-category-pills">
            {OPPONENT_FILTERS.map((group) => (
              <button
                key={group.category}
                type="button"
                className={`defensive-category-pill${
                  group.category === activeDefensiveCategory ? ' is-active' : ''
                }`}
                aria-pressed={group.category === activeDefensiveCategory}
                onClick={() => handleDefensiveCategoryChange(group.category)}
              >
                {DEFENSIVE_CATEGORY_PILL_LABELS[group.category] || group.category}
              </button>
            ))}
          </div>
          <InputGroup>
            <Form.Select
              id="defensive-filter"
              className="defensive-filter-select"
              value={selectedDefensiveFilter}
              onChange={(e) => setSelectedDefensiveFilter(e.target.value)}
            >
              <option value="None">None</option>
              {defensiveCategoryItems(activeDefensiveCategory).map((item) => (
                <option key={item.token} value={item.token}>
                  {item.label}
                </option>
              ))}
            </Form.Select>
            <FormControl
              id="defensive-filter-rank"
              aria-label="Defensive filter rank"
              className="defensive-filter-rank"
              type="text"
              value={filterNumber}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^-?\d*$/.test(value)) {
                  setFilterNumber(value);
                }
              }}
              onBlur={() => {
                if (filterNumber === '' || isNaN(parseInt(filterNumber))) {
                  setFilterNumber('');
                } else {
                  setFilterNumber(parseInt(filterNumber).toString());
                }
              }}
              placeholder="Number"
              style={{ appearance: 'textfield' }}
            />
            <Button
              type="button"
              variant="outline-primary"
              onClick={handleAddFilter}
              disabled={!canAddFilter}
            >
              Add
            </Button>
          </InputGroup>
          <div className="defensive-filter-rank-helper">
            Positive rank = top defenses, negative = bottom
          </div>
          <div className="mt-2">
            {activeFilters.map((filter, index) => (
              <Badge key={index} bg="primary" className="me-1 mb-1 p-2">
                {opponentFilterLabel(filter.filter)} ({filter.number})
                <Button
                  type="button"
                  aria-label={`Remove ${opponentFilterLabel(filter.filter)} filter`}
                  title="Remove filter"
                  variant="link"
                  size="sm"
                  className="text-light p-0 ms-2"
                  onClick={() => handleRemoveFilter(index)}
                >
                  ×
                </Button>
              </Badge>
            ))}
          </div>
        </Form.Group>
        <Form.Group className="mb-4">
          <Button
            type="button"
            variant="link"
            className="p-0 text-decoration-none form-label"
            aria-expanded={selfFiltersOpen}
            aria-controls="self-filter-controls"
            onClick={() => setSelfFiltersOpen(!selfFiltersOpen)}
          >
            Self Filters:
          </Button>
          {selfFiltersOpen && (
            <div id="self-filter-controls">
              <InputGroup>
                <Form.Select
                  aria-label="Self filter stat"
                  value={selectedSelfFilter}
                  onChange={(e) => handleSelfFilterSelect(e.target.value)}
                >
                  <option value="">Select Stat</option>
                  {selfFilterColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </Form.Select>
                <Button
                  type="button"
                  aria-label="Add self filter"
                  variant="outline-primary"
                  onClick={handleAddSelfFilter}
                >
                  Add
                </Button>
              </InputGroup>
              {seasonGameLogsLoading && (
                <div className="mt-2" role="status" aria-live="polite">
                  Loading the season for this player…
                </div>
              )}
              {seasonGameLogsFailed && (
                <div className="mt-2" role="status" aria-live="polite">
                  This player's season could not be loaded, so there are no stat ranges to offer.
                  Close and re-open Self Filters to try again.
                </div>
              )}
              {selectedSelfFilter && columnRanges[selectedSelfFilter] && (
                <div className="mt-2">
                  <Form.Label>
                    {selectedSelfFilter}: {formatNumber(selfFilterRange[0], 1)} -{' '}
                    {formatNumber(selfFilterRange[1], 1)}
                  </Form.Label>
                  <ReactSlider
                    className="horizontal-slider"
                    thumbClassName="thumb"
                    trackClassName="track"
                    value={selfFilterRange}
                    ariaLabel={['Lower thumb', 'Upper thumb']}
                    ariaValuetext={(state) => `Thumb value ${state.valueNow}`}
                    renderThumb={(props, state) => (
                      <div {...props}>{formatNumber(state.valueNow, 1)}</div>
                    )}
                    pearling
                    minDistance={0.1}
                    step={0.1}
                    min={columnRanges[selectedSelfFilter].min}
                    max={columnRanges[selectedSelfFilter].max}
                    onChange={handleSelfFilterRangeChange}
                  />
                </div>
              )}
            </div>
          )}
          {/* The self filters already applied are a summary of the Filter Set,
              not part of the control, so they stay readable and removable while
              the control that builds new ones is closed. */}
          {activeSelfFilters.length > 0 && (
            <div className="mt-2" role="group" aria-label="Applied self filters">
              {activeSelfFilters.map((filter, index) => (
                <Badge key={index} bg="primary" className="me-1 mb-1 p-2">
                  {filter.column}: {formatNumber(filter.range[0], 1)} -{' '}
                  {formatNumber(filter.range[1], 1)}
                  <Button
                    type="button"
                    aria-label={`Remove ${filter.column} filter`}
                    title="Remove filter"
                    variant="link"
                    size="sm"
                    className="text-light p-0 ms-2"
                    onClick={() => handleRemoveSelfFilter(index)}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </Form.Group>

        <Button type="button" variant="primary" className="w-100" onClick={handleApplyFilters}>
          Apply Filters
        </Button>
      </Card.Body>
    </Card>
  );
};

export default FilterOptions;
