import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Form, Row, Col } from 'react-bootstrap';
import { apiClient } from './config';
import { getApiUrl } from './config';
import OpponentBars from './opponentProfile/OpponentBars';
import { opponentReadings } from './opponentProfile/opponentReadings';

const OpposingTeamProfile = ({ teams, selectedTeam, setSelectedTeam, onSettled }) => {
  const [selectedCategory, setSelectedCategory] = useState('Traditional');
  const [teamStats, setTeamStats] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [debouncedDateFilter, setDebouncedDateFilter] = useState('');
  const dateTimeoutRef = useRef(null);
  const requestIdRef = useRef(0);
  // The read last finished for, so "settled" is judged against the current
  // inputs rather than whatever was on screen before them.
  const [settledFor, setSettledFor] = useState(null);
  const readKey = selectedTeam
    ? `${selectedTeam}|${selectedCategory}|${debouncedDateFilter}`
    : null;
  const settled = !readKey || settledFor === readKey;

  useEffect(() => {
    // Unsettled is reported too, so readiness from an earlier read of the same
    // opponent cannot stand in for the one now in flight.
    onSettled?.(settled ? selectedTeam : null);
  }, [settled, selectedTeam, onSettled]);
  // Unmounted, it has settled for nothing; a remount must answer again.
  useEffect(() => () => onSettled?.(null), [onSettled]);

  const fetchTeamStats = useCallback(
    (signal) => {
      const requestId = ++requestIdRef.current;
      setSettledFor(null);

      if (selectedTeam && selectedCategory) {
        const endpoint = getApiUrl('TEAM_STATS');
        apiClient
          .get(endpoint, {
            params: {
              category: selectedCategory,
              team: selectedTeam,
              date: debouncedDateFilter || null,
            },
            signal,
          })
          .then((response) => {
            if (requestId !== requestIdRef.current) return;
            if (response.data) {
              setTeamStats(response.data);
            } else {
              console.error('Received invalid data format for team stats');
              setTeamStats(null);
            }
            setSettledFor(readKey);
          })
          .catch((error) => {
            if (signal?.aborted || requestId !== requestIdRef.current) return;
            console.error(
              'There was an error fetching the team stats:',
              error.response?.status || error.message,
            );
            setTeamStats(null);
            setSettledFor(readKey);
          });
      } else {
        setTeamStats(null);
      }
    },
    [selectedTeam, selectedCategory, debouncedDateFilter, readKey],
  );

  useEffect(() => {
    // Abort a superseded request so quick team changes do not leave stale
    // stats requests running.
    const controller = new AbortController();
    fetchTeamStats(controller.signal);
    return () => controller.abort();
  }, [fetchTeamStats]);

  useEffect(() => {
    if (dateTimeoutRef.current) {
      clearTimeout(dateTimeoutRef.current);
    }
    dateTimeoutRef.current = setTimeout(() => {
      setDebouncedDateFilter(dateFilter);
    }, 700);

    return () => {
      if (dateTimeoutRef.current) {
        clearTimeout(dateTimeoutRef.current);
      }
    };
  }, [dateFilter]);

  const handleDateChange = (e) => {
    setDateFilter(e.target.value);
  };

  const handleTeamChange = (e) => {
    setSelectedTeam(e.target.value);
  };

  const renderTeamStats = () => {
    if (!teamStats) return <p>Select a team and category to view stats.</p>;
    const groups = opponentReadings(selectedCategory, teamStats);
    if (groups.length === 0) return <p>No data available for {selectedCategory} stats.</p>;
    return <OpponentBars groups={groups} />;
  };

  return (
    <Card className="dark-card">
      <Card.Body>
        <h4 className="mb-4">Opposing Team Profile</h4>
        <Form>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Select value={selectedTeam} onChange={handleTeamChange}>
                  <option value="">Choose a team</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="Traditional">Traditional</option>
                  <option value="Playtypes">Playtypes</option>
                  <option value="Assists">Assists</option>
                  <option value="Zone Shooting">Zone Shooting</option>
                  <option value="Shooting Type">Shooting Type</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Control type="date" value={dateFilter} onChange={handleDateChange} />
              </Form.Group>
            </Col>
          </Row>
        </Form>
        {renderTeamStats()}
      </Card.Body>
    </Card>
  );
};

export default OpposingTeamProfile;
