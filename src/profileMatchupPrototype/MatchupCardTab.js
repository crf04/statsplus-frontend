/*
 * PROTOTYPE (throwaway). One Player Profile tab drawn as the MCP get_matchup card's Base.
 */
import { useMemo, useState } from 'react';
import { TAB_BASES, useMatchup } from './read';
import { drawTab, toCard } from './cardPort';
import './card.css';

const MatchupCardTab = ({ tab, playerName, opponent }) => {
  // Assist locations is in no points market, so its tab opens on AST.
  const [market, setMarket] = useState(tab === 'assists' ? 'AST' : 'PTS');
  const state = useMatchup(playerName, opponent);
  const card = useMemo(
    () => (state.data ? toCard(state.data, opponent) : null),
    [state.data, opponent],
  );
  if (state.loading) return <p>Loading data...</p>;
  if (state.error) return <p className="text-danger">{state.error}</p>;
  const html = drawTab(card, market, TAB_BASES[tab].label);
  return (
    <div
      className="mcc"
      onClick={(event) => {
        const tile = event.target.closest?.('[data-market]');
        if (tile) setMarket(tile.dataset.market);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MatchupCardTab;
