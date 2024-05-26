import React, { useState } from 'react';
import { Button, Select, MenuItem, TextField } from '@mui/material';

function FilterSection({ setFilters }) {
  const [selectedFilter, setSelectedFilter] = useState('');
  const [filterValue, setFilterValue] = useState('');

  const handleAddFilter = () => {
    if (selectedFilter && filterValue) {
      setFilters((prevFilters) => [...prevFilters, { filter: selectedFilter, value: filterValue }]);
      setSelectedFilter('');
      setFilterValue('');
    }
  };

  return (
    <div>
      <Select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)}>
        <MenuItem value="None">None</MenuItem>
        <MenuItem value="C&S 3s">C&S 3s</MenuItem>
        <MenuItem value="PU 2s">PU 2s</MenuItem>
        <MenuItem value="PU 3s">PU 3s</MenuItem>
        <MenuItem value="<10 Ft">Within 10 Ft</MenuItem>
        <MenuItem value="PRRollMan">PRRollMan</MenuItem>
        <MenuItem value="PRBallHandler">PRBallHandler</MenuItem>
        <MenuItem value="Spotup">Spotup</MenuItem>
        <MenuItem value="Transition">Transition</MenuItem>
        <MenuItem value="PointsAllowed">Points Allowed</MenuItem>
        <MenuItem value="RebAllowed">Reb Allowed</MenuItem>
        <MenuItem value="AstAllowed">Ast Allowed</MenuItem>
        <MenuItem value="StocksAllowed">Stocks Allowed</MenuItem>
      </Select>
      <TextField value={filterValue} onChange={(e) => setFilterValue(e.target.value)} label="Filter Value" />
      <Button onClick={handleAddFilter}>Add Filter</Button>
    </div>
  );
}

export default FilterSection;
