import { useState } from 'react';
import { Row, Col, Card, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import AppliedFilters from './AppliedFilters';
import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';

const PerformanceAverages = ({ averages, appliedFilters }) => {
  const [activeCategory, setActiveCategory] = useState('Shooting');

  const renderCompactPer36 = () => {
    if (!Array.isArray(averages) || averages.length !== 2) {
      return null;
    }

    const [filteredAvg, seasonAvg] = averages;

    if (
      !filteredAvg ||
      !seasonAvg ||
      typeof filteredAvg !== 'object' ||
      typeof seasonAvg !== 'object'
    ) {
      return null;
    }

    // Keep API response objects immutable while deriving the combination stats
    // shown in this view. The backend uses AR (assists + rebounds) as the
    // canonical key; older responses occasionally called it RA.
    const displayFilteredAvg = { ...filteredAvg };
    const displaySeasonAvg = { ...seasonAvg };
    if (displayFilteredAvg.AR === undefined && displayFilteredAvg.RA !== undefined) {
      displayFilteredAvg.AR = displayFilteredAvg.RA;
    }
    if (displaySeasonAvg.AR === undefined && displaySeasonAvg.RA !== undefined) {
      displaySeasonAvg.AR = displaySeasonAvg.RA;
    }

    const calculatePer36 = (stat, minutes) => {
      const statNumber = toFiniteNumber(stat);
      const minutesNumber = toFiniteNumber(minutes);
      if (statNumber === null || minutesNumber === null || minutesNumber === 0) {
        return statNumber === null ? stat : statNumber;
      }
      return (statNumber / minutesNumber) * 36;
    };

    const getStatColor = (filtered, season, statName) => {
      const filteredNumber = toFiniteNumber(filtered);
      const seasonNumber = toFiniteNumber(season);
      if (filteredNumber === null || seasonNumber === null) return '#e8a33d';

      // For plus/minus, higher (more positive) is better, lower (more negative) is worse
      if (statName === 'PLUS_MINUS') {
        const diff = filteredNumber - seasonNumber;
        if (diff > 1) return '#4caf7d'; // Green for better (more positive)
        if (diff < -1) return '#c24e4e'; // Red for worse (more negative)
        return '#9b937f'; // Gray for similar
      }

      // For other stats, use ratio comparison
      if (seasonNumber === 0) return filteredNumber === 0 ? '#9b937f' : '#4caf7d';
      const ratio = filteredNumber / seasonNumber;
      if (ratio > 1.05) return '#4caf7d'; // Green for better
      if (ratio < 0.95) return '#c24e4e'; // Red for worse
      return '#9b937f'; // Gray for similar
    };

    const getComparisonIcon = (filtered, season, statName) => {
      const filteredNumber = toFiniteNumber(filtered);
      const seasonNumber = toFiniteNumber(season);
      if (filteredNumber === null || seasonNumber === null) return '';

      // For plus/minus, use difference comparison
      if (statName === 'PLUS_MINUS') {
        const diff = filteredNumber - seasonNumber;
        if (diff > 1) return '↗';
        if (diff < -1) return '↘';
        return '→';
      }

      // For other stats, use ratio comparison
      if (seasonNumber === 0) return filteredNumber === 0 ? '→' : '↗';
      const ratio = filteredNumber / seasonNumber;
      if (ratio > 1.05) return '↗';
      if (ratio < 0.95) return '↘';
      return '→';
    };

    const CompactStatCard = ({ statName, filteredVal, seasonVal }) => {
      const per36Filtered = calculatePer36(filteredVal, displayFilteredAvg.MIN);
      const per36Season = calculatePer36(seasonVal, displaySeasonAvg.MIN);

      return (
        <div className="compact-stat-card">
          <div className="compact-stat-header">
            <span className="compact-stat-name">{statName}</span>
            <span className="compact-comparison-icon">
              {getComparisonIcon(per36Filtered, per36Season, statName)}
            </span>
          </div>
          <div className="compact-stat-values">
            <div className="compact-versus-row">
              <span
                className="compact-value-filtered"
                style={{ color: getStatColor(per36Filtered, per36Season, statName) }}
              >
                {formatNumber(per36Filtered, 1)}
              </span>
              <span className="compact-versus">vs</span>
              <span className="compact-value-season">{formatNumber(per36Season, 1)}</span>
            </div>
          </div>
        </div>
      );
    };

    // Calculate combination stats if base stats exist
    const hasPRA =
      displayFilteredAvg.PTS !== undefined &&
      displayFilteredAvg.REB !== undefined &&
      displayFilteredAvg.AST !== undefined;
    const hasPR = displayFilteredAvg.PTS !== undefined && displayFilteredAvg.REB !== undefined;
    const hasPA = displayFilteredAvg.PTS !== undefined && displayFilteredAvg.AST !== undefined;
    const hasAR =
      (displayFilteredAvg.AST !== undefined && displayFilteredAvg.REB !== undefined) ||
      displayFilteredAvg.AR !== undefined;

    // Add combination stats to averages if base stats exist
    if (hasPRA) {
      displayFilteredAvg.PRA =
        numericOrZero(displayFilteredAvg.PTS) +
        numericOrZero(displayFilteredAvg.REB) +
        numericOrZero(displayFilteredAvg.AST);
      displaySeasonAvg.PRA =
        numericOrZero(displaySeasonAvg.PTS) +
        numericOrZero(displaySeasonAvg.REB) +
        numericOrZero(displaySeasonAvg.AST);
    }
    if (hasPR) {
      displayFilteredAvg.PR =
        numericOrZero(displayFilteredAvg.PTS) + numericOrZero(displayFilteredAvg.REB);
      displaySeasonAvg.PR =
        numericOrZero(displaySeasonAvg.PTS) + numericOrZero(displaySeasonAvg.REB);
    }
    if (hasPA) {
      displayFilteredAvg.PA =
        numericOrZero(displayFilteredAvg.PTS) + numericOrZero(displayFilteredAvg.AST);
      displaySeasonAvg.PA =
        numericOrZero(displaySeasonAvg.PTS) + numericOrZero(displaySeasonAvg.AST);
    }
    if (displayFilteredAvg.AST !== undefined && displayFilteredAvg.REB !== undefined) {
      displayFilteredAvg.AR =
        numericOrZero(displayFilteredAvg.AST) + numericOrZero(displayFilteredAvg.REB);
      displaySeasonAvg.AR =
        numericOrZero(displaySeasonAvg.AST) + numericOrZero(displaySeasonAvg.REB);
    }

    const allStats = Object.keys(displayFilteredAvg).filter((key) => key !== 'MIN' && key !== 'PF');

    // Consolidated stat categories with subcategories
    const statCategories = {
      Shooting: {
        Scoring: ['PTS'],
        'Field Goals': ['FGM', 'FGA', 'FG_PCT'],
        'Two-Point': ['FG2M', 'FG2A', 'FG2_PCT'],
        'Three-Point': ['FG3M', 'FG3A', 'FG3_PCT'],
        'Free Throws': ['FTM', 'FTA', 'FT_PCT'],
      },
      'Reb/Ast': {
        Rebounds: ['OREB', 'DREB', 'REB'],
        Playmaking: ['AST', 'TOV'],
      },
      Defense: {
        Defense: ['STL', 'BLK', 'STKS'],
      },
      Combo: {
        Combinations: ['PRA', 'PR', 'PA', 'AR'].filter(
          (stat) =>
            (stat === 'PRA' && hasPRA) ||
            (stat === 'PR' && hasPR) ||
            (stat === 'PA' && hasPA) ||
            (stat === 'AR' && hasAR),
        ),
      },
      Misc: {
        Other: allStats.filter(
          (stat) =>
            ![
              'PTS',
              'FGM',
              'FGA',
              'FG_PCT',
              'FG2M',
              'FG2A',
              'FG2_PCT',
              'FG3M',
              'FG3A',
              'FG3_PCT',
              'FTM',
              'FTA',
              'FT_PCT',
              'OREB',
              'DREB',
              'REB',
              'AST',
              'TOV',
              'STL',
              'BLK',
              'STKS',
              'PRA',
              'PR',
              'PA',
              'RA',
              'AR',
            ].includes(stat),
        ),
      },
    };

    // Get subcategories for active category
    const activeSubcategories = statCategories[activeCategory] || {};

    const renderSubcategory = (subcategoryName, subcategoryStats) => {
      const filteredStats = subcategoryStats.filter(
        (stat) => displayFilteredAvg[stat] !== undefined,
      );
      if (filteredStats.length === 0) return null;

      return (
        <div key={subcategoryName} className="stat-subcategory">
          <h6 className="subcategory-heading">{subcategoryName}</h6>
          <div className="subcategory-stats">
            {filteredStats.map((stat) => (
              <CompactStatCard
                key={stat}
                statName={stat}
                filteredVal={displayFilteredAvg[stat]}
                seasonVal={displaySeasonAvg[stat]}
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
            {Object.keys(statCategories).map((categoryName) => (
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
            renderSubcategory(subcategoryName, subcategoryStats),
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
