import React from 'react';
import { Row, Col, Form, FormControl } from 'react-bootstrap';
import { lineTypeOptions } from './utils';

const PlayerSelector = ({ selectedPlayer, setSelectedPlayer, lineType, setLineType, lineValue, setLineValue, playerList }) => {
  const handleLineValueChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(parseFloat(value)) && isFinite(value))) {
      setLineValue(value);
    }
  };

  return (
    <Row className="mb-4">
      <Col md={4}>
        <Form.Group>
          <Form.Label>Select Player:</Form.Label>
          <Form.Select 
            value={selectedPlayer} 
            onChange={e => setSelectedPlayer(e.target.value)}
          >
            <option value="None">None</option>
            {playerList.map(player => (
              <option key={player} value={player}>{player}</option>
            ))}
          </Form.Select>
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