import React, { useState, useEffect } from 'react';
import { Row, Col, Form, FormControl, ListGroup } from 'react-bootstrap';
import { lineTypeOptions } from './utils';
import './PlayerSelector.css'; // Import the CSS file

const PlayerSelector = ({ selectedPlayer, setSelectedPlayer, lineType, setLineType, lineValue, setLineValue, playerList, averages }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // Update search term when selectedPlayer changes (from natural language query)
  useEffect(() => {
    if (selectedPlayer) {
      setSearchTerm(selectedPlayer);
    } else {
      setSearchTerm('');
    }
  }, [selectedPlayer]);

  // Auto-populate lineValue with average when lineType changes or averages are available
  useEffect(() => {
    if (averages && averages[0] && averages[0][lineType]) {
      const avgValue = averages[0][lineType];
      if (avgValue && !isNaN(avgValue)) {
        setLineValue(avgValue.toFixed(1));
      }
    }
  }, [lineType, averages, setLineValue]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.length > 0) {
      const filteredPlayers = playerList
        .filter(player => player.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 3); // Limit to 3 suggestions
      setSuggestions(filteredPlayers);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (player) => {
    setSelectedPlayer(player);
    setSearchTerm(player);
    setSuggestions([]);
  };

  const handleLineValueChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(parseFloat(value)) && isFinite(value))) {
      setLineValue(value);
    }
  };

  return (
    <Row className="mb-4 player-selector-row">
      <Col md={4} className="position-relative">
        <Form.Group>
          <Form.Label className="player-selector-label">Player:</Form.Label>
          <FormControl
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search for a player"
            className="player-selector-input"
          />
          {suggestions.length > 0 && (
            <ListGroup className="suggestions-list">
              {suggestions.map(player => (
                <ListGroup.Item 
                  key={player} 
                  onClick={() => handleSuggestionClick(player)}
                  style={{ cursor: 'pointer' }}
                >
                  {player}
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Form.Group>
      </Col>
      <Col md={4}>
        <Form.Group>
          <Form.Label className="player-selector-label">Line Type:</Form.Label>
          <Form.Select 
            value={lineType} 
            onChange={e => {
              const newLineType = e.target.value;
              setLineType(newLineType);
              // Auto-populate with average for the new line type
              if (averages && averages[0] && averages[0][newLineType]) {
                const avgValue = Math.round(averages[0][newLineType] * 2) / 2;
                if (avgValue && !isNaN(avgValue)) {
                  setLineValue(avgValue.toFixed(1));
                }
              }
            }}
            className="player-selector-select"
          >
            {lineTypeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col md={4}>
        <Form.Group>
          <Form.Label className="player-selector-label">Line Value:</Form.Label>
          <FormControl
            type="text"
            value={lineValue}
            onChange={handleLineValueChange}
            placeholder="Enter value"
            className="player-selector-input"
          />
        </Form.Group>
      </Col>
    </Row>
  );
};

export default PlayerSelector;
