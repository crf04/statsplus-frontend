import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, FormControl, Badge, ToggleButtonGroup, ToggleButton, Table as BSTable } from 'react-bootstrap';
import axios from 'axios';
import RangeSlider from 'react-bootstrap-range-slider';
import 'react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';
import './GameLogFilter.css';
import GameLogsTable from './GameLogsTable'; // Import the GameLogsTable component

Chart.register(annotationPlugin);

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
  const [lineType, setLineType] = useState('None');
  const [lineValue, setLineValue] = useState(0);
  const [gameFilter, setGameFilter] = useState(0);
  const [gameLogs, setGameLogs] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('None');
  const [averages, setAverages] = useState([]);
  const canvasRef = useRef(null);

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
      minutes_filter: minutesFilter.join(','),
      players_on: activePlayersOn,
      players_off: activePlayersOff,
      date_filter: dateFilter || null,
      teams_against: activeFilters.map(filter => filter.filter),
      filter_numbers: activeFilters.map(filter => filter.number),
      location_filter: locationFilter,
      game_filter: gameFilter || null
    };

    axios.get('http://127.0.0.1:5000/api/game_logs', { params })
      .then(response => {
        const { game_logs, averages } = response.data;
        setGameLogs(JSON.parse(game_logs));
        setAverages(JSON.parse(averages));
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

  const handleMinutesFilterChange = (values) => {
    setMinutesFilter(values);
  };

  const getChartData = () => {
    if (gameLogs.length === 0 || lineType === 'None') return null;

    const labels = gameLogs.map(log => log.GAME_DATE);
    const data = gameLogs.map(log => log[lineType]);
    const backgroundColors = data.map(value => {
      if (value > lineValue) return 'rgba(75, 192, 75, 0.6)';
      if (value < lineValue) return 'rgba(192, 75, 75, 0.6)';
      return 'rgba(192, 192, 192, 0.6)';
    });

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

  const ratioTextPlugin = {
    id: 'ratioText',
    afterDraw: (chart) => {
      const { ctx, chartArea: { top, right } } = chart;
      const total = gameLogs.length;
      const aboveLine = gameLogs.filter(log => log[lineType] > lineValue).length;
      const ratioText = `${aboveLine} / ${total} (${((aboveLine / total) * 100).toFixed(2)}%)`;

      ctx.save();
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'right';
      ctx.fillText(ratioText, right - 10, top + 20);
      ctx.restore();
    }
  };

  useEffect(() => {
    const chart = Chart.getChart(canvasRef.current);
    if (chart) {
      chart.options.plugins.ratioText = ratioTextPlugin;
      chart.update();
    }
  }, [lineType, lineValue, ratioTextPlugin]);

  const getChartOptions = () => {
    return {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: lineType,
          }
        }
      },
      plugins: {
        annotation: {
          annotations: lineValue ? {
            line1: {
              type: 'line',
              yMin: lineValue,
              yMax: lineValue,
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
        ratioText: {} // Enable our custom plugin
      }
    };
  };

  const renderAveragesTable = () => {
    if (averages.length === 0) return null;

    return (
      <BSTable striped bordered hover>
        <thead>
          <tr>
            {Object.keys(averages[0]).map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {averages.map((average, index) => (
            <tr key={index}>
              {Object.values(average).map((value, idx) => (
                <td key={idx}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </BSTable>
    );
  };

  return (
    <Container className="mt-4">
      <Row className="mb-4">
        <Col>
          <h2>Game Log Filter</h2>
        </Col>
      </Row>
      <Row className="mb-4">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Player:</Form.Label>
            <Form.Control as="select" value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
              <option value="All">All</option>
              {playerList.map(player => (
                <option key={player} value={player}>{player}</option>
              ))}
            </Form.Control>
          </Form.Group>
          <Form.Group>
            <Form.Label>Minute Filter:</Form.Label>
            <RangeSlider
              value={minutesFilter}
              min={0}
              max={48}
              step={1}
              tooltip="on"
              tooltipLabel={(currentValue) => `${currentValue[0]} - ${currentValue[1]} minutes`}
              onChange={(e) => handleMinutesFilterChange([parseInt(e.target.value[0]), parseInt(e.target.value[1])])}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>On/After Date:</Form.Label>
            <Form.Control type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Last N games:</Form.Label>
            <Form.Control type="number" value={gameFilter} onChange={e => setGameFilter(parseInt(e.target.value))} />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Player ON</Form.Label>
            <InputGroup>
              <Form.Control as="select" value={playerOnInput} onChange={e => setPlayerOnInput(e.target.value)}>
                <option value="">Select Player</option>
                {playerList.map(player => (
                  <option key={player} value={player}>{player}</option>
                ))}
              </Form.Control>
              <Button variant="outline-primary" onClick={handleAddPlayerOn}>Add Player ON</Button>
            </InputGroup>
          </Form.Group>
          <div className="players-container">
            {activePlayersOn.map((player, index) => (
              <Badge key={index} variant="success" pill className="mr-1">
                {player}
                <Button variant="danger" size="sm" onClick={() => handleRemovePlayerOn(index)}>x</Button>
              </Badge>
            ))}
          </div>
          <Form.Group className="mt-3">
            <Form.Label>Player OFF</Form.Label>
            <InputGroup>
              <Form.Control as="select" value={playerOffInput} onChange={e => setPlayerOffInput(e.target.value)}>
                <option value="">Select Player</option>
                {playerList.map(player => (
                  <option key={player} value={player}>{player}</option>
                ))}
              </Form.Control>
              <Button variant="outline-primary" onClick={handleAddPlayerOff}>Add Player OFF</Button>
            </InputGroup>
          </Form.Group>
          <div className="players-container">
            {activePlayersOff.map((player, index) => (
              <Badge key={index} variant="danger" pill className="mr-1">
                {player}
                <Button variant="danger" size="sm" onClick={() => handleRemovePlayerOff(index)}>x</Button>
              </Badge>
            ))}
          </div>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Location:</Form.Label>
            <ToggleButtonGroup type="radio" name="locationOptions" value={locationFilter} onChange={setLocationFilter}>
              <ToggleButton variant="outline-secondary" value="Both">Both</ToggleButton>
              <ToggleButton variant="outline-secondary" value="Home">Home</ToggleButton>
              <ToggleButton variant="outline-secondary" value="Away">Away</ToggleButton>
            </ToggleButtonGroup>
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Defensive Filter</Form.Label>
            <InputGroup>
              <Form.Control as="select" value={selectedDefensiveFilter} onChange={e => setSelectedDefensiveFilter(e.target.value)}>
                {defensiveOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Form.Control>
              <FormControl type="number" value={filterNumber} onChange={e => setFilterNumber(parseInt(e.target.value) || 0)} placeholder="Number" />
              <Button variant="outline-primary" onClick={handleAddFilter}>Add Filter</Button>
            </InputGroup>
          </Form.Group>
          <div className="filters-container mt-3">
            {activeFilters.map((filter, index) => (
              <Badge key={index} variant="primary" pill className="mr-1">
                {filter.filter} ({filter.number})
                <Button variant="danger" size="sm" onClick={() => handleRemoveFilter(index)}>x</Button>
              </Badge>
            ))}
          </div>
          <Button variant="primary" className="mt-3" onClick={fetchGameLogs}>Submit</Button>
        </Col>
      </Row>
      <Row className="mt-4 justify-content-center">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Line Type & Value</Form.Label>
            <InputGroup>
              <Form.Control as="select" value={lineType} onChange={e => setLineType(e.target.value)}>
                {lineTypeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Form.Control>
              <FormControl type="number" value={lineValue} onChange={e => setLineValue(parseFloat(e.target.value) || 0)} placeholder="Value" />
            </InputGroup>
          </Form.Group>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          {lineType !== 'None' && gameLogs.length > 0 && (
            <div>
              <h3>{selectedPlayer} {lineType}</h3>
              <Bar ref={canvasRef} data={getChartData()} options={getChartOptions()} plugins={[ratioTextPlugin]} />
            </div>
          )}
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <GameLogsTable gameLogs={gameLogs} />
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <h3>Averages</h3>
          {renderAveragesTable()}
        </Col>
      </Row>
    </Container>
  );
};

export default GameLogFilter;
