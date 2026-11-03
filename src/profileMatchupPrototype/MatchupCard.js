/*
 * PROTOTYPE (throwaway). The Player Profile body drawn as the MCP get_matchup card:
 * F is the whole sheet with its own market tiles; G is trimmed and reads its
 * market from the game logs' Line Type.
 */
import { useMemo, useState } from 'react';
import { useMatchup } from './read';
import { drawCard, drawCardG, toCard } from './cardPort';
import './card.css';

/* The Log Workspace's Line Type (filterUtils.lineTypeOptions) as a Matchup market.
   FD_PTS and None have none. */
const LINE_TYPE_MARKET = { FG3M: '3PM', FD_PTS: null, None: null };
const marketFor = (lineType) =>
  lineType in LINE_TYPE_MARKET ? LINE_TYPE_MARKET[lineType] : lineType;

const MatchupCard = ({ playerName, opponent, variant, lineType }) => {
  const [tileMarket, setTileMarket] = useState('PTS');
  const [open, setOpen] = useState(() => new Set());
  const state = useMatchup(playerName, opponent);
  const card = useMemo(
    () => (state.data ? toCard(state.data, opponent) : null),
    [state.data, opponent],
  );
  if (state.loading) return <p>Loading data...</p>;
  if (state.error) return <p className="text-danger">{state.error}</p>;
  let html;
  if (variant === 'F') html = drawCard(card, tileMarket);
  else {
    const wanted = marketFor(lineType);
    const scored = wanted && card.markets.some((m) => m.market === wanted && m.season);
    const label =
      lineType === 'FD_PTS' ? 'FanDuel points' : lineType === 'None' ? 'No line type' : lineType;
    const note = scored
      ? ''
      : lineType === 'None'
        ? 'PTS shown; no Line Type is selected'
        : `PTS shown; ${label} has no Matchup Score`;
    html = drawCardG(card, scored ? wanted : 'PTS', { note, open });
  }
  return (
    <div
      className="mcc"
      data-market-shown={variant}
      onClick={(event) => {
        const tile = event.target.closest?.('[data-market]');
        if (tile) setTileMarket(tile.dataset.market);
        const more = event.target.closest?.('[data-more]');
        if (more) {
          const next = new Set(open);
          if (next.has(more.dataset.more)) next.delete(more.dataset.more);
          else next.add(more.dataset.more);
          setOpen(next);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MatchupCard;
