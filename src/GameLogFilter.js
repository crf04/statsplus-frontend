import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import axios from 'axios';
import './GameLogFilter.css';
import PlayerSelector from './PlayerSelector';
import FilterOptions from './FilterOptions';
import PlayerProfile from './PlayerProfile';
import OpposingTeamProfile from './OpposingTeamProfile';
import PerformanceAverages from './PerformanceAverages';
import ChartComponent from './ChartComponent';
import GameLogsTable from './GameLogsTable';
import { fetchUnfilteredGameLogs, fetchGameLogs } from './utils';

const GameLogFilter = () => {
  const [selectedPlayer, setSelectedPlayer] = useState('None');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  const [gameLogs, setGameLogs] = useState([]);
  const [averages, setAverages] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [initialGameLogs, setInitialGameLogs] = useState([]);

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/players')
      .then(response => setPlayerList(response.data))
      .catch(error => console.error('Error fetching player list:', error));

    axios.get('http://127.0.0.1:5000/api/get_teams')
      .then(response => setTeams(response.data))
      .catch(error => console.error('Error fetching team list:', error));
  }, []);

  useEffect(() => {
    fetchUnfilteredGameLogs(selectedPlayer, setGameLogs, setAverages, setInitialGameLogs, setSelectedTeam);
  }, [selectedPlayer]);

  const handleApplyFilters = (filterParams) => {
    const cleanedFilters = Object.fromEntries(
      Object.entries(filterParams).filter(([_, value]) => 
        value !== null && value !== '' && 
        !(Array.isArray(value) && value.length === 0)
      )
    );
    setAppliedFilters(cleanedFilters);
    fetchGameLogs(cleanedFilters, setGameLogs, setAverages);
  };

  return (
    <Container fluid className="game-log-filter py-5">
      <Row className="mb-5">
        <Col md={8}>
          <Card className="shadow-sm">
            <Card.Body>
              <PlayerSelector
                selectedPlayer={selectedPlayer}
                setSelectedPlayer={setSelectedPlayer}
                lineType={lineType}
                setLineType={setLineType}
                lineValue={lineValue}
                setLineValue={setLineValue}
                playerList={playerList}
              />
              <ChartComponent
                gameLogs={gameLogs}
                lineType={lineType}
                lineValue={lineValue}
                selectedPlayer={selectedPlayer}
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
            gameLogs={gameLogs}
            initialGameLogs={initialGameLogs}
          />
        </Col>
      </Row>
      
      <Row className="mb-5">
        <Col md={6}>
          <PlayerProfile 
            selectedPlayer={selectedPlayer} 
            selectedTeam={selectedTeam} 
          />
        </Col>
        <Col md={6}>
          <OpposingTeamProfile 
            teams={teams} 
            selectedTeam={selectedTeam}
            setSelectedTeam={setSelectedTeam}
          />
        </Col>
      </Row>

      <PerformanceAverages averages={averages} />

      <Row className="mb-5">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <h1 className="text-center mb-4">Game Logs</h1>
              <GameLogsTable gameLogs={gameLogs} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default GameLogFilter;