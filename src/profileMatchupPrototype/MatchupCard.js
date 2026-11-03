/*
 * PROTOTYPE (throwaway). The Player Profile body drawn as the whole MCP get_matchup card.
 */
import { useMemo, useState } from 'react';
import { useMatchup } from './read';
import { drawCard, toCard } from './cardPort';
import './card.css';

const MatchupCard = ({ playerName, opponent }) => {
  const [market, setMarket] = useState('PTS');
  const state = useMatchup(playerName, opponent);
  const card = useMemo(
    () => (state.data ? toCard(state.data, opponent) : null),
    [state.data, opponent],
  );
  if (state.loading) return <p>Loading data...</p>;
  if (state.error) return <p className="text-danger">{state.error}</p>;
  return (
    <div
      className="mcc"
      onClick={(event) => {
        const tile = event.target.closest?.('[data-market]');
        if (tile) setMarket(tile.dataset.market);
      }}
      dangerouslySetInnerHTML={{ __html: drawCard(card, market) }}
    />
  );
};

export default MatchupCard;
