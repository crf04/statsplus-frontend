import React, { useState } from 'react';
import { Button, TextField } from '@mui/material';

function PlayersOnOffSection({ playersOn, setPlayersOn, playersOff, setPlayersOff }) {
  const [playerOn, setPlayerOn] = useState('');
  const [playerOff, setPlayerOff] = useState('');

  const handleAddPlayerOn = () => {
    if (playerOn) {
      setPlayersOn((prev) => [...prev, playerOn]);
      setPlayerOn('');
    }
  };

  const handleAddPlayerOff = () => {
    if (playerOff) {
      setPlayersOff((prev) => [...prev, playerOff]);
      setPlayerOff('');
    }
  };

  return (
    <div>
      <TextField value={playerOn} onChange={(e) => setPlayerOn(e.target.value)} label="Player ON" />
      <Button onClick={handleAddPlayerOn}>Add Player ON</Button>
      <TextField value={playerOff} onChange={(e) => setPlayerOff(e.target.value)} label="Player OFF" />
      <Button onClick={handleAddPlayerOff}>Add Player OFF</Button>
    </div>
  );
}

export default PlayersOnOffSection;
