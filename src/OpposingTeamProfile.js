import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Form, Row, Col, Table as BSTable } from 'react-bootstrap';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { RankCube } from './utils';
import { getApiUrl } from './config';

const OpposingTeamProfile = ({ teams, selectedTeam, setSelectedTeam }) => {
  const [selectedCategory, setSelectedCategory] = useState('Traditional');
  const [teamStats, setTeamStats] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [debouncedDateFilter, setDebouncedDateFilter] = useState('');
  const dateTimeoutRef = useRef(null);

  const fetchTeamStats = useCallback(() => {
    if (selectedTeam && selectedCategory) {
      const endpoint = getApiUrl('TEAM_STATS');
      axios
        .get(endpoint, {
          params: {
            category: selectedCategory,
            team: selectedTeam,
            date: debouncedDateFilter || null,
          },
        })
        .then((response) => {
          if (response.data) {
            setTeamStats(response.data);
          } else {
            console.error('Received invalid data format for team stats');
            setTeamStats(null);
          }
        })
        .catch((error) => {
          console.error('There was an error fetching the team stats!', error);
          setTeamStats(null);
        });
    } else {
      setTeamStats(null);
    }
  }, [selectedTeam, selectedCategory, debouncedDateFilter]);

  useEffect(() => {
    fetchTeamStats();
  }, [fetchTeamStats]);

  useEffect(() => {
    if (dateTimeoutRef.current) {
      clearTimeout(dateTimeoutRef.current);
    }
    dateTimeoutRef.current = setTimeout(() => {
      setDebouncedDateFilter(dateFilter);
    }, 700);

    return () => {
      if (dateTimeoutRef.current) {
        clearTimeout(dateTimeoutRef.current);
      }
    };
  }, [dateFilter]);

  const handleDateChange = (e) => {
    setDateFilter(e.target.value);
  };

  const handleTeamChange = (e) => {
    setSelectedTeam(e.target.value);
  };

  const transformShootingTypeData = (data) => {
    if (!data) return [];

    let parsedData;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse string data:', e);
        return [];
      }
    } else {
      parsedData = data;
    }

    if (!Array.isArray(parsedData)) {
      console.error('Parsed data is not an array:', parsedData);
      return [];
    }

    return parsedData.map((item) => {
      return {
        ShootingType: item.ShootingType || 'Unknown',
        PTS: item.PTS.toFixed(1),
        PTS_RANK: item.PTS_RANK,
        PTS_vs_avg_pct: item.PTS_vs_avg_pct,
        FG2A: item.FG2A.toFixed(1),
        FG2A_RANK: item.FG2A_RANK,
        FG2A_vs_avg_pct: item.FG2A_vs_avg_pct,
        FG2M: item.FG2M.toFixed(1),
        FG2M_RANK: item.FG2M_RANK,
        FG2M_vs_avg_pct: item.FG2M_vs_avg_pct,
        FG3A: item.FG3A.toFixed(1),
        FG3A_RANK: item.FG3A_RANK,
        FG3A_vs_avg_pct: item.FG3A_vs_avg_pct,
        FG3M: item.FG3M.toFixed(1),
        FG3M_RANK: item.FG3M_RANK,
        FG3M_vs_avg_pct: item.FG3M_vs_avg_pct,
      };
    });
  };

  const renderShootingTypeStats = () => {
    const transformedData = transformShootingTypeData(teamStats);
    console.log(transformedData);
    if (!transformedData || transformedData.length === 0) {
      return <p>No data available for Shooting Type stats.</p>;
    }

    const statPairs = [
      { value: 'PTS', rank: 'PTS_RANK', vs_avg: 'PTS_vs_avg_pct' },
      { value: 'FG2A', rank: 'FG2A_RANK', vs_avg: 'FG2A_vs_avg_pct' },
      { value: 'FG2M', rank: 'FG2M_RANK', vs_avg: 'FG2M_vs_avg_pct' },
      { value: 'FG3A', rank: 'FG3A_RANK', vs_avg: 'FG3A_vs_avg_pct' },
      { value: 'FG3M', rank: 'FG3M_RANK', vs_avg: 'FG3M_vs_avg_pct' },
    ];

    return (
      <BSTable striped bordered hover size="sm">
        <thead>
          <tr>
            <th>Shooting Type</th>
            {statPairs.map(({ value }) => (
              <th key={value}>{value}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transformedData.map((row) => {
            const shootingType = row.ShootingType || 'N/A';
            return (
              <tr key={shootingType}>
                <td>{shootingType}</td>
                {statPairs.map(({ value, rank, vs_avg }) => (
                  <td
                    key={`${shootingType}-${value}`}
                    style={{ textAlign: 'center', verticalAlign: 'middle' }}
                  >
                    <div
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                    >
                      <span>{row[value]}</span>
                      {row[rank] !== undefined && <RankCube rank={row[rank]} />}
                      {row[vs_avg] !== undefined && <span style={{ color: 'gray' }}>{`${row[vs_avg].toFixed(2)}%`}</span>}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </BSTable>
    );
  };

  const renderTeamStats = () => {
    if (!teamStats) return <p>Select a team and category to view stats.</p>;

    let statColumns;
    if (selectedCategory === 'Traditional') {
      statColumns = [
        'OPP_PTS',
        'OPP_FGM',
        'OPP_FGA',
        'OPP_FG_PCT',
        'OPP_FG3M',
        'OPP_FG3A',
        'OPP_FG3_PCT',
        'OPP_FTA',
        'OPP_OREB',
        'OPP_DREB',
        'OPP_REB',
        'OPP_AST',
        'OPP_TOV',
        'OPP_STL',
        'OPP_BLK',
        'OPP_STL+BLK',
      ];
    } else if (selectedCategory === 'Playtypes') {
      statColumns = Object.keys(teamStats).filter(
        (key) => !key.includes('RANK') && !key.includes('TEAM')
      );
    } else if (selectedCategory === 'Assists') {
      statColumns = [
        'Assists',
        'AssistPoints',
        'TwoPtAssists',
        'ThreePtAssists',
        'Arc3Assists',
        'Corner3Assists',
        'AtRimAssists',
        'ShortMidRangeAssists',
        'LongMidRangeAssists',
      ];
    } else if (selectedCategory === 'Zone Shooting') {
      statColumns = [
        'Restricted Area_OPP_FGM',
        'Restricted Area_OPP_FGA',
        'In The Paint (Non-RA)_OPP_FGM',
        'In The Paint (Non-RA)_OPP_FGA',
        'Mid-Range_OPP_FGM',
        'Mid-Range_OPP_FGA',
        'Above the Break 3_OPP_FGM',
        'Above the Break 3_OPP_FGA',
        'Corner 3_OPP_FGM',
        'Corner 3_OPP_FGA',
      ];
    } else if (selectedCategory === 'Shooting Type') {
      return renderShootingTypeStats();
    }

    const renderStatRow = (stat) => {
      const value =
        teamStats[stat] !== undefined ? Number(teamStats[stat]).toFixed(2) : 'N/A';
      const rank =
        teamStats[`${stat}_RANK`] !== undefined
          ? teamStats[`${stat}_RANK`]
          : 'N/A';
      const vs_avg =
        teamStats[`${stat}_vs_avg_pct`] !== undefined
          ? `${teamStats[`${stat}_vs_avg_pct`].toFixed(2)}%`
          : 'N/A';

      return (
        <tr key={stat}>
          <td>{stat.replace('OPP_', '').replace('_', ' ')}</td>
          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
            <div
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <span>{value}</span>
              {rank !== 'N/A' && <RankCube rank={rank} />}
              {vs_avg !== 'N/A' && <span style={{ color: 'gray' }}>{vs_avg}</span>}
            </div>
          </td>
        </tr>
      );
    };

    const halfLength = Math.ceil(statColumns.length / 2);
    const leftColumnStats = statColumns.slice(0, halfLength);
    const rightColumnStats = statColumns.slice(halfLength);

    return (
      <>
        <Row>
          <Col md={6}>
            <BSTable striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Stat</th>
                  <th>Value (Rank & vs Avg %)</th>
                </tr>
              </thead>
              <tbody>{leftColumnStats.map(renderStatRow)}</tbody>
            </BSTable>
          </Col>
          <Col md={6}>
            <BSTable striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Stat</th>
                  <th>Value (Rank & vs Avg %)</th>
                </tr>
              </thead>
              <tbody>{rightColumnStats.map(renderStatRow)}</tbody>
            </BSTable>
          </Col>
        </Row>
        {selectedCategory === 'Assists' && renderAssistsBarChart()}
      </>
    );
  };

  const renderAssistsBarChart = () => {
    if (!teamStats) return null;

    const assistCategories = [
      'Assists',
      'AssistPoints',
      'TwoPtAssists',
      'ThreePtAssists',
      'Arc3Assists',
      'Corner3Assists',
      'AtRimAssists',
      'ShortMidRangeAssists',
      'LongMidRangeAssists',
    ];
    const labels = assistCategories.map((category) =>
      category.replace(/([A-Z])/g, ' $1').trim()
    );
    const data = assistCategories.map(
      (category) => -(1 - (teamStats[category] || 0)) * 100
    );

    const backgroundColors = data.map((value) =>
      value > 0 ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)'
    );
    const borderColors = data.map((value) =>
      value > 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'
    );

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Percentage Compared to League Average',
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          hoverBackgroundColor: backgroundColors,
          hoverBorderColor: borderColors,
          data,
        },
      ],
    };

    const options = {
      maintainAspectRatio: false,
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return value + '%';
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              return `${tooltipItem.label}: ${tooltipItem.raw.toFixed(2)}%`;
            },
          },
        },
      },
      animation: {
        duration: 0,
      },
    };

    return (
      <div style={{ marginTop: '20px' }}>
        <div style={{ height: '400px' }}>
          <Bar data={chartData} options={options} />
        </div>
      </div>
    );
  };

  return (
    <Card className="dark-card">
      <Card.Body>
        <h4 className="mb-4">Opposing Team Profile</h4>
        <Form>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Select value={selectedTeam} onChange={handleTeamChange}>
                  <option value="">Choose a team</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="Traditional">Traditional</option>
                  <option value="Playtypes">Playtypes</option>
                  <option value="Assists">Assists</option>
                  <option value="Zone Shooting">Zone Shooting</option>
                  <option value="Shooting Type">Shooting Type</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Control
                  type="date"
                  value={dateFilter}
                  onChange={handleDateChange}
                />
              </Form.Group>
            </Col>
          </Row>
        </Form>
        {renderTeamStats()}
      </Card.Body>
    </Card>
  );
};

export default OpposingTeamProfile;
