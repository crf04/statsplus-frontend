import React, { useState, useEffect, useCallback } from 'react';

import { Card, Form, ToggleButtonGroup, ToggleButton, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import PlaystyleComparisonChart from './PlaystyleComparisonChart';
import AssistProfileChart from './AssistProfileChart';
import TwoThreeAssistChart from './TwoThreeAssistChart';
import ArchetypeGameLogs from './ArchetypeGameLogs';

const PlayerProfile = ({ selectedPlayer, selectedTeam }) => {
  const [selectedProfile, setSelectedProfile] = useState('Playtypes');
  const [playerData, setPlayerData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfileData = useCallback(() => {
    if (selectedPlayer !== 'None') {
      setLoading(true);
      setError(null);

      const playerRequest = axios.get('http://127.0.0.1:5000/api/players/profile', {
        params: { 
          player_name: selectedPlayer,
          category: selectedProfile,
          opp_team: selectedTeam
        }
      });

      const teamRequest = selectedTeam ? axios.get('http://127.0.0.1:5000/api/teams/stats', {
        params: {
          category: selectedProfile === 'Playtypes' ? 'Playtypes' : 'Assists',
          team: selectedTeam
        }
      }) : Promise.resolve({ data: null });

      Promise.all([playerRequest, teamRequest])
        .then(([playerResponse, teamResponse]) => {
          if (playerResponse.data && Object.keys(playerResponse.data).length > 0) {
            setPlayerData(playerResponse.data);
          } else {
            setError('No data available for this player');
          }

          if (teamResponse.data && Object.keys(teamResponse.data).length > 0) {
            setTeamData(teamResponse.data);
          } else if (selectedTeam) {
            setError(prevError => prevError ? `${prevError}. No data available for this team` : 'No data available for this team');
          }
        })
        .catch(error => {
          console.error('Error fetching data:', error);
          setError('Failed to fetch data. Please try again.');
        })
        .finally(() => {
          setLoading(false);
          if (!selectedTeam) {
            setTeamData(null);
          }
        });
    } else {
      setPlayerData(null);
      setTeamData(null);
    }
  }, [selectedPlayer, selectedTeam, selectedProfile]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const renderAssistProfile = () => {
    if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
      return <p>No assist data available</p>;
    }

    const assistData = playerData[0];

    return (
      <Row>
        <Col md={12}>
          <h5>{selectedPlayer}'s Assist Profile vs {selectedTeam || 'All'}</h5>
          <AssistProfileChart assistData={assistData} teamData={teamData} />
          <TwoThreeAssistChart assistData={assistData} teamData={teamData} />
        </Col>
      </Row>
    );
  };

  const renderZoneShootingProfile = () => {
    if (!playerData) {
      return <p>No zone shooting data available</p>;
    }
    console.log(playerData);
    const zoneData = playerData;

    const zones = [
      "Above the Break 3",
      "In The Paint (Non-RA)",
      "Left Corner 3",
      "Mid-Range",
      "Restricted Area",
      "Right Corner 3"
    ];

    const sortedZones = zones.sort((a, b) => (zoneData[`${b}_PTS`] || 0) - (zoneData[`${a}_PTS`] || 0));

    return (
      <table className="table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>FGA</th>
            <th>FGM</th>
            <th>FG%</th>
            <th>PTS</th>
            <th>PTS%</th>
            <th>PTS%+</th>
          </tr>
        </thead>
        <tbody>
          {sortedZones.map((zone, index) => (
            <tr key={index}>
              <td>{zone}</td>
              <td>{zoneData[`${zone}_FGA`]}</td>
              <td>{zoneData[`${zone}_FGM`]}</td>
              <td>{(zoneData[`${zone}_FG_PCT`] * 100).toFixed(1)}%</td>
              <td>{zoneData[`${zone}_PTS`] ? zoneData[`${zone}_PTS`].toFixed(2) : 'N/A'}</td>
              <td>{zoneData[`${zone}_PTS%`] ? zoneData[`${zone}_PTS%`].toFixed(2) : 'N/A'}%</td>
              <td>{zoneData[`${zone}_PTS%+`] ? zoneData[`${zone}_PTS%+`].toFixed(2) : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderShootingTypeProfile = () => {
    // Ensure playerData is an array of objects
    if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
      return <p>No shooting type data available</p>;
    }
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Shot Type</th>
            <th>FG2A</th>
            <th>FG2A Frequency</th>
            <th>FG2M</th>
            <th>FG2%</th>
            <th>FG3A</th>
            <th>FG3A Frequency</th>
            <th>FG3M</th>
            <th>FG3%</th>
            <th>FGA</th>
            <th>FGA Frequency</th>
            <th>FGM</th>
            <th>FG%</th>
          </tr>
        </thead>
        <tbody>
          {playerData.map((item, index) => (
            <tr key={index}>
              <td>{item.SHOT_TYPE}</td>
              <td>{item.FG2A}</td>
              <td>{item.FG2A_FREQUENCY}</td>
              <td>{item.FG2M}</td>
              <td>{item.FG2_PCT}</td>
              <td>{item.FG3A}</td>
              <td>{item.FG3A_FREQUENCY}</td>
              <td>{item.FG3M}</td>
              <td>{item.FG3_PCT}</td>
              <td>{item.FGA}</td>
              <td>{item.FGA_FREQUENCY}</td>
              <td>{item.FGM}</td>
              <td>{item.FG_PCT}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  
  const renderContent = () => {
    if (loading) {
      return <p>Loading data...</p>;
    }
  
    if (error) {
      return <p className="text-danger">{error}</p>;
    }
  
    switch (selectedProfile) {
      case 'Playtypes':
        return playerData ? (
          <div style={{ width: '100%', height: '500px' }}>
            <h5 style={{ textAlign: 'center', marginBottom: '20px' }}>{selectedPlayer} vs {selectedTeam || 'All'}</h5>
            <PlaystyleComparisonChart playerData={playerData} teamData={teamData} />
          </div>
        ) : <p>No player data available</p>;
      case 'assists':
        return renderAssistProfile();
      case 'Archetype':
        return playerData ? (
          <ArchetypeGameLogs 
            selectedPlayer={selectedPlayer} 
            selectedTeam={selectedTeam}
            gameLogs={playerData}
          />
        ) : <p>No archetype data available</p>;
      case 'Shooting Type':
        return renderShootingTypeProfile();
      case 'Zone Shooting':
        return renderZoneShootingProfile();
      default:
        return <p>Select a profile type</p>;
    }
  };
  const handleSelectedProfile = (profile) => {
    setSelectedProfile(profile);
  }

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <h4 className="mb-4">Player Profile: {selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1)}</h4>
        <Form.Group className="mb-3">
          <ToggleButtonGroup type="radio" name="profile" value={selectedProfile} onChange={handleSelectedProfile}>
            <ToggleButton
              id="tbg-btn-playstyles"
              value="Playtypes"
              variant="outline-primary"
            >
              Playtypes
            </ToggleButton>
            <ToggleButton
              id="tbg-btn-assists"
              value="assists"
              variant="outline-primary"
            >
              Assists
            </ToggleButton>
            <ToggleButton
              id="tbg-btn-archetype"
              value="Archetype"
              variant="outline-primary"
            >
              Archetype
            </ToggleButton>
            <ToggleButton
              id="tbg-btn-shooting-type"
              value="Shooting Type"
              variant="outline-primary"
            >
              Shooting Type
            </ToggleButton>
            <ToggleButton
              id="tbg-btn-zone-shooting"
              value="Zone Shooting"
              variant="outline-primary"
            >
              Zone Shooting
            </ToggleButton>
          </ToggleButtonGroup>
        </Form.Group>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default PlayerProfile;