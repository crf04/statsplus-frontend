import React, { useState } from 'react';
import { Row, Col, Card, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import AppliedFilters from './AppliedFilters';

const PerformanceAverages = ({ averages, appliedFilters }) => {
  const [activeCategory, setActiveCategory] = useState('Shooting');
  
  const renderCompactPer36 = () => {
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

    const getStatColor = (filtered, season, statName) => {
      if (typeof filtered !== 'number' || typeof season !== 'number') return '#f59e0b';
      
      // For plus/minus, higher (more positive) is better, lower (more negative) is worse
      if (statName === 'PLUS_MINUS') {
        const diff = filtered - season;
        if (diff > 1) return '#10b981'; // Green for better (more positive)
        if (diff < -1) return '#ef4444'; // Red for worse (more negative)
        return '#6b7280'; // Gray for similar
      }
      
      // For other stats, use ratio comparison
      const ratio = filtered / season;
      if (ratio > 1.05) return '#10b981'; // Green for better
      if (ratio < 0.95) return '#ef4444'; // Red for worse
      return '#6b7280'; // Gray for similar
    };

    const getComparisonIcon = (filtered, season, statName) => {
      if (typeof filtered !== 'number' || typeof season !== 'number') return '';
      
      // For plus/minus, use difference comparison
      if (statName === 'PLUS_MINUS') {
        const diff = filtered - season;
        if (diff > 1) return '↗️';
        if (diff < -1) return '↘️';
        return '➡️';
      }
      
      // For other stats, use ratio comparison
      const ratio = filtered / season;
      if (ratio > 1.05) return '↗️';
      if (ratio < 0.95) return '↘️';
      return '➡️';
    };

    const CompactStatCard = ({ statName, filteredVal, seasonVal }) => {
      const per36Filtered = calculatePer36(filteredVal, filteredAvg['MIN']);
      const per36Season = calculatePer36(seasonVal, seasonAvg['MIN']);
      
      return (
        <div className="compact-stat-card">
          <div className="compact-stat-header">
            <span className="compact-stat-name">{statName}</span>
            <span className="compact-comparison-icon">{getComparisonIcon(per36Filtered, per36Season, statName)}</span>
          </div>
          <div className="compact-stat-values">
            <div className="compact-versus-row">
              <span 
                className="compact-value-filtered"
                style={{color: getStatColor(per36Filtered, per36Season, statName)}}
              >
                {typeof per36Filtered === 'number' ? per36Filtered.toFixed(1) : per36Filtered}
              </span>
              <span className="compact-versus">vs</span>
              <span className="compact-value-season">
                {typeof per36Season === 'number' ? per36Season.toFixed(1) : per36Season}
              </span>
            </div>
          </div>
        </div>
      );
    };

    const allStats = Object.keys(filteredAvg).filter(key => key !== 'MIN' && key !== 'PF');
    
    // Calculate combination stats if base stats exist
    const hasPRA = filteredAvg.PTS !== undefined && filteredAvg.REB !== undefined && filteredAvg.AST !== undefined;
    const hasPR = filteredAvg.PTS !== undefined && filteredAvg.REB !== undefined;
    const hasPA = filteredAvg.PTS !== undefined && filteredAvg.AST !== undefined;
    const hasAR = filteredAvg.AST !== undefined && filteredAvg.REB !== undefined;

    // Add combination stats to averages if base stats exist
    if (hasPRA) {
      filteredAvg.PRA = (filteredAvg.PTS || 0) + (filteredAvg.REB || 0) + (filteredAvg.AST || 0);
      seasonAvg.PRA = (seasonAvg.PTS || 0) + (seasonAvg.REB || 0) + (seasonAvg.AST || 0);
    }
    if (hasPR) {
      filteredAvg.PR = (filteredAvg.PTS || 0) + (filteredAvg.REB || 0);
      seasonAvg.PR = (seasonAvg.PTS || 0) + (seasonAvg.REB || 0);
    }
    if (hasPA) {
      filteredAvg.PA = (filteredAvg.PTS || 0) + (filteredAvg.AST || 0);
      seasonAvg.PA = (seasonAvg.PTS || 0) + (seasonAvg.AST || 0);
    }
    if (hasAR) {
      filteredAvg.AR = (filteredAvg.AST || 0) + (filteredAvg.REB || 0);
      seasonAvg.AR = (seasonAvg.AST || 0) + (seasonAvg.REB || 0);
    }

    // Consolidated stat categories with subcategories
    const statCategories = {
      'Shooting': {
        'Scoring': ['PTS'],
        'Field Goals': ['FGM', 'FGA', 'FG_PCT'],
        'Two-Point': ['FG2M', 'FG2A', 'FG2_PCT'],
        'Three-Point': ['FG3M', 'FG3A', 'FG3_PCT'],
        'Free Throws': ['FTM', 'FTA', 'FT_PCT']
      },
      'Reb/Ast': {
        'Rebounds': ['OREB', 'DREB', 'REB'],
        'Playmaking': ['AST', 'TOV']
      },
      'Defense': {
        'Defense': ['STL', 'BLK', 'STKS']
      },
      'Combo': {
        'Combinations': ['PRA', 'PR', 'PA', 'RA'].filter(stat => 
          (stat === 'PRA' && hasPRA) || 
          (stat === 'PR' && hasPR) || 
          (stat === 'PA' && hasPA) || 
          (stat === 'RA' && hasAR)
        )
      },
      'Misc': {
        'Other': allStats.filter(stat => 
          !['PTS', 'FGM', 'FGA', 'FG_PCT', 'FG2M', 'FG2A', 'FG2_PCT', 'FG3M', 'FG3A', 'FG3_PCT', 'FTM', 'FTA', 'FT_PCT', 
            'OREB', 'DREB', 'REB', 'AST', 'TOV', 'STL', 'BLK', 'STKS', 'PRA', 'PR', 'PA', 'RA','AR'].includes(stat)
        )
      }
    };

    // Get subcategories for active category
    const activeSubcategories = statCategories[activeCategory] || {};

    const renderSubcategory = (subcategoryName, subcategoryStats) => {
      const filteredStats = subcategoryStats.filter(stat => filteredAvg[stat] !== undefined);
      if (filteredStats.length === 0) return null;
      
      return (
        <div key={subcategoryName} className="stat-subcategory">
          <h6 className="subcategory-heading">{subcategoryName}</h6>
          <div className="subcategory-stats">
            {filteredStats.map(stat => (
              <CompactStatCard 
                key={stat}
                statName={stat}
                filteredVal={filteredAvg[stat]}
                seasonVal={seasonAvg[stat]}
              />
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="per36-categories">
        {/* Category Toggle Buttons */}
        <div className="category-toggles-wrapper">
          <ToggleButtonGroup 
            type="radio" 
            name="per36-categories" 
            value={activeCategory} 
            onChange={setActiveCategory}
            className="per36-toggle-group"
          >
            {Object.keys(statCategories).map(categoryName => (
              <ToggleButton
                key={categoryName}
                id={`per36-${categoryName.toLowerCase().replace('/', '-')}`}
                value={categoryName}
                variant="outline-primary"
                className="per36-toggle-btn"
              >
                {categoryName}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        
        {/* Active Category with Subcategories */}
        <div className="active-category">
          {Object.entries(activeSubcategories).map(([subcategoryName, subcategoryStats]) => 
            renderSubcategory(subcategoryName, subcategoryStats)
          )}
        </div>
      </div>
    );
  };

  return (
    <Row>
      <Col>
        <Card className="dark-card compact-averages-card">
          <Card.Body className="p-3">
            <h4 className="mb-2">Per 36 Minutes Comparison</h4>
            <span className="legend-text mb-1 d-block text-center">Filtered vs Season</span>
            <div className="mb-2">
              <AppliedFilters filters={appliedFilters || {}} />
            </div>
            {renderCompactPer36()}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default PerformanceAverages;