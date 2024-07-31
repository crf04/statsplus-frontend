import React, { useState } from 'react';
import { Table, Alert } from 'react-bootstrap';

const ArchetypeGameLogs = ({ selectedPlayer, selectedTeam, gameLogs }) => {
  const [showAll, setShowAll] = useState(false);

  if (!gameLogs || !Array.isArray(gameLogs) || gameLogs.length === 0) {
    return <Alert variant="warning">No archetype game logs available for the selected player and team.</Alert>;
  }

  const renderGameLogRows = (log) => {
    const rawDataRow = (
      <tr key={`${log.PLAYER_NAME}-${log.GAME_DATE}-raw`}>
        <td rowSpan="2">{`${log.PLAYER_NAME[0]}. ${log.PLAYER_NAME.split(' ')[1]}`}</td>
        <td rowSpan="2">{new Date(log.GAME_DATE).toLocaleDateString()}</td>
        <td>{Math.round(log.MIN)}</td>
        <td>{log.FGM}</td>
        <td>{log.FGA}</td>
        <td>{log.FG3M}</td>
        <td>{log.FG3A}</td>
        <td>{log.FTA}</td>
        <td>{log.PTS}</td>
      </tr>
    );

    const perMinuteRow = (
      <tr key={`${log.PLAYER_NAME}-${log.GAME_DATE}-per-minute`}>
        <td>{(log['MIN/MIN'] || 1).toFixed(2)}</td>
        <td>{(log['FGM/MIN'] || 0).toFixed(2)}</td>
        <td>{(log['FGA/MIN'] || 0).toFixed(2)}</td>
        <td>{(log['FG3M/MIN'] || 0).toFixed(2)}</td>
        <td>{(log['FG3A/MIN'] || 0).toFixed(2)}</td>
        <td>{(log['FTA/MIN'] || 0).toFixed(2)}</td>
        <td>{(log['PTS/MIN'] || 0).toFixed(2)}</td>
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
              <th rowSpan="2">Player</th>
              <th rowSpan="2">Date</th>
            </tr>
            <tr>
              <th>MIN</th>
              <th>FGM</th>
              <th>FGA</th>
              <th>FG3M</th>
              <th>FG3A</th>
              <th>FTA</th>
              <th>PTS</th>
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