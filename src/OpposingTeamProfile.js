import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Row, Col, Table as BSTable } from 'react-bootstrap';
import axios from 'axios';
import { RankCube } from './utils';

const OpposingTeamProfile = ({ teams, selectedTeam, setSelectedTeam }) => {
  const [selectedCategory, setSelectedCategory] = useState('Traditional');
  const [teamStats, setTeamStats] = useState(null);

  const fetchTeamStats = useCallback(() => {
    if (selectedTeam && selectedCategory) {
      let endpoint = 'http://127.0.0.1:5000/api/team_stats';
      axios.get(endpoint, {
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
    } else if (selectedCategory === 'Assists') {
      statColumns = ["Assists","AssistPoints", "TwoPtAssists","ThreePtAssists","Arc3Assists","Corner3Assists","AtRimAssists","ShortMidRangeAssists","LongMidRangeAssists"];
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
              <option value="Assists">Assists</option>
            </Form.Select>
          </div>
        </Form.Group>
        {renderTeamStats()}
      </Card.Body>
    </Card>
  );
};

export default OpposingTeamProfile;