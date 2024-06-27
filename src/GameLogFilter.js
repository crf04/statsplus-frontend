import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, FormControl, Badge, ToggleButtonGroup, ToggleButton, Table as BSTable, Card } from 'react-bootstrap';
import axios from 'axios';
import ReactSlider from 'react-slider';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';
import './GameLogFilter.css';
import GameLogsTable from './GameLogsTable';
import { Pie } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);
Chart.register(annotationPlugin);
Chart.register(ChartDataLabels);

const defensiveOptions = [
  'None', 'C&S 3s', 'C&S PTS', 'PU 2s', 'PU 3s', 'PU PTS', 'Less Than 10 ft', 
  'PRRollMan', 'PRBallHandler', 'Spotup', 'Transition', 'OPP_PTS', 
  'OPP_REB', 'OPP_AST', 'OPP_STOCKS'
];

const lineTypeOptions = [
  'None', 'PTS', 'FG3M', 'FD_PTS', 'PRA', 'PA', 'RA', 'PR', 'AST', 'REB', 'FG3A', 'FTM', 'FGA', 'STKS'
];

const GameLogFilter = () => {
  const [selectedDefensiveFilter, setSelectedDefensiveFilter] = useState('None');
  const [filterNumber, setFilterNumber] = useState(0);
  const [activeFilters, setActiveFilters] = useState([]);
  const [playerOnInput, setPlayerOnInput] = useState('');
  const [activePlayersOn, setActivePlayersOn] = useState([]);
  const [playerOffInput, setPlayerOffInput] = useState('');
  const [activePlayersOff, setActivePlayersOff] = useState([]);
  const [locationFilter, setLocationFilter] = useState('Both');
  const [minutesFilter, setMinutesFilter] = useState([0, 48]);
  const [dateFilter, setDateFilter] = useState('');
  const [lineType, setLineType] = useState(lineTypeOptions[1]); 
  const [lineValue, setLineValue] = useState('');
  const [gameFilter, setGameFilter] = useState(0);
  const [gameLogs, setGameLogs] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('None');
  const [averages, setAverages] = useState([]);
  const [playstyleMatchupRating, setPlaystyleMatchupRating] = useState([75, 125]);
  const chartRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Traditional');
  const [teamStats, setTeamStats] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState([]);
  const [playstyleData, setPlaystyleData] = useState(null);

  const handlePlaystyleMatchupRatingChange = (newRange) => {
    setPlaystyleMatchupRating(newRange);
  };

  const profileOptions = [
    { value: 'playstyles', label: 'Playstyles' },
    // Add more profile options here as needed
  ];

  const fetchPlaystyleData = useCallback(() => {
    if (selectedPlayer && selectedProfile.includes('playstyles')) {
      axios.get('http://127.0.0.1:5000/api/player_playstyles', {
        params: { player_name: selectedPlayer }
      })
      .then(response => {
        setPlaystyleData(response.data);
      })
      .catch(error => {
        console.error('Error fetching playstyle data:', error);
      });
    }
  }, [selectedPlayer, selectedProfile]);

  useEffect(() => {
    fetchPlaystyleData();
  }, [fetchPlaystyleData]);

  const handleProfileChange = (val) => {
    setSelectedProfile(val);
  };

  const renderPlaystyleChart = () => {
    if (!playstyleData) return null;
  
    // Filter out zero values
    const filteredPlaystyleData = Object.entries(playstyleData).filter(([key, value]) => value !== 0  && !isNaN(value));
    const labels = filteredPlaystyleData.map(([key]) => key);
    const data = filteredPlaystyleData.map(([_, value]) => value);
  
    const chartData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
          ],
        },
      ],
    };
  
    const options = {
      plugins: {
        legend: {
          display: false,
        },
        datalabels: {
          color: '#fff',
          formatter: (value, context) => context.chart.data.labels[context.dataIndex],
          font: {
            weight: 'bold'
          }
        }
      }
    };
  
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <div style={{ width: '400px', height: '400px' }}>
        <Pie data={chartData} options={options} />
      </div>
    </div>
    );
  };

  const fetchUnfilteredGameLogs = useCallback(() => {
    if (selectedPlayer === "None") {
      setGameLogs([])
      setAverages([])
    }
    if (selectedPlayer && selectedPlayer !== 'None') {
      axios.get('http://127.0.0.1:5000/api/game_logs', {
        params: {
          player_name: selectedPlayer,
        }
      })
      .then(response => {
        const { game_logs, averages, season_averages } = response.data;
        console.log('Unfiltered averages:', averages);
        console.log('Season averages:', season_averages);
        setGameLogs(JSON.parse(game_logs).reverse());
        setAverages([JSON.parse(averages)[0], JSON.parse(season_averages)[0]]);
      })
      .catch(error => {
        console.error('There was an error fetching the unfiltered game logs!', error);
      });
    }
  }, [selectedPlayer]);
  

  // This effect will run whenever the selected player changes
  useEffect(() => {
    fetchUnfilteredGameLogs();
  }, [fetchUnfilteredGameLogs]);

  useEffect(() => {
    // Fetch the list of teams when the component mounts
    axios.get('http://127.0.0.1:5000/api/get_teams')
      .then(response => {
        setTeams(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the team list!', error);
      });
  }, []);

  const fetchTeamStats = useCallback(() => {
    if (selectedTeam && selectedCategory) {
      axios.get(`http://127.0.0.1:5000/api/team_stats`, {
        params: {
          category: selectedCategory,
          team: selectedTeam
        }
      })
      .then(response => {
        if (response.data && typeof response.data === 'object') {
          setTeamStats(response.data);
        } else {
          console.error('Received invalid data format for team stats');
          setTeamStats(null);
        }
      })
      .catch(error => {
        console.error('There was an error fetching the team stats!', error);
        setTeamStats(null);
      });
    } else {
      setTeamStats(null);
    }
  }, [selectedTeam, selectedCategory]);

  useEffect(() => {
    fetchTeamStats();
  }, [fetchTeamStats]);

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/players')
      .then(response => {
        setPlayerList(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the player list!', error);
      });
  }, []);

  const fetchGameLogs = () => {
    const params = {
      player_name: selectedPlayer,
      minutes_filter: `${minutesFilter[0]},${minutesFilter[1]}`,
      players_on: activePlayersOn,
      players_off: activePlayersOff,
      date_filter: dateFilter || null,
      teams_against: activeFilters.map(filter => filter.filter),
      filter_numbers: activeFilters.map(filter => filter.number),
      location_filter: locationFilter,
      game_filter: gameFilter || null,
      playstyle_RTG_min: playstyleMatchupRating[0],
      playstyle_RTG_max: playstyleMatchupRating[1]
    };
  
    axios.get('http://127.0.0.1:5000/api/game_logs', { params })
  .then(response => {
    const { game_logs, averages, season_averages } = response.data;
    console.log('Filtered averages:', averages);
    console.log('Season averages:', season_averages);
    setGameLogs(JSON.parse(game_logs).reverse());
    setAverages([JSON.parse(averages)[0], JSON.parse(season_averages)[0]]);
    if (lineType === 'None' && game_logs.length > 0) {
      setLineType(lineTypeOptions[1]);
    }
  })
  .catch(error => {
    console.error('There was an error fetching the game logs!', error);
  });
};

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

  const handleAddPlayerOn = () => {
    if (playerOnInput && !activePlayersOn.includes(playerOnInput)) {
      setActivePlayersOn([...activePlayersOn, playerOnInput]);
      setPlayerOnInput('');
    }
  };

  const handleRemovePlayerOn = (index) => {
    setActivePlayersOn(activePlayersOn.filter((_, i) => i !== index));
  };

  const handleAddPlayerOff = () => {
    if (playerOffInput && !activePlayersOff.includes(playerOffInput)) {
      setActivePlayersOff([...activePlayersOff, playerOffInput]);
      setPlayerOffInput('');
    }
  };

  const handleRemovePlayerOff = (index) => {
    setActivePlayersOff(activePlayersOff.filter((_, i) => i !== index));
  };

  const handleLocationChange = (val) => {
    setLocationFilter(val);
  };

  const handleMinutesFilterChange = (newValues) => {
    setMinutesFilter(newValues);
  };

  const handleLineValueChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(parseFloat(value)) && isFinite(value))) {
      setLineValue(value);
    }
  };

  const getChartData = () => {
    if (!gameLogs || gameLogs.length === 0 || lineType === 'None') {
      return {
        labels: [],
        datasets: [{
          label: 'No data',
          data: [],
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        }]
      };
    }
  
    const labels = gameLogs.map(log => log?.GAME_DATE || '');
    const data = gameLogs.map(log => log?.[lineType] || 0);
    const numericLineValue = parseFloat(lineValue);
    const backgroundColors = !isNaN(numericLineValue) 
      ? data.map(value => value > numericLineValue ? 'rgba(75, 192, 75, 0.6)' : 'rgba(192, 75, 75, 0.6)')
      : 'rgba(75, 192, 192, 0.6)';
  
    return {
      labels,
      datasets: [
        {
          label: lineType,
          data,
          backgroundColor: backgroundColors,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }
      ]
    };
  };
  
  
  const getChartOptions = () => {
    const numericLineValue = parseFloat(lineValue);
    let ratioText = '';
    if (!isNaN(numericLineValue) && gameLogs.length > 0) {
      const total = gameLogs.length;
      const aboveLine = gameLogs.filter(log => log[lineType] > numericLineValue).length;
      ratioText = `${aboveLine} / ${total} (${((aboveLine / total) * 100).toFixed(2)}%)`;
    }
  
    return {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: ratioText,
          position: 'top',
          align: 'end',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        annotation: {
          annotations: !isNaN(numericLineValue) ? {
            line1: {
              type: 'line',
              yMin: numericLineValue,
              yMax: numericLineValue,
              borderColor: 'rgb(255, 99, 132)',
              borderWidth: 2,
              label: {
                content: `Line Value: ${lineValue}`,
                enabled: true,
                position: 'start'
              }
            }
          } : {}
        },
        datalabels: {
          display: false, // Disable data labels for this chart
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: lineType,
          }
        }
      }
    };
  };


  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [lineType, lineValue, gameLogs]);

  const renderAveragesTable = () => {
    console.log('Averages state:', averages);
  
    if (!Array.isArray(averages) || averages.length !== 2) {
      console.log('Averages is not an array of length 2');
      return <p>No averages data available.</p>;
    }
  
    const [filteredAvg, seasonAvg] = averages;
  
    console.log('Filtered averages:', filteredAvg);
    console.log('Season averages:', seasonAvg);
  
    if (!filteredAvg || !seasonAvg) {
      console.log('filteredAvg or seasonAvg is undefined');
      return <p>Incomplete averages data.</p>;
    }
  
    const calculatePer36 = (stat, minutes) => {
      if (typeof stat !== 'number' || typeof minutes !== 'number' || minutes === 0) {
        return stat;
      }
      return (stat / minutes) * 36;
    };
  
    const per36Filtered = {};
    const per36Season = {};
    for (let key in filteredAvg) {
      if (key !== 'MIN') {
        per36Filtered[key] = calculatePer36(filteredAvg[key], filteredAvg['MIN']);
        per36Season[key] = calculatePer36(seasonAvg[key], seasonAvg['MIN']);
      } else {
        per36Filtered[key] = 36;
        per36Season[key] = 36;
      }
    }
  
    const renderTable = (rawFiltered, rawSeason, per36Filtered, per36Season) => {
      const stats = Object.keys(rawFiltered);
      return (
        <BSTable striped bordered hover responsive>
          <thead>
            <tr>
              <th>Average Type</th>
              {stats.map(stat => <th key={stat}>{stat}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Filtered Raw</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof rawFiltered[stat] === 'number' ? rawFiltered[stat].toFixed(2) : rawFiltered[stat]}
                </td>
              ))}
            </tr>
            <tr>
              <td>Season Raw</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof rawSeason[stat] === 'number' ? rawSeason[stat].toFixed(2) : rawSeason[stat]}
                </td>
              ))}
            </tr>
            <tr>
              <td>Filtered Per 36</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof per36Filtered[stat] === 'number' ? per36Filtered[stat].toFixed(2) : per36Filtered[stat]}
                </td>
              ))}
            </tr>
            <tr>
              <td>Season Per 36</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof per36Season[stat] === 'number' ? per36Season[stat].toFixed(2) : per36Season[stat]}
                </td>
              ))}
            </tr>
          </tbody>
        </BSTable>
      );
    };
  
    return (
      <>
        <h4>Player Averages</h4>
        {renderTable(filteredAvg, seasonAvg, per36Filtered, per36Season)}
      </>
    );
  };

  const RankCube = ({ rank }) => {
    const getColorForRank = (rank) => {
      const normalizedRank = (rank - 1) / 29; // Normalize rank to 0-1 range
      const red = Math.round(255 * (1 - normalizedRank));
      const green = Math.round(255 * normalizedRank);
      return `rgb(${red}, ${green}, 0)`;
    };
  
    const cubeStyle = {
      width: '30px',
      height: '30px',
      backgroundColor: getColorForRank(rank),
      color: rank > 15 ? 'black' : 'white',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontWeight: 'bold',
      borderRadius: '4px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      marginLeft: '10px',
    };
  
    return <div style={cubeStyle}>{rank}</div>;
  };

  const renderTeamStats = () => {
    if (!teamStats) return <p>Select a team and category to view stats.</p>;
  
    let statColumns;
    if (selectedCategory === 'Traditional') {
      statColumns = [
        'OPP_PTS', 'OPP_FGM', 'OPP_FGA', 'OPP_FG_PCT', 'OPP_FG3M', 'OPP_FG3A', 'OPP_FG3_PCT',
         'OPP_FTA', 'OPP_OREB', 'OPP_DREB', 'OPP_REB',
        'OPP_AST', 'OPP_TOV', 'OPP_STL', 'OPP_BLK', 'OPP_STL+BLK'
      ];
    } else if (selectedCategory === 'Playtypes') {
      statColumns = Object.keys(teamStats).filter(key => !key.includes('RANK') && !key.includes('TEAM'));
    }
  
    const renderStatRow = (stat) => {
      const value = teamStats[stat] !== undefined ? Number(teamStats[stat]).toFixed(2) : 'N/A';
      const rank = teamStats[`${stat}_RANK`] !== undefined ? teamStats[`${stat}_RANK`] : 'N/A';
    
      return (
        <tr key={stat}>
          <td>{stat.replace('OPP_', '').replace('_', ' ')}</td>
          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span>{value}</span>
              {rank !== 'N/A' && <RankCube rank={rank} />}
            </div>
          </td>
        </tr>
      );
    };
    
    const halfLength = Math.ceil(statColumns.length / 2);
    const leftColumnStats = statColumns.slice(0, halfLength);
    const rightColumnStats = statColumns.slice(halfLength);
    
    return (
      <Row>
        <Col md={6}>
          <BSTable striped bordered hover size="sm">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Value (Rank)</th>
              </tr>
            </thead>
            <tbody>
              {leftColumnStats.map(renderStatRow)}
            </tbody>
          </BSTable>
        </Col>
        <Col md={6}>
          <BSTable striped bordered hover size="sm">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Value (Rank)</th>
              </tr>
            </thead>
            <tbody>
              {rightColumnStats.map(renderStatRow)}
            </tbody>
          </BSTable>
        </Col>
      </Row>
    );
  };

  return (
    <Container fluid className="game-log-filter py-5">

<Row className="mb-5">
      <Col md={8}>
        <Card className="shadow-sm">
          <Card.Body>
            <Row className="mb-4">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Select Player:</Form.Label>
                  <Form.Select 
                    value={selectedPlayer} 
                    onChange={e => setSelectedPlayer(e.target.value)}
                  >
                    <option value="None">None</option>
                    {playerList.map(player => (
                      <option key={player} value={player}>{player}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Line Type:</Form.Label>
                  <Form.Select 
                    value={lineType} 
                    onChange={e => setLineType(e.target.value)}
                  >
                    {lineTypeOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Line Value:</Form.Label>
                  <FormControl
                    type="text"
                    value={lineValue}
                    onChange={handleLineValueChange}
                    placeholder="Enter value"
                  />
                </Form.Group>
              </Col>
            </Row>
            {gameLogs.length > 0 && lineType !== 'None' && (
              <>
                <h3 className="text-center mb-4">{selectedPlayer} {lineType}</h3>
                <Bar 
                  ref={chartRef}
                  data={getChartData()} 
                  options={getChartOptions()} 
                />
              </>
            )}
          </Card.Body>
        </Card>
      </Col>

        {/* Right Column: Filtering Options */}
        <Col md={4}>
          <Card className="shadow-sm">
            <Card.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-4">
                    <Form.Label>Player ON:</Form.Label>
                    <InputGroup>
                      <Form.Select value={playerOnInput} onChange={e => setPlayerOnInput(e.target.value)}>
                        <option value="">Select Player</option>
                        {playerList.map(player => (
                          <option key={player} value={player}>{player}</option>
                        ))}
                      </Form.Select>
                      <Button variant="outline-primary" onClick={handleAddPlayerOn}>Add</Button>
                    </InputGroup>
                    <div className="mt-2">
                      {activePlayersOn.map((player, index) => (
                        <Badge key={index} bg="success" className="me-1 mb-1 p-2">
                          {player}
                          <Button variant="link" size="sm" className="text-light p-0 ms-2" onClick={() => handleRemovePlayerOn(index)}>×</Button>
                        </Badge>
                      ))}
                    </div>
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label>Date Filter:</Form.Label>
                    <Form.Control type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label>Location:</Form.Label>
                    <ToggleButtonGroup type="radio" name="locationOptions" value={locationFilter} onChange={handleLocationChange} className="w-100">
                      <ToggleButton id="tbg-radio-1" variant="outline-primary" value="Both" className="w-100">Both</ToggleButton>
                      <ToggleButton id="tbg-radio-2" variant="outline-primary" value="Home" className="w-100">Home</ToggleButton>
                      <ToggleButton id="tbg-radio-3" variant="outline-primary" value="Away" className="w-100">Away</ToggleButton>
                    </ToggleButtonGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-4">
                    <Form.Label>Player OFF:</Form.Label>
                    <InputGroup>
                      <Form.Select value={playerOffInput} onChange={e => setPlayerOffInput(e.target.value)}>
                        <option value="">Select Player</option>
                        {playerList.map(player => (
                          <option key={player} value={player}>{player}</option>
                        ))}
                      </Form.Select>
                      <Button variant="outline-primary" onClick={handleAddPlayerOff}>Add</Button>
                    </InputGroup>
                    <div className="mt-2">
                      {activePlayersOff.map((player, index) => (
                        <Badge key={index} bg="danger" className="me-1 mb-1 p-2">
                          {player}
                          <Button variant="link" size="sm" className="text-light p-0 ms-2" onClick={() => handleRemovePlayerOff(index)}>×</Button>
                        </Badge>
                      ))}
                    </div>
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label>Last N games:</Form.Label>
                    <Form.Control type="number" value={gameFilter} onChange={e => setGameFilter(parseInt(e.target.value))} />
                  </Form.Group>
                  <Form.Group className="mb-4">
                <Form.Label>Playstyle Matchup Rating: {playstyleMatchupRating[0]} - {playstyleMatchupRating[1]}</Form.Label>
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
                  defaultValue={[0, 48]}
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
                  <Form.Select value={selectedDefensiveFilter} onChange={e => setSelectedDefensiveFilter(e.target.value)}>
                    {defensiveOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Form.Select>
                  <FormControl type="number" value={filterNumber} onChange={e => setFilterNumber(parseInt(e.target.value) || 0)} placeholder="Number" />
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
              <Button variant="primary" className="w-100" onClick={fetchGameLogs}>Apply Filters</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Player Profile and Opposing Team Profile */}
      <Row className="mb-5">
        <Col md={6}>
          <Card className="shadow-sm">
            <Card.Body>
              <h4 className="mb-4">Player Profile</h4>
              <Form.Group className="mb-3">
                <ToggleButtonGroup type="checkbox" value={selectedProfile} onChange={handleProfileChange}>
                  {profileOptions.map((option) => (
                    <ToggleButton
                      key={option.value}
                      id={`tbg-btn-${option.value}`}
                      value={option.value}
                      variant="outline-primary"
                    >
                      {option.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Form.Group>
              {selectedProfile.includes('playstyles') && renderPlaystyleChart()}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm">
            <Card.Body>
              <h4 className="mb-4">Opposing Team Profile</h4>
              <Form.Group className="mb-3">
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Form.Select 
                    value={selectedTeam} 
                    onChange={e => setSelectedTeam(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Choose a team</option>
                    {teams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </Form.Select>
                  <Form.Select 
                    value={selectedCategory} 
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="Traditional">Traditional</option>
                    <option value="Playtypes">Playtypes</option>
                    {/* Add more categories if needed */}
                  </Form.Select>
                </div>
              </Form.Group>
              {renderTeamStats()}
            </Card.Body>
          </Card>
        </Col>
      </Row>


      {/* Performance Averages */}
      <Row>
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="table-responsive">
                {renderAveragesTable()}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Game Logs */}
      <Row className="mb-5">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <h3 className="text-center mb-4">Game Logs</h3>
              <GameLogsTable gameLogs={gameLogs} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      
    </Container>
  );
};

export default GameLogFilter;