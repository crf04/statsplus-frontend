import React, { useState } from 'react';
import { Card } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './GameLogFilter.css';
import AppliedFilters from './AppliedFilters'; 

const GameLogsTable = ({ gameLogs, appliedFilters }) => {
  const [sortField, setSortField] = useState('GAME_DATE');
  const [sortDirection, setSortDirection] = useState('desc');

  // Calculate player averages for relative comparison
  const playerAverages = React.useMemo(() => {
    if (!gameLogs || gameLogs.length === 0) return {};
    
    const averages = {};
    const numericColumns = Object.keys(gameLogs[0]).filter(key => 
      typeof gameLogs[0][key] === 'number' && key !== 'GAME_DATE'
    );
    
    numericColumns.forEach(col => {
      const values = gameLogs.map(game => game[col]).filter(val => typeof val === 'number');
      if (values.length > 0) {
        averages[col] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });
    
    // Calculate combination stat averages
    const praValues = gameLogs.map(game => (game.PTS || 0) + (game.REB || 0) + (game.AST || 0));
    const prValues = gameLogs.map(game => (game.PTS || 0) + (game.REB || 0));
    const paValues = gameLogs.map(game => (game.PTS || 0) + (game.AST || 0));
    const arValues = gameLogs.map(game => (game.AST || 0) + (game.REB || 0));
    
    if (praValues.length > 0) {
      averages['PRA'] = praValues.reduce((sum, val) => sum + val, 0) / praValues.length;
      averages['PR'] = prValues.reduce((sum, val) => sum + val, 0) / prValues.length;
      averages['PA'] = paValues.reduce((sum, val) => sum + val, 0) / paValues.length;
      averages['AR'] = arValues.reduce((sum, val) => sum + val, 0) / arValues.length;
    }
    
    return averages;
  }, [gameLogs]);

  const formatDate = (dateValue) => {
    return new Date(dateValue).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric'
    });
  };

  const getPerformanceColor = (value, columnId) => {
    if (typeof value !== 'number' || !playerAverages[columnId]) return '#cccccc';
    
    const average = playerAverages[columnId];
    const ratio = value / average;
    
    // For turnovers, lower is better
    if (columnId === 'TO' || columnId === 'PF') {
      if (ratio <= 0.6) return '#10b981'; // Excellent (bright green)
      if (ratio <= 0.8) return '#22c55e'; // Good (medium green)
      if (ratio <= 1.0) return '#84cc16'; // Above average (yellow-green)
      if (ratio <= 1.2) return '#eab308'; // Below average (yellow)
      if (ratio <= 1.4) return '#f97316'; // Poor (orange)
      return '#ef4444'; // Very poor (red)
    }
    
    // For shooting percentages and other positive stats
    if (ratio >= 1.4) return '#10b981'; // Excellent (bright green)
    if (ratio >= 1.2) return '#22c55e'; // Good (medium green)
    if (ratio >= 1.0) return '#84cc16'; // Above average (yellow-green)
    if (ratio >= 0.8) return '#eab308'; // Below average (yellow)
    if (ratio >= 0.6) return '#f97316'; // Poor (orange)
    return '#ef4444'; // Very poor (red)
  };

  const sortedGames = React.useMemo(() => {
    if (!gameLogs) return [];
    
    return [...gameLogs].sort((a, b) => {
      let aVal, bVal;
      
      // Handle combination stats
      if (sortField === 'PRA') {
        aVal = (a.PTS || 0) + (a.REB || 0) + (a.AST || 0);
        bVal = (b.PTS || 0) + (b.REB || 0) + (b.AST || 0);
      } else if (sortField === 'PR') {
        aVal = (a.PTS || 0) + (a.REB || 0);
        bVal = (b.PTS || 0) + (b.REB || 0);
      } else if (sortField === 'PA') {
        aVal = (a.PTS || 0) + (a.AST || 0);
        bVal = (b.PTS || 0) + (b.AST || 0);
      } else if (sortField === 'AR') {
        aVal = (a.AST || 0) + (a.REB || 0);
        bVal = (b.AST || 0) + (b.REB || 0);
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [gameLogs, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!gameLogs || gameLogs.length === 0) {
    return (
      <Card className="dark-card">
        <Card.Body>
          <h4 className="mb-4">Game Logs</h4>
          <div className="no-games-message">
            <h4>No game logs to display</h4>
          </div>
        </Card.Body>
      </Card>
    );
  }

  // Define simplified columns that will fit on one row
  const columns = [
    { key: 'GAME_DATE', label: 'Date', width: '60px' },
    { key: 'MATCHUP', label: 'OPP', width: '50px' },
    { key: 'W/L', label: 'W/L', width: '35px' },
    { key: 'MIN', label: 'MIN', width: '40px' },
    { key: 'PTS', label: 'PTS', width: '40px' },
    { key: 'FGM', label: 'FGM', width: '40px' },
    { key: 'FGA', label: 'FGA', width: '40px' },
    { key: 'FG_PCT', label: 'FG%', width: '45px' },
    { key: 'FG3M', label: '3PM', width: '40px' },
    { key: 'FG3A', label: '3PA', width: '40px' },
    { key: 'FG3_PCT', label: '3P%', width: '45px' },
    { key: 'FTM', label: 'FTM', width: '40px' },
    { key: 'FTA', label: 'FTA', width: '40px' },
    { key: 'REB', label: 'REB', width: '40px' },
    { key: 'AST', label: 'AST', width: '40px' },
    { key: 'STL', label: 'STL', width: '40px' },
    { key: 'BLK', label: 'BLK', width: '40px' },
    { key: 'TO', label: 'TO', width: '35px' },
    { key: 'PRA', label: 'PRA', width: '45px' },
    { key: 'PR', label: 'PR', width: '40px' },
    { key: 'PA', label: 'PA', width: '40px' },
    { key: 'AR', label: 'AR', width: '40px' }
  ];

  return (
    <Card className="dark-card">
      <Card.Body>
        <h4 className="mb-4">Game Logs</h4>
        <div className="mb-2">
          <AppliedFilters filters={appliedFilters || {}} />
        </div>
        
        <div className="table-scroll-container">
          <table className="game-logs-table-compact">
            <thead>
              <tr className="table-header-row">
                {columns.map(col => (
                  <th 
                    key={col.key}
                    className={`table-header-cell ${sortField === col.key ? 'sorted' : ''}`}
                    style={{ width: col.width, minWidth: col.width }}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="header-content">
                      <span className="header-text">{col.label}</span>
                      <span className="sort-arrow">{getSortIcon(col.key)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game, index) => (
                <tr key={index} className={`table-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                  {columns.map(col => {
                    const value = game[col.key];
                    
                    // Calculate combination stat values for color coding
                    let displayValue = value;
                    let colorValue = value;
                    
                    if (col.key === 'PRA') {
                      displayValue = (game.PTS || 0) + (game.REB || 0) + (game.AST || 0);
                      colorValue = displayValue;
                    } else if (col.key === 'PR') {
                      displayValue = (game.PTS || 0) + (game.REB || 0);
                      colorValue = displayValue;
                    } else if (col.key === 'PA') {
                      displayValue = (game.PTS || 0) + (game.AST || 0);
                      colorValue = displayValue;
                    } else if (col.key === 'AR') {
                      displayValue = (game.AST || 0) + (game.REB || 0);
                      colorValue = displayValue;
                    }
                    
                    return (
                      <td 
                        key={col.key} 
                        className="table-cell"
                        style={{ 
                          width: col.width,
                          color: ['PTS', 'FG_PCT', 'FG3_PCT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PRA', 'PR', 'PA', 'AR'].includes(col.key) 
                            ? getPerformanceColor(colorValue, col.key) 
                            : '#cccccc'
                        }}
                      >
                        {col.key === 'GAME_DATE' ? formatDate(value) :
                         col.key === 'MATCHUP' ? (value?.split(' ')[2] || 'N/A') :
                         col.key === 'W/L' ? (value || '-') :
                         col.key === 'MIN' ? (value ? Math.floor(value) : 0) :
                         col.key === 'FG_PCT' || col.key === 'FG3_PCT' ? 
                           (value ? (value * 100).toFixed(0) + '%' : '0%') :
                         ['PRA', 'PR', 'PA', 'AR'].includes(col.key) ? displayValue :
                         (value || 0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
};

export default GameLogsTable;