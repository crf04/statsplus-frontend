import React from 'react';
import { Badge } from 'react-bootstrap';

const AppliedFilters = ({ filters }) => {
  const defaultValues = {
    minutes_filter: '0,48',
    location_filter: 'Both',
    playstyle_RTG_min: 75,
    playstyle_RTG_max: 125,
  };

  const renderFilterBadge = (key, value) => {
    // Check if the value is different from the default
    if (key in defaultValues && value === defaultValues[key]) {
      return null;
    }

    if (key === 'teams_against' && filters.filter_numbers) {
      return filters.teams_against.map((team, index) => (
        <Badge key={`${key}-${index}`} bg="primary" className="m-1">
          {`${team} (${filters.filter_numbers[index]})`}
        </Badge>
      ));
    } else if (key === 'player_name') {
  
    } else if (key === 'date_filter'){
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`Date >= ${value}`}
        </Badge>
      );
    } else if (key === 'game_filter') {
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`Games_Shown <= ${value}`}
        </Badge>
      );
    } else if (key === 'players_on') {
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`(ON) ${value}`}
        </Badge>
      );
    } else if (key === 'players_off') {
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`(OFF) ${value}`}
        </Badge>
      );
    }
    else if (key.startsWith('self_filters[')) {
      const stat = key.match(/\[(.*?)\]/)[1];
      const [min, max] = value.split(',');
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`${min} <= PLAYER_${stat} <= ${max}`}
        </Badge>
      );
    } else if (key === 'location_filter') {
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`Location: ${value}`}
        </Badge>
      );
    } else if (key === 'minutes_filter') {
      return (
        <Badge key={key} bg="primary" className="m-1">
          {`${value.split(',')[0]} <= MIN <= ${value.split(',')[1]}`}
        </Badge>
      );
    }
    return null;
  };

  const playstyleMin = filters.playstyle_RTG_min;
  const playstyleMax = filters.playstyle_RTG_max;
  const playstyleBadge = (
    (playstyleMin !== defaultValues.playstyle_RTG_min || playstyleMax !== defaultValues.playstyle_RTG_max) && (
      <Badge key="playstyle_RTG" bg="primary" className="m-1">
        {`${playstyleMin} <= PLAYTYPE_RTG <= ${playstyleMax}`}
      </Badge>
    )
  );

  const nonDefaultFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'filter_numbers') return false; // Skip filter_numbers as it's handled with teams_against
    if (key in defaultValues) {
      return value !== defaultValues[key];
    }
    return value && value !== 'null' && (typeof value === 'number' || value.length > 0);
  });

  if (nonDefaultFilters.length === 0) {
    return null;
  }

  return (
    <>
      {nonDefaultFilters.map(([key, value]) => renderFilterBadge(key, value))}
      {playstyleBadge}
    </>
  );
};

export default AppliedFilters;
