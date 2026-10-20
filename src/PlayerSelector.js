import { useState, useEffect } from 'react';
import { Row, Col, Form, FormControl, ListGroup } from 'react-bootstrap';
import { lineTypeOptions } from './utils';
import './PlayerSelector.css'; // Import the CSS file
import { formatNumber } from './numberUtils';
import { lineSourceId, lineSourcesFor } from './gameLogsApi';
import { bookName } from './matchups/displayConfig';
import { formatPrice } from './matchups/linePrices';
import { shortSlateDay } from './home/homeFormat';

const hasPrice = (source) => source.over !== null || source.under !== null;

// "DraftKings 26.5, Over −110, Under −115"; a provider with no per-pick price
// is named with its line alone.
const sourceLabel = (source) =>
  [
    `${bookName(source.key)} ${formatNumber(source.line, 1)}`,
    ...(hasPrice(source)
      ? [
          source.over === null ? 'no Over price' : `Over ${formatPrice(source.over)}`,
          source.under === null ? 'no Under price' : `Under ${formatPrice(source.under)}`,
        ]
      : []),
  ].join(', ');

function LineSourcePicker({ posted, sources, lineSource, onChoose }) {
  const game = [posted.matchup, posted.gameDate && shortSlateDay(posted.gameDate)]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="line-sources" role="group" aria-labelledby="line-sources-label">
      <div className="line-sources-head">
        <span id="line-sources-label" className="player-selector-label">
          Posted Lines:
        </span>
        {game && <span className="line-sources-game">{game}</span>}
      </div>
      <div className="line-sources-list">
        {sources.map((source) => {
          const id = lineSourceId(source);
          return (
            <button
              key={id}
              type="button"
              className="line-source"
              aria-pressed={lineSource === id}
              aria-label={sourceLabel(source)}
              onClick={() => onChoose(source)}
            >
              <span className="line-source-name">{bookName(source.key)}</span>
              <span className="line-source-line">{formatNumber(source.line, 1)}</span>
              {hasPrice(source) && (
                <span className="line-source-prices">
                  <span>o {source.over === null ? '—' : formatPrice(source.over)}</span>
                  <span>u {source.under === null ? '—' : formatPrice(source.under)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PlayerSelector = ({
  selectedPlayer,
  setSelectedPlayer,
  lineType,
  setLineType,
  lineValue,
  onTypeLineValue,
  lineSource,
  onChooseSource,
  playerList,
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

  const sources = lineSourcesFor(postedLine, lineType);

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
      onTypeLineValue(value);
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
      {sources.length > 0 && (
        <Col xs={12}>
          <LineSourcePicker
            posted={postedLine}
            sources={sources}
            lineSource={lineSource}
            onChoose={(source) => onChooseSource(lineSourceId(source))}
          />
        </Col>
      )}
    </Row>
  );
};

export default PlayerSelector;
