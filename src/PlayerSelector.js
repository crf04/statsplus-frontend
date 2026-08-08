import { useState, useEffect } from 'react';
import { Row, Col, Form, FormControl, ListGroup } from 'react-bootstrap';
import { lineTypeOptions } from './utils';
import './PlayerSelector.css'; // Import the CSS file
import { formatNumber, toFiniteNumber } from './numberUtils';

const PlayerSelector = ({
  selectedPlayer,
  setSelectedPlayer,
  lineType,
  setLineType,
  lineValue,
  setLineValue,
  playerList,
  averages,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

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
    const avgValue = toFiniteNumber(averages?.[0]?.[lineType]);
    if (avgValue !== null) {
      setLineValue(formatNumber(avgValue, 1));
    }
  }, [lineType, averages, setLineValue]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.length > 0) {
      const filteredPlayers = (playerList || [])
        .filter((player) => player.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 3); // Limit to 3 suggestions
      setSuggestions(filteredPlayers);
      setActiveSuggestionIndex(0);
    } else {
      setSuggestions([]);
      setActiveSuggestionIndex(0);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestionIndex(0);
      return;
    }

    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestionIndex] || suggestions[0]);
    }
  };

  const handleSuggestionClick = (player) => {
    setSelectedPlayer(player);
    setSearchTerm(player);
    setSuggestions([]);
    setActiveSuggestionIndex(0);
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
          <Form.Label htmlFor="player-selector-input" className="player-selector-label">
            Player:
          </Form.Label>
          <FormControl
            id="player-selector-input"
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search for a player"
            className="player-selector-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="player-selector-suggestions"
            aria-activedescendant={
              suggestions.length > 0 ? `player-suggestion-${activeSuggestionIndex}` : undefined
            }
          />
          {suggestions.length > 0 && (
            <ListGroup id="player-selector-suggestions" className="suggestions-list" role="listbox">
              {suggestions.map((player, index) => (
                <ListGroup.Item
                  key={player}
                  id={`player-suggestion-${index}`}
                  as="button"
                  type="button"
                  action
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                  onClick={() => handleSuggestionClick(player)}
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
          <Form.Label htmlFor="player-selector-line-type" className="player-selector-label">
            Line Type:
          </Form.Label>
          <Form.Select
            id="player-selector-line-type"
            value={lineType}
            onChange={(e) => {
              const newLineType = e.target.value;
              setLineType(newLineType);
              // Auto-populate with average for the new line type
              const average = toFiniteNumber(averages?.[0]?.[newLineType]);
              if (average !== null) {
                const avgValue = Math.round(average * 2) / 2;
                setLineValue(formatNumber(avgValue, 1));
              }
            }}
            className="player-selector-select"
          >
            {lineTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col md={4}>
        <Form.Group>
          <Form.Label htmlFor="player-selector-line-value" className="player-selector-label">
            Line Value:
          </Form.Label>
          <FormControl
            id="player-selector-line-value"
            type="text"
            inputMode="decimal"
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
