import { useState, useEffect, useRef } from 'react';
import { Row, Col, Form, FormControl, ListGroup } from 'react-bootstrap';
import { lineTypeOptions } from './utils';
import './PlayerSelector.css'; // Import the CSS file
import { formatNumber, toFiniteNumber } from './numberUtils';
import { postedLineFor } from './gameLogsApi';

const PlayerSelector = ({
  selectedPlayer,
  setSelectedPlayer,
  lineType,
  setLineType,
  lineValue,
  setLineValue,
  setLineIsPosted,
  playerList,
  averages,
  postedLine,
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

  // A value typed for this player and Line Type is kept while the logs
  // refetch; changing either one defaults the line again.
  const lineEditedForRef = useRef(null);
  const lineKey = `${selectedPlayer}|${lineType}`;

  // The line defaults to his next game's posted line, else the season average.
  useEffect(() => {
    if (lineEditedForRef.current === lineKey) return;
    // Another player or Line Type: an earlier edit no longer applies.
    lineEditedForRef.current = null;
    const posted = postedLineFor(postedLine, lineType);
    const value = posted?.value ?? toFiniteNumber(averages?.[1]?.[lineType]);
    if (value !== null) {
      setLineValue(formatNumber(value, 1));
      setLineIsPosted(Boolean(posted));
    }
  }, [lineKey, lineType, averages, postedLine, setLineValue, setLineIsPosted]);

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
      lineEditedForRef.current = lineKey;
      setLineValue(value);
      setLineIsPosted(false);
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
            onChange={(e) => setLineType(e.target.value)}
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
