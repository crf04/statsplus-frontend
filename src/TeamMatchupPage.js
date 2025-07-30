import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './TeamMatchupPage.css';
import './GameLogFilter.css';
import MatchupChart from './components/MatchupChart';

// Mock data for development
const mockTeamData = {
  lakers: {
    name: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    record: '28-26',
    winPct: 0.519,
    color: '#552583',
    stats: {
      ppg: 118.2,
      ppg_rank: 5,
      fg_pct: 0.484,
      fg_pct_rank: 8,
      three_p_pct: 0.367,
      ast_pg: 26.8,
      ast_pg_rank: 12,
      reb_pg: 43.1,
      opp_ppg: 116.4,
      opp_ppg_rank: 18,
      def_rtg: 113.2,
      def_rtg_rank: 15,
      stl_pg: 7.8,
      stl_pg_rank: 22,
      blk_pg: 5.4,
      pace: 100.2,
      off_rtg: 115.8
    },
    recentForm: [1, 1, 0, 1, 0], // 1 = win, 0 = loss
    keyPlayers: [
      { name: 'LeBron James', ppg: 25.2, rpg: 7.1, apg: 7.9 },
      { name: 'Anthony Davis', ppg: 23.8, rpg: 12.1, apg: 3.1 },
      { name: 'Russell Westbrook', ppg: 18.4, rpg: 7.2, apg: 7.1 }
    ]
  },
  warriors: {
    name: 'Golden State Warriors',
    abbreviation: 'GSW',
    record: '32-22',
    winPct: 0.593,
    color: '#1D428A',
    stats: {
      ppg: 115.8,
      ppg_rank: 10,
      fg_pct: 0.466,
      fg_pct_rank: 15,
      three_p_pct: 0.386,
      ast_pg: 27.2,
      ast_pg_rank: 8,
      reb_pg: 44.8,
      opp_ppg: 111.2,
      opp_ppg_rank: 8,
      def_rtg: 109.4,
      def_rtg_rank: 6,
      stl_pg: 9.1,
      stl_pg_rank: 5,
      blk_pg: 4.9,
      pace: 99.1,
      off_rtg: 113.2
    },
    recentForm: [1, 0, 1, 1, 1],
    keyPlayers: [
      { name: 'Stephen Curry', ppg: 29.1, rpg: 6.2, apg: 6.1 },
      { name: 'Klay Thompson', ppg: 20.4, rpg: 3.9, apg: 2.8 },
      { name: 'Draymond Green', ppg: 7.8, rpg: 7.6, apg: 7.2 }
    ]
  }
};

const mockGameInfo = {
  date: '2024-03-15',
  time: '10:00 PM ET',
  venue: 'Chase Center',
  city: 'San Francisco, CA',
  headToHeadRecord: '1-1 this season'
};

const MatchupHeader = ({ teamA, teamB, gameInfo }) => {
  return (
    <div className="matchup-header">
      <Container>
        <Row className="align-items-center">
          <Col md={4} className="text-center">
            <div className="team-info">
              <div className="team-logo" style={{ borderColor: teamA.color }}>
                {teamA.abbreviation}
              </div>
              <h3 className="team-name">{teamA.name}</h3>
              <div className="team-record">{teamA.record} ({(teamA.winPct * 100).toFixed(1)}%)</div>
            </div>
          </Col>
          <Col md={4} className="text-center">
            <div className="game-info">
              <h2 className="vs-text">VS</h2>
              <div className="game-details">
                <div className="game-date">{gameInfo.date}</div>
                <div className="game-time">{gameInfo.time}</div>
                <div className="game-venue">{gameInfo.venue}, {gameInfo.city}</div>
                <div className="head-to-head">{gameInfo.headToHeadRecord}</div>
              </div>
            </div>
          </Col>
          <Col md={4} className="text-center">
            <div className="team-info">
              <div className="team-logo" style={{ borderColor: teamB.color }}>
                {teamB.abbreviation}
              </div>
              <h3 className="team-name">{teamB.name}</h3>
              <div className="team-record">{teamB.record} ({(teamB.winPct * 100).toFixed(1)}%)</div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

const MatchupHero = ({ teamA, teamB }) => {
  const calculateAdvantage = (statA, statB, higherIsBetter = true) => {
    if (higherIsBetter) {
      return statA > statB ? 'teamA' : statB > statA ? 'teamB' : 'neutral';
    } else {
      return statA < statB ? 'teamA' : statB < statA ? 'teamB' : 'neutral';
    }
  };

  const heroStats = [
    { key: 'ppg', label: 'Points Per Game', format: 'decimal', higherIsBetter: true },
    { key: 'fg_pct', label: 'Field Goal %', format: 'percentage', higherIsBetter: true },
    { key: 'def_rtg', label: 'Defensive Rating', format: 'decimal', higherIsBetter: false },
    { key: 'pace', label: 'Pace', format: 'decimal', higherIsBetter: true }
  ];

  return (
    <div className="matchup-hero">
      <Container>
        <Row>
          {heroStats.map((stat) => (
            <Col md={3} key={stat.key} className="mb-4">
              <div className="hero-stat-card">
                <div className="stat-label">{stat.label}</div>
                <div className="stat-comparison">
                  <div className={`stat-value ${calculateAdvantage(teamA.stats[stat.key], teamB.stats[stat.key], stat.higherIsBetter) === 'teamA' ? 'advantage' : ''}`}>
                    {stat.format === 'percentage' ? (teamA.stats[stat.key] * 100).toFixed(1) + '%' : teamA.stats[stat.key]}
                  </div>
                  <div className="vs-divider">vs</div>
                  <div className={`stat-value ${calculateAdvantage(teamA.stats[stat.key], teamB.stats[stat.key], stat.higherIsBetter) === 'teamB' ? 'advantage' : ''}`}>
                    {stat.format === 'percentage' ? (teamB.stats[stat.key] * 100).toFixed(1) + '%' : teamB.stats[stat.key]}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Recent Form */}
        <Row className="mt-4">
          <Col md={6}>
            <div className="recent-form">
              <h4>Recent Form - {teamA.name}</h4>
              <div className="form-indicators">
                {teamA.recentForm.map((result, index) => (
                  <div key={index} className={`form-dot ${result ? 'win' : 'loss'}`}>
                    {result ? 'W' : 'L'}
                  </div>
                ))}
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="recent-form">
              <h4>Recent Form - {teamB.name}</h4>
              <div className="form-indicators">
                {teamB.recentForm.map((result, index) => (
                  <div key={index} className={`form-dot ${result ? 'win' : 'loss'}`}>
                    {result ? 'W' : 'L'}
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

const TeamComparisonCard = ({ stat, teamA, teamB, title }) => {
  const calculateAdvantage = (statA, statB, higherIsBetter = true) => {
    if (higherIsBetter) {
      return statA > statB ? 'teamA' : statB > statA ? 'teamB' : 'neutral';
    } else {
      return statA < statB ? 'teamA' : statB < statA ? 'teamB' : 'neutral';
    }
  };

  const advantage = calculateAdvantage(teamA.stats[stat.key], teamB.stats[stat.key], stat.higherIsBetter);
  
  return (
    <div className="team-comparison-card">
      <div className="comparison-header">
        <h4>{title}</h4>
      </div>
      <div className="comparison-body">
        <div className="team-stat">
          <div className="team-name-small">{teamA.abbreviation}</div>
          <div className={`stat-value-large ${advantage === 'teamA' ? 'advantage' : ''}`}>
            {stat.format === 'percentage' ? (teamA.stats[stat.key] * 100).toFixed(1) + '%' : teamA.stats[stat.key]}
          </div>
        </div>
        <div className="comparison-divider"></div>
        <div className="team-stat">
          <div className="team-name-small">{teamB.abbreviation}</div>
          <div className={`stat-value-large ${advantage === 'teamB' ? 'advantage' : ''}`}>
            {stat.format === 'percentage' ? (teamB.stats[stat.key] * 100).toFixed(1) + '%' : teamB.stats[stat.key]}
          </div>
        </div>
      </div>
    </div>
  );
};

const HeadToHeadStats = ({ teamA, teamB }) => {
  const offensiveStats = [
    { key: 'ppg', label: 'Points Per Game', format: 'decimal', higherIsBetter: true },
    { key: 'fg_pct', label: 'Field Goal %', format: 'percentage', higherIsBetter: true },
    { key: 'three_p_pct', label: 'Three Point %', format: 'percentage', higherIsBetter: true },
    { key: 'ast_pg', label: 'Assists Per Game', format: 'decimal', higherIsBetter: true }
  ];

  const defensiveStats = [
    { key: 'opp_ppg', label: 'Opp Points Allowed', format: 'decimal', higherIsBetter: false },
    { key: 'def_rtg', label: 'Defensive Rating', format: 'decimal', higherIsBetter: false },
    { key: 'stl_pg', label: 'Steals Per Game', format: 'decimal', higherIsBetter: true },
    { key: 'blk_pg', label: 'Blocks Per Game', format: 'decimal', higherIsBetter: true }
  ];

  return (
    <div className="head-to-head-stats">
      <Container>
        <Row>
          <Col md={6}>
            <div className="stats-section">
              <h3 className="section-title">Offensive Comparison</h3>
              <Row>
                {offensiveStats.map((stat) => (
                  <Col md={6} key={stat.key} className="mb-3">
                    <TeamComparisonCard
                      stat={stat}
                      teamA={teamA}
                      teamB={teamB}
                      title={stat.label}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          </Col>
          <Col md={6}>
            <div className="stats-section">
              <h3 className="section-title">Defensive Comparison</h3>
              <Row>
                {defensiveStats.map((stat) => (
                  <Col md={6} key={stat.key} className="mb-3">
                    <TeamComparisonCard
                      stat={stat}
                      teamA={teamA}
                      teamB={teamB}
                      title={stat.label}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          </Col>
        </Row>

        {/* Key Players Section */}
        <Row className="mt-5">
          <Col md={6}>
            <div className="key-players-section">
              <h3 className="section-title">Key Players - {teamA.name}</h3>
              {teamA.keyPlayers.map((player, index) => (
                <div key={index} className="player-card">
                  <div className="player-name">{player.name}</div>
                  <div className="player-stats">
                    <span>{player.ppg} PPG</span>
                    <span>{player.rpg} RPG</span>
                    <span>{player.apg} APG</span>
                  </div>
                </div>
              ))}
            </div>
          </Col>
          <Col md={6}>
            <div className="key-players-section">
              <h3 className="section-title">Key Players - {teamB.name}</h3>
              {teamB.keyPlayers.map((player, index) => (
                <div key={index} className="player-card">
                  <div className="player-name">{player.name}</div>
                  <div className="player-stats">
                    <span>{player.ppg} PPG</span>
                    <span>{player.rpg} RPG</span>
                    <span>{player.apg} APG</span>
                  </div>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

const OffenseVsDefenseCard = ({ title, offenseTeam, defenseTeam, offenseStat, defenseStat, offenseRank, defenseRank, lowerDefenseIsBetter = true }) => {
  // Determine advantage based on matchup
  const offenseAdvantage = lowerDefenseIsBetter ? 
    offenseStat > defenseStat : offenseStat < defenseStat;
  
  // Enhanced color coding function
  const getRankColor = (rank, isOffense = true) => {
    if (rank <= 5) return isOffense ? '#10b981' : '#ef4444';
    if (rank <= 10) return isOffense ? '#22c55e' : '#f97316';
    if (rank <= 15) return '#eab308';
    if (rank <= 20) return isOffense ? '#f97316' : '#22c55e';
    return isOffense ? '#ef4444' : '#10b981';
  };
  
  const getRankBadgeClass = (rank, isOffense = true) => {
    if (rank <= 10 && isOffense) return 'advantage-good';
    if (rank > 15 && !isOffense) return 'advantage-good';
    if (rank > 20 && isOffense) return 'advantage-bad';
    if (rank <= 10 && !isOffense) return 'advantage-bad';
    return 'advantage-neutral';
  };
  
  return (
    <div className="matchup-stat-card">
      {/* Advantage Indicator */}
      <div className={`advantage-indicator ${offenseAdvantage ? 'strong' : 'weak'}`}>
        {offenseAdvantage ? '⚡' : '🛡️'}
      </div>
      
      {/* Title */}
      <h3 className="stat-title">{title}</h3>
      
      {/* Team Labels */}
      <div className="team-comparison-row">
        <span className="team-label">{offenseTeam.name} OFF</span>
        <span className="vs-separator">vs</span>
        <span className="team-label">{defenseTeam.name} DEF</span>
      </div>
      
      {/* Stat Values */}
      <div className="team-comparison-row" style={{ marginBottom: '20px' }}>
        <span className="stat-value" data-value={typeof offenseStat === 'number' ? offenseStat.toFixed(1) : offenseStat}>
          {typeof offenseStat === 'number' ? offenseStat.toFixed(1) : offenseStat}
        </span>
        <span className="vs-separator">vs</span>
        <span className="stat-value" data-value={typeof defenseStat === 'number' ? defenseStat.toFixed(1) : defenseStat}>
          {typeof defenseStat === 'number' ? defenseStat.toFixed(1) : defenseStat}
        </span>
      </div>
      
      {/* Rank Badges */}
      <div className="team-comparison-row">
        <span className={`rank-badge ${getRankBadgeClass(offenseRank, true)}`}>
          #{offenseRank}
        </span>
        <div style={{ flex: 1 }}></div>
        <span className={`rank-badge ${getRankBadgeClass(defenseRank, false)}`}>
          #{defenseRank}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="stat-comparison-bar">
        <div 
          className="comparison-fill" 
          style={{ 
            width: offenseAdvantage ? '65%' : '35%',
            background: offenseAdvantage 
              ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
          }}
        ></div>
        <div className="comparison-markers">
          <div className="comparison-marker center"></div>
        </div>
      </div>
    </div>
  );
};

const VisualizationSection = ({ teamA, teamB }) => {
  const chartStats = [
    { key: 'ppg', label: 'PPG' },
    { key: 'fg_pct', label: 'FG%' },
    { key: 'three_p_pct', label: '3P%' },
    { key: 'ast_pg', label: 'AST' },
    { key: 'reb_pg', label: 'REB' },
    { key: 'def_rtg', label: 'DEF RTG' }
  ];

  return (
    <div className="visualization-section">
      <Container>
        <h2 className="visualization-title">Advanced Analytics</h2>
        <Row>
          <Col lg={6} className="mb-4">
            <MatchupChart 
              type="performance-trends" 
              teamA={teamA} 
              teamB={teamB} 
            />
          </Col>
          <Col lg={6} className="mb-4">
            <MatchupChart 
              type="team-strengths" 
              teamA={teamA} 
              teamB={teamB} 
            />
          </Col>
        </Row>
        <Row>
          <Col lg={12} className="mb-4">
            <MatchupChart 
              type="stat-comparison" 
              teamA={teamA} 
              teamB={teamB} 
              stats={chartStats}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
};

const TeamMatchupPage = () => {
  const [selectedTeamA] = useState('lakers');
  const [selectedTeamB] = useState('warriors');
  const [perspective, setPerspective] = useState('AvsB'); // 'AvsB' or 'BvsA'
  const navigate = useNavigate();

  const teamA = mockTeamData[selectedTeamA];
  const teamB = mockTeamData[selectedTeamB];

  return (
    <div className="team-matchup-page game-log-filter">
      <Container>
        {/* Back to Home Button */}
        <div style={{ marginBottom: '20px' }}>
          <Button 
            variant="outline-warning" 
            onClick={() => navigate('/')}
            style={{
              borderColor: '#f59e0b',
              color: '#f59e0b',
              backgroundColor: 'transparent',
              borderWidth: '2px',
              fontWeight: '600',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f59e0b';
              e.target.style.color = '#000000';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#f59e0b';
            }}
          >
            ← Back to Home
          </Button>
        </div>

        <div className="dark-card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            {/* Clean Team vs Team Header */}
            <div className="team-matchup-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
              <Row className="align-items-center">
                <Col md={4} className="text-center">
                  <div className="team-info">
                    <div 
                      className="team-logo" 
                      style={{ 
                        width: '80px', 
                        height: '80px', 
                        borderRadius: '50%', 
                        border: `3px solid ${teamA.color}`, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '1.2rem', 
                        fontWeight: '700', 
                        color: '#ffffff', 
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        marginBottom: '12px'
                      }}
                    >
                      {teamA.abbreviation}
                    </div>
                    <h3 style={{ color: '#ffffff', fontSize: '1.1rem', marginBottom: '8px' }}>{teamA.name}</h3>
                    <div style={{ color: '#cccccc', fontSize: '0.9rem' }}>{teamA.record} ({(teamA.winPct * 100).toFixed(1)}%)</div>
                  </div>
                </Col>
                <Col md={4} className="text-center">
                  <div className="vs-section">
                    <h2 style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: '800', margin: '0' }}>VS</h2>
                    <div style={{ color: '#aaaaaa', fontSize: '0.85rem', marginTop: '8px' }}>
                      <div>{mockGameInfo.date}</div>
                      <div>{mockGameInfo.time}</div>
                    </div>
                  </div>
                </Col>
                <Col md={4} className="text-center">
                  <div className="team-info">
                    <div 
                      className="team-logo" 
                      style={{ 
                        width: '80px', 
                        height: '80px', 
                        borderRadius: '50%', 
                        border: `3px solid ${teamB.color}`, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '1.2rem', 
                        fontWeight: '700', 
                        color: '#ffffff', 
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        marginBottom: '12px'
                      }}
                    >
                      {teamB.abbreviation}
                    </div>
                    <h3 style={{ color: '#ffffff', fontSize: '1.1rem', marginBottom: '8px' }}>{teamB.name}</h3>
                    <div style={{ color: '#cccccc', fontSize: '0.9rem' }}>{teamB.record} ({(teamB.winPct * 100).toFixed(1)}%)</div>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Enhanced Toggle */}
            <div className="matchup-toggle">
              <button 
                className={`toggle-button ${perspective === 'AvsB' ? 'active' : ''}`}
                onClick={() => setPerspective('AvsB')}
              >
                {teamA.abbreviation} OFF vs {teamB.abbreviation} DEF
              </button>
              <button 
                className={`toggle-button ${perspective === 'BvsA' ? 'active' : ''}`}
                onClick={() => setPerspective('BvsA')}
              >
                {teamB.abbreviation} OFF vs {teamA.abbreviation} DEF
              </button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              {perspective === 'AvsB' ? (
                <>
                  <OffenseVsDefenseCard 
                    title="Points"
                    offenseTeam={{ name: teamA.abbreviation }}
                    defenseTeam={{ name: teamB.abbreviation }}
                    offenseStat={teamA.stats.ppg}
                    defenseStat={teamB.stats.opp_ppg}
                    offenseRank={teamA.stats.ppg_rank}
                    defenseRank={teamB.stats.opp_ppg_rank}
                    lowerDefenseIsBetter={true}
                  />
                  <OffenseVsDefenseCard 
                    title="Field Goal %"
                    offenseTeam={{ name: teamA.abbreviation }}
                    defenseTeam={{ name: teamB.abbreviation }}
                    offenseStat={teamA.stats.fg_pct * 100}
                    defenseStat={teamB.stats.def_rtg}
                    offenseRank={teamA.stats.fg_pct_rank}
                    defenseRank={teamB.stats.def_rtg_rank}
                    lowerDefenseIsBetter={true}
                  />
                  <OffenseVsDefenseCard 
                    title="Assists"
                    offenseTeam={{ name: teamA.abbreviation }}
                    defenseTeam={{ name: teamB.abbreviation }}
                    offenseStat={teamA.stats.ast_pg}
                    defenseStat={teamB.stats.stl_pg}
                    offenseRank={teamA.stats.ast_pg_rank}
                    defenseRank={teamB.stats.stl_pg_rank}
                    lowerDefenseIsBetter={false}
                  />
                </>
              ) : (
                <>
                  <OffenseVsDefenseCard 
                    title="Points"
                    offenseTeam={{ name: teamB.abbreviation }}
                    defenseTeam={{ name: teamA.abbreviation }}
                    offenseStat={teamB.stats.ppg}
                    defenseStat={teamA.stats.opp_ppg}
                    offenseRank={teamB.stats.ppg_rank}
                    defenseRank={teamA.stats.opp_ppg_rank}
                    lowerDefenseIsBetter={true}
                  />
                  <OffenseVsDefenseCard 
                    title="Field Goal %"
                    offenseTeam={{ name: teamB.abbreviation }}
                    defenseTeam={{ name: teamA.abbreviation }}
                    offenseStat={teamB.stats.fg_pct * 100}
                    defenseStat={teamA.stats.def_rtg}
                    offenseRank={teamB.stats.fg_pct_rank}
                    defenseRank={teamA.stats.def_rtg_rank}
                    lowerDefenseIsBetter={true}
                  />
                  <OffenseVsDefenseCard 
                    title="Assists"
                    offenseTeam={{ name: teamB.abbreviation }}
                    defenseTeam={{ name: teamA.abbreviation }}
                    offenseStat={teamB.stats.ast_pg}
                    defenseStat={teamA.stats.stl_pg}
                    offenseRank={teamB.stats.ast_pg_rank}
                    defenseRank={teamA.stats.stl_pg_rank}
                    lowerDefenseIsBetter={false}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default TeamMatchupPage;