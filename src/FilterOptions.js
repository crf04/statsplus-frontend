import React, { useState, useEffect } from 'react';
import { Card, Form, Button, InputGroup, FormControl, Badge, ToggleButtonGroup, ToggleButton, Row, Col, ListGroup } from 'react-bootstrap';
import ReactSlider from 'react-slider';
import { defensiveOptions } from './utils';

const FilterOptions = ({ playerList, onApplyFilters, selectedPlayer, displayPlayer, gameLogs, initialGameLogs, appliedFilters}) => {
  const [selectedDefensiveFilter, setSelectedDefensiveFilter] = useState('None');
  const [filterNumber, setFilterNumber] = useState(0);
  const [activeFilters, setActiveFilters] = useState([]);
  const [playerInput, setPlayerInput] = useState('');
  const [playerStatus, setPlayerStatus] = useState('on');
  const [activePlayers, setActivePlayers] = useState([]);
  const [playerSuggestions, setPlayerSuggestions] = useState([]);
  const [locationFilter, setLocationFilter] = useState('Both');
  const [minutesFilter, setMinutesFilter] = useState([0, 48]);
  const [dateFilter, setDateFilter] = useState('');
  const [gameFilter, setGameFilter] = useState(0);
  const [playstyleMatchupRating, setPlaystyleMatchupRating] = useState([75, 125]);
  const [selfFilterColumns, setSelfFilterColumns] = useState([]);
  const [selectedSelfFilter, setSelectedSelfFilter] = useState('');
  const [selfFilterRange, setSelfFilterRange] = useState([0, 0]);
  const [activeSelfFilters, setActiveSelfFilters] = useState([]);
  const [columnRanges, setColumnRanges] = useState({});

  useEffect(() => {
    if (initialGameLogs && initialGameLogs.length > 0) {
      const columns = Object.keys(initialGameLogs[0]).filter(col => 
        typeof initialGameLogs[0][col] === 'number' && !['GAME_ID', 'GAME_DATE', 'MIN'].includes(col)
      );
      setSelfFilterColumns(columns);

      const ranges = columns.reduce((acc, col) => {
        const values = initialGameLogs.map(log => log[col]);
        acc[col] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
        return acc;
      }, {});
      setColumnRanges(ranges);
    }
  }, [initialGameLogs]);

  // Reset all filters to defaults and then pre-populate with new query filters
  useEffect(() => {
    // Always reset all form fields to their defaults first
    setSelectedDefensiveFilter('None');
    setFilterNumber(0);
    setActiveFilters([]);
    setPlayerInput('');
    setPlayerStatus('on');
    setActivePlayers([]);
    setLocationFilter('Both');
    setMinutesFilter([0, 48]);
    setDateFilter('');
    setGameFilter(0);
    setPlaystyleMatchupRating([75, 125]);
    setSelectedSelfFilter('');
    setSelfFilterRange([0, 0]);
    setActiveSelfFilters([]);
    setPlayerSuggestions([]);

    // Then pre-populate with new applied filters if they exist
    if (appliedFilters && Object.keys(appliedFilters).length > 0) {
      // Pre-populate game filter
      if (appliedFilters.game_filter) {
        setGameFilter(appliedFilters.game_filter);
      }

      // Pre-populate location filter
      if (appliedFilters.location_filter) {
        setLocationFilter(appliedFilters.location_filter);
      }

      // Pre-populate date filter
      if (appliedFilters.date_filter) {
        setDateFilter(appliedFilters.date_filter);
      }

      // Pre-populate minutes filter
      if (appliedFilters.minutes_filter && typeof appliedFilters.minutes_filter === 'string') {
        const parts = appliedFilters.minutes_filter.split(',');
        if (parts.length === 2) {
          const [min, max] = parts.map(Number);
          setMinutesFilter([min, max]);
        }
      }

      // Pre-populate playstyle rating
      if (appliedFilters.playstyle_RTG_min && appliedFilters.playstyle_RTG_max) {
        setPlaystyleMatchupRating([appliedFilters.playstyle_RTG_min, appliedFilters.playstyle_RTG_max]);
      }

      // Pre-populate players on/off
      const playersToAdd = [];
      // Check for both possible key formats
      const playersOnKey = appliedFilters['players_on[]'] ? 'players_on[]' : 'players_on';
      const playersOffKey = appliedFilters['players_off[]'] ? 'players_off[]' : 'players_off';
      
      if (appliedFilters[playersOnKey]) {
        const playersOn = Array.isArray(appliedFilters[playersOnKey]) ? 
          appliedFilters[playersOnKey] : [appliedFilters[playersOnKey]];
        playersOn.forEach(player => playersToAdd.push({ name: player, status: 'on' }));
      }
      if (appliedFilters[playersOffKey]) {
        const playersOff = Array.isArray(appliedFilters[playersOffKey]) ? 
          appliedFilters[playersOffKey] : [appliedFilters[playersOffKey]];
        playersOff.forEach(player => playersToAdd.push({ name: player, status: 'off' }));
      }
      if (playersToAdd.length > 0) {
        setActivePlayers(playersToAdd);
      }

      // Pre-populate teams against filter (legacy format)
      if (appliedFilters.teams_against && appliedFilters.filter_numbers) {
        const teamsAgainst = Array.isArray(appliedFilters.teams_against) ? 
          appliedFilters.teams_against : [appliedFilters.teams_against];
        const filterNumbers = Array.isArray(appliedFilters.filter_numbers) ? 
          appliedFilters.filter_numbers : [appliedFilters.filter_numbers];
        
        const filtersToAdd = teamsAgainst.map((team, index) => ({
          filter: team,
          number: filterNumbers[index] || 0
        }));
        setActiveFilters(filtersToAdd);
      }

      // Pre-populate opponent filters from natural language queries
      if (appliedFilters['teams_against[]'] && appliedFilters['rank_filter[]']) {
        const teamsAgainst = Array.isArray(appliedFilters['teams_against[]']) ? 
          appliedFilters['teams_against[]'] : [appliedFilters['teams_against[]']];
        const rankFilter = Array.isArray(appliedFilters['rank_filter[]']) ? 
          appliedFilters['rank_filter[]'] : [appliedFilters['rank_filter[]']];
        
        const filtersToAdd = teamsAgainst.map((team, index) => ({
          filter: team,
          number: parseInt(rankFilter[index]) || 0
        }));
        setActiveFilters(filtersToAdd);
      }

      // Pre-populate self filters
      const selfFiltersToAdd = [];
      Object.keys(appliedFilters).forEach(key => {
        if (key.startsWith('self_filters[') && appliedFilters[key] && typeof appliedFilters[key] === 'string') {
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
      }
    }
  }, [appliedFilters]);

  const handleAddFilter = () => {
    if (selectedDefensiveFilter !== 'None') {
      const existingFilter = activeFilters.find(f => f.filter === selectedDefensiveFilter);
      if (!existingFilter) {
        setActiveFilters([...activeFilters, { filter: selectedDefensiveFilter, number: filterNumber }]);
        setSelectedDefensiveFilter('None');
        setFilterNumber(0);
      }
    }
  };

  const handleRemoveFilter = (index) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const handlePlayerSearchChange = (e) => {
    const value = e.target.value;
    setPlayerInput(value);

    if (value.length > 0) {
      const filteredPlayers = playerList
        .filter(player => player.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5); // Limit to 5 suggestions
      setPlayerSuggestions(filteredPlayers);
    } else {
      setPlayerSuggestions([]);
    }
  };

  const handlePlayerSuggestionClick = (player) => {
    setPlayerInput(player);
    setPlayerSuggestions([]);
  };

  const handleAddPlayer = () => {
    if (playerInput && !activePlayers.some(p => p.name === playerInput)) {
      setActivePlayers([...activePlayers, { name: playerInput, status: playerStatus }]);
      setPlayerInput('');
      setPlayerSuggestions([]);
    }
  };


  const handleLocationChange = (val) => {
    setLocationFilter(val);
  };

  const handleMinutesFilterChange = (newValues) => {
    setMinutesFilter(newValues);
  };

  const handlePlaystyleMatchupRatingChange = (newRange) => {
    setPlaystyleMatchupRating(newRange);
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
        range: selfFilterRange
      };
      setActiveSelfFilters([...activeSelfFilters, newFilter]);
      setSelectedSelfFilter('');
      setSelfFilterRange([0, 0]);
    }
  };

  const handleRemoveSelfFilter = (index) => {
    setActiveSelfFilters(activeSelfFilters.filter((_, i) => i !== index));
  };

  const handleApplyFilters = () => {
    // Use displayPlayer if selectedPlayer is 'None' (from natural language queries)
    const playerName = selectedPlayer !== 'None' ? selectedPlayer : displayPlayer;
    
    const filterParams = {
      player_name: playerName,
      minutes_filter: `${minutesFilter[0]},${minutesFilter[1]}`,
      players_on: activePlayers.filter(p => p.status === 'on').map(p => p.name),
      players_off: activePlayers.filter(p => p.status === 'off').map(p => p.name),
      date_filter: dateFilter || null,
      teams_against: activeFilters.map(filter => filter.filter),
      filter_numbers: activeFilters.map(filter => filter.number),
      location_filter: locationFilter,
      game_filter: gameFilter || null,
      playstyle_RTG_min: playstyleMatchupRating[0],
      playstyle_RTG_max: playstyleMatchupRating[1]
    };
    activeSelfFilters.forEach(filter => {
      filterParams[`self_filters[${filter.column}]`] = filter.range.join(',');
    });
    onApplyFilters(filterParams);
  };

  return (
                  <Card className="dark-card">
      <Card.Body>
        <Form.Group className="mb-4">
          <Form.Label>Player Filter:</Form.Label>
          <div className="position-relative">
            <InputGroup>
              <FormControl
                type="text"
                value={playerInput}
                onChange={handlePlayerSearchChange}
                placeholder="Search for a player..."
                className="player-selector-input"
              />
              <ToggleButtonGroup type="radio" name="playerStatus" value={playerStatus} onChange={setPlayerStatus}>
                <ToggleButton id="tbg-radio-1" value="on" variant="outline-success">ON</ToggleButton>
                <ToggleButton id="tbg-radio-2" value="off" variant="outline-danger">OFF</ToggleButton>
              </ToggleButtonGroup>
              <Button variant="outline-primary" onClick={handleAddPlayer}>Add</Button>
            </InputGroup>
            {playerSuggestions.length > 0 && (
              <ListGroup className="suggestions-list position-absolute w-100" style={{ zIndex: 1000 }}>
                {playerSuggestions.map(player => (
                  <ListGroup.Item 
                    key={player} 
                    onClick={() => handlePlayerSuggestionClick(player)}
                    style={{ cursor: 'pointer' }}
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
              const onPlayers = activePlayers.filter(p => p.status === 'on');
              const offPlayers = activePlayers.filter(p => p.status === 'off');
              const badges = [];
              
              if (onPlayers.length > 0) {
                onPlayers.forEach((player, index) => {
                  badges.push(
                    <Badge key={`on-player-${index}`} bg="success" className="me-1 mb-1 p-2">
                      (ON) {player.name}
                      <Button variant="link" size="sm" className="text-light p-0 ms-2" onClick={() => {
                        setActivePlayers(activePlayers.filter(p => !(p.status === 'on' && p.name === player.name)));
                      }}>×</Button>
                    </Badge>
                  );
                });
              }
              
              if (offPlayers.length > 0) {
                offPlayers.forEach((player, index) => {
                  badges.push(
                    <Badge key={`off-player-${index}`} bg="danger" className="me-1 mb-1 p-2">
                      (OFF) {player.name}
                      <Button variant="link" size="sm" className="text-light p-0 ms-2" onClick={() => {
                        setActivePlayers(activePlayers.filter(p => !(p.status === 'off' && p.name === player.name)));
                      }}>×</Button>
                    </Badge>
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
              <Form.Label>Date Filter:</Form.Label>
              <Form.Control type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Location:</Form.Label>
              <ToggleButtonGroup type="radio" name="locationOptions" value={locationFilter} onChange={handleLocationChange} className="w-100">
                <ToggleButton id="tbg-radio-3" variant="outline-primary" value="Both" className="w-100">Both</ToggleButton>
                <ToggleButton id="tbg-radio-4" variant="outline-primary" value="Home" className="w-100">Home</ToggleButton>
                <ToggleButton id="tbg-radio-5" variant="outline-primary" value="Away" className="w-100">Away</ToggleButton>
              </ToggleButtonGroup>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-4">
              <Form.Label>Last N games:</Form.Label>
              <Form.Control type="number" value={gameFilter} onChange={e => setGameFilter(parseInt(e.target.value))} />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Playtype Matchup Rating: {playstyleMatchupRating[0]} - {playstyleMatchupRating[1]}</Form.Label>
              <ReactSlider
                className="horizontal-slider"
                thumbClassName="thumb"
                trackClassName="track"
                defaultValue={[75, 125]}
                ariaLabel={['Lower thumb', 'Upper thumb']}
                ariaValuetext={state => `Thumb value ${state.valueNow}`}
                renderThumb={(props, state) => <div {...props}>{state.valueNow}</div>}
                pearling
                minDistance={1}
                min={75}
                max={125}
                step={1}
                onChange={handlePlaystyleMatchupRatingChange}
              />
            </Form.Group>
          </Col>
        </Row>
        <Form.Group className="mb-4">
          <Form.Label>Minute Range: {minutesFilter[0]} - {minutesFilter[1]}</Form.Label>
          <ReactSlider
            className="horizontal-slider"
            thumbClassName="thumb"
            trackClassName="track"
            value={minutesFilter}
            ariaLabel={['Lower thumb', 'Upper thumb']}
            ariaValuetext={state => `Thumb value ${state.valueNow}`}
            renderThumb={(props, state) => <div {...props}>{state.valueNow}</div>}
            pearling
            minDistance={1}
            min={0}
            max={48}
            onChange={handleMinutesFilterChange}
          />
        </Form.Group>
        <Form.Group className="mb-4">
          <Form.Label>Defensive Filter:</Form.Label>
          <InputGroup>
            <Form.Select 
              value={selectedDefensiveFilter} 
              onChange={e => setSelectedDefensiveFilter(e.target.value)}
            >
              {defensiveOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Form.Select>
            <FormControl 
              type="text" 
              value={filterNumber} 
              onChange={e => {
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
            <Button variant="outline-primary" onClick={handleAddFilter}>Add</Button>
          </InputGroup>
          <div className="mt-2">
            {activeFilters.map((filter, index) => (
              <Badge key={index} bg="primary" className="me-1 mb-1 p-2">
                {filter.filter} ({filter.number})
                <Button variant="link" size="sm" className="text-light p-0 ms-2" onClick={() => handleRemoveFilter(index)}>×</Button>
              </Badge>
            ))}
          </div>
        </Form.Group>
        <Form.Group className="mb-4">
          <Form.Label>Self Filters:</Form.Label>
          <InputGroup>
            <Form.Select 
              value={selectedSelfFilter} 
              onChange={(e) => handleSelfFilterSelect(e.target.value)}
            >
              <option value="">Select Stat</option>
              {selfFilterColumns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </Form.Select>
            <Button variant="outline-primary" onClick={handleAddSelfFilter}>Add</Button>
          </InputGroup>
          {selectedSelfFilter && columnRanges[selectedSelfFilter] && (
            <div className="mt-2">
              <Form.Label>{selectedSelfFilter}: {selfFilterRange[0].toFixed(1)} - {selfFilterRange[1].toFixed(1)}</Form.Label>
              <ReactSlider
                className="horizontal-slider"
                thumbClassName="thumb"
                trackClassName="track"
                value={selfFilterRange}
                ariaLabel={['Lower thumb', 'Upper thumb']}
                ariaValuetext={state => `Thumb value ${state.valueNow}`}
                renderThumb={(props, state) => <div {...props}>{state.valueNow.toFixed(1)}</div>}
                pearling
                minDistance={0.1}
                step={0.1}
                min={columnRanges[selectedSelfFilter].min}
                max={columnRanges[selectedSelfFilter].max}
                onChange={handleSelfFilterRangeChange}
              />
            </div>
          )}
          <div className="mt-2">
            {activeSelfFilters.map((filter, index) => (
              <Badge key={index} bg="primary" className="me-1 mb-1 p-2">
                {filter.column}: {filter.range[0].toFixed(1)} - {filter.range[1].toFixed(1)}
                <Button variant="link" size="sm" className="text-light p-0 ms-2" onClick={() => handleRemoveSelfFilter(index)}>×</Button>
              </Badge>
            ))}
          </div>
        </Form.Group>
        
        <Button variant="primary" className="w-100" onClick={handleApplyFilters}>Apply Filters</Button>
      </Card.Body>
    </Card>
  );
};

export default FilterOptions;