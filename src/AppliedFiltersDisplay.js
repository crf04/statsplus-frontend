import React from 'react';
import { Badge, Button } from 'react-bootstrap';

const AppliedFiltersDisplay = ({ filters, onRemoveFilter }) => {
  if (!filters || Object.keys(filters).length === 0) {
    return null;
  }

  const renderFilterValue = (key, value) => {
    if (key === 'players_on' || key === 'players_off') {
      return value.map((player, index) => (
        <Badge 
          key={index} 
          bg={key === 'players_on' ? 'success' : 'danger'} 
          className="me-1 mb-1 p-2"
        >
          {player} ({key === 'players_on' ? 'ON' : 'OFF'})
          {onRemoveFilter && (
            <Button 
              variant="link" 
              size="sm" 
              className="text-light p-0 ms-2" 
              onClick={() => onRemoveFilter(key, player)}
            >
              ×
            </Button>
          )}
        </Badge>
      ));
    } else if (key === 'teams_against') {
      return value.map((filter, index) => (
        <Badge key={index} bg="primary" className="me-1 mb-1 p-2">
          {filter} ({filters.filter_numbers[index]})
          {onRemoveFilter && (
            <Button 
              variant="link" 
              size="sm" 
              className="text-light p-0 ms-2" 
              onClick={() => onRemoveFilter(key, index)}
            >
              ×
            </Button>
          )}
        </Badge>
      ));
    } else if (Array.isArray(value)) {
      return value.join('-');
    } else if (typeof value === 'object' && value !== null) {
      return `${value[0]} - ${value[1]}`;
    }
    return value;
  };

  return (
    <div className="bg-light p-3 rounded mb-4">
      <div className="d-flex flex-wrap gap-2">
        {Object.entries(filters).map(([key, value]) => {
          if (value && value !== 'None' && value !== 'Both' && value !== '0,48' && value !== '75,125' && key !== 'filter_numbers' && key !== 'player name') {
            if (key === 'players_on' || key === 'players_off' || key === 'teams_against') {
              return (
                <div key={key} className="mb-2">
                  <strong>{key.replace('_', ' ').charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}:</strong>
                  <div className="mt-1">
                    {renderFilterValue(key, value)}
                  </div>
                </div>
              );
            } else {
              return (
                <Badge key={key} bg="secondary" className="p-2 d-flex align-items-center">
                  <span className="fw-bold">{renderFilterValue(key, value)}</span>
                  {onRemoveFilter && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-light p-0 ms-2"
                      onClick={() => onRemoveFilter(key)}
                    >
                      ×
                    </Button>
                  )}
                </Badge>
              );
            }
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default AppliedFiltersDisplay;