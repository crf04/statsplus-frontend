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
    color: rank > 15 ? 'var(--ct-on-000000)' : 'var(--ct-on-ffffff)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    borderRadius: '4px',
    boxShadow: '0 2px 5px var(--ct-shadow-20)',
    marginLeft: '10px',
  };

  return <div style={cubeStyle}>{rank}</div>;
};
