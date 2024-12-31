import axios from 'axios';

export const lineTypeOptions = [
  'None', 'PTS',  'FD_PTS', 'PRA', 'PA', 'RA', 'PR', 'AST', 'REB', 'FTM', 'STKS','FG3M', 'FG3A','FG2M','FG2A','FGM','FGA','TO'
];

export const defensiveOptions = [
  'None', 'C&S 3s', 'C&S PTS', 'C&S 3A','PU 2s', 'PU 3s', 'PU PTS', 'Less Than 10 ft', 
  'PRRollMan', 'PRBallHandler', 'Spotup', 'Transition', 'OPP_PTS', 
  'OPP_REB', 'OPP_AST', 'OPP_STOCKS','AtRimAssists','TwoPtAssists','ThreePtAssists'
];

export const RankCube = ({ rank }) => {
  const getColorForRank = (rank) => {
    const normalizedRank = (rank - 1) / 29;
    const red = Math.round(255 * (1 - normalizedRank));
    const green = Math.round(255 * normalizedRank);
    return `rgb(${red}, ${green}, 0)`;
  };

  const cubeStyle = {
    width: '30px',
    height: '30px',
    backgroundColor: getColorForRank(rank),
    color: rank > 15 ? 'black' : 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    borderRadius: '4px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    marginLeft: '10px',
  };

  return <div style={cubeStyle}>{rank}</div>;
};

export const fetchUnfilteredGameLogs = (selectedPlayer, setGameLogs, setAverages, setInitialGameLogs, setSelectedTeam) => {
  if (selectedPlayer === "None") {
    setGameLogs([]);
    setAverages([]);
    setSelectedTeam('');
  }
  if (selectedPlayer && selectedPlayer !== 'None') {
    axios.get('http://127.0.0.1:5000/api/games/game_logs', {
      params: {
        player_name: selectedPlayer,
      }
    })
    .then(response => {
      const { game_logs, averages, season_averages, next_game } = response.data;
      setGameLogs(JSON.parse(game_logs).reverse());
      setInitialGameLogs(JSON.parse(game_logs).reverse());
      setAverages([JSON.parse(averages)[0], JSON.parse(season_averages)[0]]);
      setSelectedTeam(next_game);
    })
    .catch(error => {
      console.error('There was an error fetching the unfiltered game logs!', error);
    });
  }
};
export const fetchGameLogs = (params, setGameLogs, setAverages) => {
  axios.get('http://127.0.0.1:5000/api/games/game_logs', { params })
    .then(response => {
      const { game_logs, averages, season_averages } = response.data;
      setGameLogs(JSON.parse(game_logs).reverse());
      setAverages([JSON.parse(averages)[0], JSON.parse(season_averages)[0]]);
    })
    .catch(error => {
      console.error('There was an error fetching the game logs!', error);
    });
};