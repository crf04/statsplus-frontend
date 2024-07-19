import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, ToggleButtonGroup, ToggleButton, Row, Col, Table } from 'react-bootstrap';
import axios from 'axios';
import PlaystyleComparisonChart from './PlaystyleComparisonChart';
import AssistProfileChart from './AssistProfileChart';

const PlayerProfile = ({ selectedPlayer, selectedTeam }) => {
  const [selectedProfile, setSelectedProfile] = useState('playstyles');
  const [playerData, setPlayerData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfileData = useCallback(() => {
    if (selectedPlayer !== 'None') {
      setLoading(true);
      setError(null);

      const playerRequest = axios.get('http://127.0.0.1:5000/api/player_profile', {
        params: { 
          player_name: selectedPlayer,
          category: selectedProfile
        }
      });

      const teamRequest = selectedTeam ? axios.get('http://127.0.0.1:5000/api/team_stats', {
        params: {
          category: selectedProfile === 'playstyles' ? 'Playtypes' : 'Assists',
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
        </Col>
      </Row>

    );
  };

  const renderContent = () => {
    if (loading) {
      return <p>Loading data...</p>;
    }

    if (error) {
      return <p className="text-danger">{error}</p>;
    }

    if (selectedProfile === 'playstyles') {
      if (playerData) {
        return (
          <div style={{ width: '100%', height: '500px' }}>
            <h5 style={{ textAlign: 'center', marginBottom: '20px' }}>{selectedPlayer} vs {selectedTeam || 'All'}</h5>
            <PlaystyleComparisonChart playerData={playerData} teamData={teamData} />
          </div>
        );
      } else {
        return <p>No player data available</p>;
      }
    } else {
      return renderAssistProfile();
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <h4 className="mb-4">Player Profile: {selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1)}</h4>
        <Form.Group className="mb-3">
          <ToggleButtonGroup type="radio" name="profile" value={selectedProfile} onChange={setSelectedProfile}>
            <ToggleButton
              id="tbg-btn-playstyles"
              value="playstyles"
              variant="outline-primary"
            >
              Playstyles
            </ToggleButton>
            <ToggleButton
              id="tbg-btn-assists"
              value="assists"
              variant="outline-primary"
            >
              Assists
            </ToggleButton>
          </ToggleButtonGroup>
        </Form.Group>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default PlayerProfile;