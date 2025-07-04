import React from 'react';
import { Row, Col, Card, Table as BSTable } from 'react-bootstrap';

const PerformanceAverages = ({ averages }) => {
  const renderAveragesTable = () => {
    if (!Array.isArray(averages) || averages.length !== 2) {
      return null;
    }

    const [filteredAvg, seasonAvg] = averages;

    if (!filteredAvg || !seasonAvg) {
      return null;
    }

    const calculatePer36 = (stat, minutes) => {
      if (typeof stat !== 'number' || typeof minutes !== 'number' || minutes === 0) {
        return stat;
      }
      return (stat / minutes) * 36;
    };

    const per36Filtered = {};
    const per36Season = {};
    for (let key in filteredAvg) {
      if (key !== 'MIN') {
        per36Filtered[key] = calculatePer36(filteredAvg[key], filteredAvg['MIN']);
        per36Season[key] = calculatePer36(seasonAvg[key], seasonAvg['MIN']);
      } else {
        per36Filtered[key] = 36;
        per36Season[key] = 36;
      }
    }

    const renderTable = (rawFiltered, rawSeason, per36Filtered, per36Season) => {
      const stats = Object.keys(rawFiltered);
      return (
        <BSTable striped bordered hover responsive className="table">
          <thead>
            <tr>
              <th>Average Type</th>
              {stats.map(stat => <th key={stat}>{stat}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Filtered</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof rawFiltered[stat] === 'number' ? rawFiltered[stat].toFixed(2) : rawFiltered[stat]}
                </td>
              ))}
            </tr>
            <tr>
              <td>Season</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof rawSeason[stat] === 'number' ? rawSeason[stat].toFixed(2) : rawSeason[stat]}
                </td>
              ))}
            </tr>
            <tr>
              <td>Filtered/36</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof per36Filtered[stat] === 'number' ? per36Filtered[stat].toFixed(2) : per36Filtered[stat]}
                </td>
              ))}
            </tr>
            <tr>
              <td>Season/36</td>
              {stats.map(stat => (
                <td key={stat}>
                  {typeof per36Season[stat] === 'number' ? per36Season[stat].toFixed(2) : per36Season[stat]}
                </td>
              ))}
            </tr>
          </tbody>
        </BSTable>
      );
    };

    return renderTable(filteredAvg, seasonAvg, per36Filtered, per36Season);
  };

  return (
    <Row>
      <Col>
        <Card className="dark-card">
          <Card.Body>
            <h4 className="mb-4">Player Averages</h4>
            <div className="table-responsive">
              {renderAveragesTable()}
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default PerformanceAverages;