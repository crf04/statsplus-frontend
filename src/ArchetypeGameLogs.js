import React, { useState } from 'react';
import { Table, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';

const ArchetypeGameLogs = ({ selectedPlayer, selectedTeam, gameLogs }) => {
  const [showAll, setShowAll] = useState(false);

  if (!gameLogs || !Array.isArray(gameLogs) || gameLogs.length === 0) {
    return <Alert variant="warning">No archetype game logs available for the selected player and team.</Alert>;
  }

  // Function to get the tooltip showing percentage change
  const renderTooltip = (percentage) => (
    <Tooltip>{percentage !== undefined ? `${percentage.toFixed(1)}% change` : "No data"}</Tooltip>
  );

  // Function to determine text color based on percentage difference
  const getColorStyle = (percentage) => {
    if (percentage === undefined) return {}; // No color if no data

    const red = percentage < 0 ? 255 : Math.max(0, 255 - Math.abs(percentage) * 5);
    const green = percentage > 0 ? 255 : Math.max(0, 255 - Math.abs(percentage) * 5);
    return { color: `rgb(${red}, ${green}, 0)`, fontWeight: "bold" };
  };

  const renderGameLogRows = (log) => {
    const rawDataRow = (
      <tr key={`${log.PLAYER_NAME}-${log.GAME_DATE}-raw`}>
        <td>{`${log.PLAYER_NAME[0]}. ${log.PLAYER_NAME.split(' ')[1]}`}</td>
        <td>{new Date(log.GAME_DATE).toLocaleDateString()}</td>
        <td>{Math.round(log.MIN)}</td>
        <td>{log.FGM}</td>
        <td>{log.FGA}</td>
        <td>{log.FG3M}</td>
        <td>{log.FG3A}</td>
        <td>{log.FTA}</td>
        <td>{log.PTS}</td>
        <td>{log.TOV}</td>
      </tr>
    );

    const perMinuteRow = (
      <tr key={`${log.PLAYER_NAME}-${log.GAME_DATE}-per-minute`} className="text-muted">
        <td colSpan="2" style={{ fontSize: "14px", fontWeight: "bold" }}>Per 36 Min</td>
        <td>-</td>
        {['FGM/36MIN', 'FGA/36MIN', 'FG3M/36MIN', 'FG3A/36MIN', 'FTA/36MIN', 'PTS/36MIN'].map((stat) => (
          <td key={stat}>
            <OverlayTrigger
              placement="top"
              overlay={renderTooltip(log[`${stat}_DIFF`] * 100)}
            >
              <span style={getColorStyle(log[`${stat}_DIFF`] * 100)}>
                {(log[stat] || 0).toFixed(2)}
              </span>
            </OverlayTrigger>
          </td>
        ))}
      </tr>
    );

    return [rawDataRow, perMinuteRow];
  };

  const tableStyle = {
    overflow: 'auto',
    maxHeight: showAll ? 'none' : '400px',
  };

  const headerStyle = {
    position: 'sticky',
    top: 0,
    background: 'white',
    zIndex: 1,
  };

  return (
    <div>
      <div style={tableStyle}>
        <Table striped bordered hover responsive>
          <thead style={headerStyle}>
            <tr>
              <th>Player</th>
              <th>Date</th>
              <th>MIN</th>
              <th>FGM</th>
              <th>FGA</th>
              <th>FG3M</th>
              <th>FG3A</th>
              <th>FTA</th>
              <th>PTS</th>
              <th>TOV</th>
            </tr>
          </thead>
          <tbody>
            {gameLogs.filter(log => log.MIN > 10).flatMap(renderGameLogRows)}
          </tbody>
        </Table>
      </div>
      {gameLogs.length > 10 && (
        <button 
          onClick={() => setShowAll(!showAll)} 
          className="btn btn-link mt-2"
        >
          {showAll ? 'Show Less' : 'Show All'}
        </button>
      )}
    </div>
  );
};

export default ArchetypeGameLogs;
