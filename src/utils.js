export const lineTypeOptions = [
  'None',
  'PTS',
  'FD_PTS',
  'PRA',
  'PA',
  'RA',
  'PR',
  'AST',
  'REB',
  'FTM',
  'FTA',
  'STL',
  'BLK',
  'STKS',
  'FG3M',
  'FG3A',
  'FG2M',
  'FG2A',
  'FGM',
  'FGA',
  'TOV',
];

export const defensiveOptions = [
  'None',
  'C&S 3s',
  'C&S PTS',
  'C&S 3A',
  'PU 2s',
  'PU 3s',
  'PU PTS',
  'Less Than 10 ft',
  'PRRollMan',
  'PRBallHandler',
  'Isolation',
  'Spotup',
  'Transition',
  'OPP_PTS',
  'OPP_REB',
  'OPP_AST',
  'OPP_FTA',
  'OPP_STOCKS',
  'OPP_TOV',
  'AtRimAssists',
  'TwoPtAssists',
  'ThreePtAssists',
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
