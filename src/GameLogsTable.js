import React, { useState } from 'react';
import { Card } from 'react-bootstrap';
import './GameLogFilter.css';
import AppliedFilters from './AppliedFilters';
import { numericOrZero, toFiniteNumber } from './numberUtils';

const GameLogsTable = ({ gameLogs, appliedFilters, isLoading }) => {
  const [sortField, setSortField] = useState('GAME_DATE');
  const [sortDirection, setSortDirection] = useState('desc');

  // Calculate player averages for relative comparison
  const playerAverages = React.useMemo(() => {
    if (!gameLogs || gameLogs.length === 0) return {};

    const averages = {};
    const numericColumns = Object.keys(gameLogs[0]).filter(
      (key) => key !== 'GAME_DATE' && gameLogs.some((game) => toFiniteNumber(game[key]) !== null),
    );

    numericColumns.forEach((col) => {
      const values = gameLogs
        .map((game) => toFiniteNumber(game[col]))
        .filter((val) => val !== null);
      if (values.length > 0) {
        averages[col] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    // Calculate combination stat averages
    const praValues = gameLogs.map(
      (game) => numericOrZero(game.PTS) + numericOrZero(game.REB) + numericOrZero(game.AST),
    );
    const prValues = gameLogs.map((game) => numericOrZero(game.PTS) + numericOrZero(game.REB));
    const paValues = gameLogs.map((game) => numericOrZero(game.PTS) + numericOrZero(game.AST));
    const arValues = gameLogs.map((game) => numericOrZero(game.AST) + numericOrZero(game.REB));

    if (praValues.length > 0) {
      averages['PRA'] = praValues.reduce((sum, val) => sum + val, 0) / praValues.length;
      averages['PR'] = prValues.reduce((sum, val) => sum + val, 0) / prValues.length;
      averages['PA'] = paValues.reduce((sum, val) => sum + val, 0) / paValues.length;
      averages['AR'] = arValues.reduce((sum, val) => sum + val, 0) / arValues.length;
    }

    return averages;
  }, [gameLogs]);

  const formatDate = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
    });
  };

  const getPerformanceColor = (value, columnId) => {
    const numericValue = toFiniteNumber(value);
    const average = toFiniteNumber(playerAverages[columnId]);
    if (numericValue === null || average === null) return '#9b937f';
    if (average === 0) return numericValue === 0 ? '#c9c2b2' : '#4caf7d';

    let ratio = numericValue / average;

    // For turnovers and fouls, lower is better — invert the scale
    if (columnId === 'TO' || columnId === 'PF') {
      ratio = 2 - ratio;
    }

    // Quiet 5-step ramp: neutral near average, color only at the extremes
    if (ratio >= 1.35) return '#5fce93'; // well above average (bright hit green)
    if (ratio >= 1.12) return '#4caf7d'; // above average
    if (ratio >= 0.88) return '#c9c2b2'; // around average (neutral warm)
    if (ratio >= 0.65) return '#b3766f'; // below average
    return '#d95f5f'; // well below average (bright miss red)
  };

  const sortedGames = React.useMemo(() => {
    if (!gameLogs) return [];

    return [...gameLogs].sort((a, b) => {
      let aVal, bVal;

      // Handle combination stats
      if (sortField === 'PRA') {
        aVal = numericOrZero(a.PTS) + numericOrZero(a.REB) + numericOrZero(a.AST);
        bVal = numericOrZero(b.PTS) + numericOrZero(b.REB) + numericOrZero(b.AST);
      } else if (sortField === 'PR') {
        aVal = numericOrZero(a.PTS) + numericOrZero(a.REB);
        bVal = numericOrZero(b.PTS) + numericOrZero(b.REB);
      } else if (sortField === 'PA') {
        aVal = numericOrZero(a.PTS) + numericOrZero(a.AST);
        bVal = numericOrZero(b.PTS) + numericOrZero(b.AST);
      } else if (sortField === 'AR') {
        aVal = numericOrZero(a.AST) + numericOrZero(a.REB);
        bVal = numericOrZero(b.AST) + numericOrZero(b.REB);
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      const aNumber = toFiniteNumber(aVal);
      const bNumber = toFiniteNumber(bVal);
      let comparison;
      if (aNumber !== null && bNumber !== null) {
        comparison = aNumber - bNumber;
      } else {
        comparison = String(aVal ?? '').localeCompare(String(bVal ?? ''), undefined, {
          numeric: true,
        });
      }
      return sortDirection === 'asc' ? comparison : -comparison;
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
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!gameLogs || gameLogs.length === 0) {
    return (
      <Card className="dark-card">
        <Card.Body>
          <h4 className="mb-4">Game Logs</h4>
          {/* A request still in flight has not found nothing — it has not
              answered yet. The loading state above says so; claiming an empty
              result here would be a lie the user acts on. */}
          {!isLoading && (
            <div className="no-games-message">
              <h4>No game logs to display</h4>
            </div>
          )}
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
    { key: 'AR', label: 'AR', width: '40px' },
  ];

  return (
    <Card className="dark-card">
      <Card.Body>
        <h4 className="mb-2">Game Logs</h4>
        <div className="mb-2">
          <AppliedFilters filters={appliedFilters || {}} />
        </div>

        <div className="table-scroll-container">
          <table className="game-logs-table-compact">
            <thead>
              <tr className="table-header-row">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`table-header-cell ${sortField === col.key ? 'sorted' : ''}`}
                    style={{ width: col.width, minWidth: col.width }}
                    scope="col"
                    aria-sort={
                      sortField === col.key
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="table-header-button"
                      onClick={() => handleSort(col.key)}
                      aria-label={`Sort by ${col.label} (${sortField === col.key && sortDirection === 'asc' ? 'descending' : 'ascending'})`}
                    >
                      <span className="header-content">
                        <span className="header-text">{col.label}</span>
                        <span className="sort-arrow" aria-hidden="true">
                          {getSortIcon(col.key)}
                        </span>
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game, index) => (
                <tr key={index} className={`table-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                  {columns.map((col) => {
                    const value = game[col.key];

                    // Calculate combination stat values for color coding
                    let displayValue = value;
                    let colorValue = value;

                    if (col.key === 'PRA') {
                      displayValue =
                        numericOrZero(game.PTS) + numericOrZero(game.REB) + numericOrZero(game.AST);
                      colorValue = displayValue;
                    } else if (col.key === 'PR') {
                      displayValue = numericOrZero(game.PTS) + numericOrZero(game.REB);
                      colorValue = displayValue;
                    } else if (col.key === 'PA') {
                      displayValue = numericOrZero(game.PTS) + numericOrZero(game.AST);
                      colorValue = displayValue;
                    } else if (col.key === 'AR') {
                      displayValue = numericOrZero(game.AST) + numericOrZero(game.REB);
                      colorValue = displayValue;
                    }

                    const numericValue = toFiniteNumber(value);

                    return (
                      <td
                        key={col.key}
                        className="table-cell"
                        style={{
                          width: col.width,
                          color: [
                            'PTS',
                            'FG_PCT',
                            'FG3_PCT',
                            'REB',
                            'AST',
                            'STL',
                            'BLK',
                            'TO',
                            'PRA',
                            'PR',
                            'PA',
                            'AR',
                          ].includes(col.key)
                            ? getPerformanceColor(colorValue, col.key)
                            : '#cccccc',
                        }}
                      >
                        {col.key === 'GAME_DATE'
                          ? formatDate(value)
                          : col.key === 'MATCHUP'
                            ? typeof value === 'string'
                              ? value.split(' ')[2] || 'N/A'
                              : 'N/A'
                            : col.key === 'W/L'
                              ? value || '-'
                              : col.key === 'MIN'
                                ? numericValue === null
                                  ? 'N/A'
                                  : Math.floor(numericValue)
                                : col.key === 'FG_PCT' || col.key === 'FG3_PCT'
                                  ? numericValue === null
                                    ? 'N/A'
                                    : `${(numericValue * 100).toFixed(0)}%`
                                  : ['PRA', 'PR', 'PA', 'AR'].includes(col.key)
                                    ? displayValue
                                    : numericValue === null
                                      ? 'N/A'
                                      : numericValue}
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
