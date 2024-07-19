import React, { useState } from 'react';
import { Row, Col, Form, FormControl, ListGroup } from 'react-bootstrap';
import { lineTypeOptions } from './utils';
import './PlayerSelector.css'; // Import the CSS file

const PlayerSelector = ({ selectedPlayer, setSelectedPlayer, lineType, setLineType, lineValue, setLineValue, playerList }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);

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
    <Row className="mb-4">
      <Col md={4} className="position-relative">
        <Form.Group>
          <Form.Label>Select Player:</Form.Label>
          <FormControl
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search for a player"
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
  );
};

export default PlayerSelector;
