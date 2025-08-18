import React, { useState, useEffect, useCallback } from 'react';

import { Card, ToggleButtonGroup, ToggleButton, Row, Col } from 'react-bootstrap';
import { apiClient, getApiUrl } from './config';
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

      const playerRequest = apiClient.get(getApiUrl('PLAYER_PROFILE'), {
        params: { 
          player_name: selectedPlayer,
          category: selectedProfile,
          opp_team: selectedTeam
        }
      });

      const teamRequest = selectedTeam ? apiClient.get(getApiUrl('TEAM_STATS'), {
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
          <h6 className="subcategory-heading no-border">{selectedPlayer}'s Assist Profile vs {selectedTeam || 'All'}</h6>
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
      <table className="table table-hover">
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
      <table className="table table-hover">
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
            <h6 className="subcategory-heading no-border">{selectedPlayer} vs {selectedTeam || 'All'}</h6>
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
            <Card className="dark-card">
      <Card.Body>
        <h4 className="mb-2">Player Profile</h4>
        <div className="category-toggles-wrapper">
          <ToggleButtonGroup 
            type="radio" 
            name="player-profile" 
            value={selectedProfile} 
            onChange={handleSelectedProfile}
            className="per36-toggle-group"
          >
            <ToggleButton
              id="profile-playtypes"
              value="Playtypes"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Playtypes
            </ToggleButton>
            <ToggleButton
              id="profile-assists"
              value="assists"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Assists
            </ToggleButton>
            <ToggleButton
              id="profile-archetype"
              value="Archetype"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Archetype
            </ToggleButton>
            <ToggleButton
              id="profile-shooting-type"
              value="Shooting Type"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Shooting Type
            </ToggleButton>
            <ToggleButton
              id="profile-zone-shooting"
              value="Zone Shooting"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Zone Shooting
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default PlayerProfile;