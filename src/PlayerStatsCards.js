import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { Activity, Target, Clock, TrendingUp, BarChart3, Zap, Shield, Users } from 'lucide-react';
import './PlayerStatsCards.css';

const PlayerStatsCards = ({ averages, selectedPlayer }) => {
  if (!Array.isArray(averages) || averages.length !== 2) {
    return null;
  }

  const [filteredAvg, seasonAvg] = averages;

  if (!filteredAvg || !seasonAvg) {
    return null;
  }

  // Define key stats to display with their icons and labels
  const statCards = [
    {
      key: 'PTS',
      label: 'POINTS',
      icon: <Target size={20} />
    },
    {
      key: 'REB',
      label: 'REBOUNDS',
      icon: <Activity size={20} />
    },
    {
      key: 'AST',
      label: 'ASSISTS',
      icon: <Users size={20} />
    },
    {
      key: 'STKS',
      label: 'STOCKS',
      icon: <Shield size={20} />
    },
    {
      key: 'MIN',
      label: 'MINUTES',
      icon: <Clock size={20} />
    },
    {
      key: 'FG_PCT',
      label: 'FG%',
      icon: <BarChart3 size={20} />,
      isPercentage: true
    },
    {
      key: 'FD_PTS',
      label: 'FANTASY POINTS',
      icon: <TrendingUp size={20} />
    },
    {
      key: 'TOV',
      label: 'TOV',
      icon: <Zap size={20} />
    }
  ];

  const formatStat = (value, isPercentage = false) => {
    if (typeof value !== 'number') return '--';
    if (isPercentage) return `${(value * 100).toFixed(1)}%`;
    return value.toFixed(1);
  };

  const formatSeasonComparison = (filtered, season, isPercentage = false) => {
    if (typeof filtered !== 'number' || typeof season !== 'number') return '';
    const diff = filtered - season;
    const sign = diff > 0 ? '+' : '';
    
    if (isPercentage) {
      // For percentages, multiply by 100 and show one decimal place
      return `${sign}${(diff * 100).toFixed(1)}% vs Season`;
    }
    
    return `${sign}${diff.toFixed(1)} vs Season`;
  };

  return (
    <div className="player-stats-cards">
      <Row className="mb-2">
        {/* Player Headshot Area - Left side */}
        <Col md={3} className="d-flex align-items-center justify-content-center">
          <div className="player-headshot-placeholder">
            <div className="headshot-circle">
              <span className="player-initials">
                {selectedPlayer ? selectedPlayer.split(' ').map(n => n[0]).join('') : 'PL'}
              </span>
            </div>
            <h4 className="player-name">{selectedPlayer || 'Select Player'}</h4>
          </div>
        </Col>

        {/* Stats Cards - Right side */}
        <Col md={9}>
          <Row>
            {statCards.slice(0, 4).map((stat) => (
              <Col md={3} key={stat.key} className="mb-3">
                <div className={`stat-card ${stat.primary ? 'primary-card' : ''}`}>
                  <div className="stat-header">
                    <div className="stat-icon">
                      {stat.icon}
                    </div>
                    <span className="stat-label">{stat.label}</span>
                  </div>
                  <div className="stat-value">
                    {formatStat(filteredAvg[stat.key], stat.isPercentage)}
                  </div>
                  <div className="stat-comparison">
                    {formatSeasonComparison(filteredAvg[stat.key], seasonAvg[stat.key], stat.isPercentage)}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
          <Row>
            {statCards.slice(4, 8).map((stat) => (
              <Col md={3} key={stat.key} className="mb-3">
                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon">
                      {stat.icon}
                    </div>
                    <span className="stat-label">{stat.label}</span>
                  </div>
                  <div className="stat-value">
                    {formatStat(filteredAvg[stat.key], stat.isPercentage)}
                  </div>
                  <div className="stat-comparison">
                    {formatSeasonComparison(filteredAvg[stat.key], seasonAvg[stat.key], stat.isPercentage)}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default PlayerStatsCards; 