import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FilterSection from '../components/FilterSection';
import PlayersOnOffSection from '../components/PlayersOnOffSection';
import DataVisualization from '../components/DataVisualization';
import { TextField, Button, Select, MenuItem, Slider, ToggleButton, ToggleButtonGroup } from '@mui/material';

function TeamStats() {
  const [filters, setFilters] = useState([]);
  const [playersOn, setPlayersOn] = useState([]);
  const [playersOff, setPlayersOff] = useState([]);
  const [data, setData] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [lineType, setLineType] = useState('None');
  const [lineValue, setLineValue] = useState(0);
  const [minutes, setMinutes] = useState([0, 48]);
  const [date, setDate] = useState(null);
  const [games, setGames] = useState(0);
  const [location, setLocation] = useState('Both');
  const [defensiveFilter, setDefensiveFilter] = useState('None');
  const [topTeams, setTopTeams] = useState(0);

  useEffect(() => {
    fetchData();
  }, [filters, playersOn, playersOff, selectedPlayer, lineType, lineValue, minutes, date, games, location, defensiveFilter, topTeams]);

  const fetchData = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/filter_teams', {
        params: { filters, playersOn, playersOff, selectedPlayer, lineType, lineValue, minutes, date, games, location, defensiveFilter, topTeams },
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div>
      <h1>Team Stats</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <TextField label="Player" value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} />
          <Select value={lineType} onChange={(e) => setLineType(e.target.value)}>
            <MenuItem value="None">None</MenuItem>
            <MenuItem value="PTS">PTS</MenuItem>
            <MenuItem value="FG3M">FG3M</MenuItem>
            <MenuItem value="FD_PTS">FD_PTS</MenuItem>
            <MenuItem value="PRA">PRA</MenuItem>
            <MenuItem value="PA">PA</MenuItem>
            <MenuItem value="RA">RA</MenuItem>
            <MenuItem value="PR">PR</MenuItem>
            <MenuItem value="AST">AST</MenuItem>
            <MenuItem value="REB">REB</MenuItem>
            <MenuItem value="FG3A">FG3A</MenuItem>
            <MenuItem value="FTM">FTM</MenuItem>
            <MenuItem value="FGA">FGA</MenuItem>
            <MenuItem value="STOCKS">STOCKS</MenuItem>
          </Select>
          <TextField label="Line Value" type="number" value={lineValue} onChange={(e) => setLineValue(e.target.value)} />
          <Slider value={minutes} onChange={(e, newValue) => setMinutes(newValue)} valueLabelDisplay="auto" min={0} max={48} />
          <TextField label="On/After Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Last N Games" type="number" value={games} onChange={(e) => setGames(e.target.value)} />
        </div>
        <div>
          <PlayersOnOffSection playersOn={playersOn} setPlayersOn={setPlayersOn} playersOff={playersOff} setPlayersOff={setPlayersOff} />
        </div>
        <div>
          <ToggleButtonGroup value={location} exclusive onChange={(e, newValue) => setLocation(newValue)}>
            <ToggleButton value="Both">Both</ToggleButton>
            <ToggleButton value="Home">Home</ToggleButton>
            <ToggleButton value="Away">Away</ToggleButton>
          </ToggleButtonGroup>
          <Select value={defensiveFilter} onChange={(e) => setDefensiveFilter(e.target.value)}>
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
          <TextField label="Top X Teams" type="number" value={topTeams} onChange={(e) => setTopTeams(e.target.value)} />
          <Button onClick={fetchData}>Add Filter</Button>
        </div>
      </div>
      <DataVisualization data={data} />
    </div>
  );
}

export default TeamStats;
