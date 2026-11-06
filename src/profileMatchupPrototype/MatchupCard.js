/*
 * PROTOTYPE (throwaway). The Player Profile body drawn as the MCP get_matchup card:
 * F is the whole sheet with its own market tiles; G is trimmed and reads its
 * market from the game logs' Line Type.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMatchup } from './read';
import { lineTypeOptions } from '../filterUtils';
import { drawCard, drawCardG, drawCardH, drawCardS, toCard } from './cardPort';
import './card.css';

/* The Log Workspace's Line Type (filterUtils.lineTypeOptions) as a Matchup market.
   FD_PTS and None have none. */
const LINE_TYPE_MARKET = { FG3M: '3PM', FD_PTS: null, None: null };
const marketFor = (lineType) =>
  lineType in LINE_TYPE_MARKET ? LINE_TYPE_MARKET[lineType] : lineType;

/* On a phone the card has no neighbour to match, so a combo sheet may be as tall as the S4
   single-market (PTS) sheet measured at 390px: 640px. */
const PHONE_BUDGET = 640;

/* The room the W3 sheet has: on desktop, the Opposing Team Profile's natural height (the row
   is as tall as its tallest card) less this card's own chrome above and below the sheet. */
const sheetBudget = (sheet) => {
  const card = sheet.closest('.dark-card');
  const row = card && card.closest('.row');
  const neighbour = row && [...row.querySelectorAll('.dark-card')].find((c) => c !== card);
  const top = (el) => el.getBoundingClientRect().top;
  if (!card || !neighbour || Math.abs(top(neighbour) - top(card)) > 4) return PHONE_BUDGET;
  const natural = (c) => {
    const body = c.querySelector('.card-body') || c;
    const last = body.lastElementChild;
    const cs = getComputedStyle(body);
    const outer = getComputedStyle(c);
    return (
      (last ? last.getBoundingClientRect().bottom : top(body)) -
      top(c) +
      parseFloat(cs.paddingBottom) +
      parseFloat(outer.borderBottomWidth)
    );
  };
  const below = natural(card) - sheet.getBoundingClientRect().bottom + top(card);
  const above = top(sheet) - top(card);
  return natural(neighbour) - above - below;
};

const MatchupCard = ({ playerName, opponent, variant, lineType, combo, onLineType }) => {
  const [tileMarket, setTileMarket] = useState('PTS');
  const [open, setOpen] = useState(() => new Set());
  // W3 groups the fit expanded, and whether the user has taken over.
  const [fitted, setFitted] = useState(() => new Set());
  const [touched, setTouched] = useState(false);
  const [tick, setTick] = useState(0);
  const ref = useRef(null);
  const state = useMatchup(playerName, opponent);
  const card = useMemo(
    () => (state.data ? toCard(state.data, opponent) : null),
    [state.data, opponent],
  );

  let html = '';
  if (card) {
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
      const shown = scored ? wanted : 'PTS';
      const effective = new Set([...open, ...[...fitted].map((k) => `fit${k}`)]);
      // The picker lists the Line Types that have a Matchup Score, in the Line Type select's order.
      const picker = onLineType
        ? {
            value: scored ? lineType : 'PTS',
            options: lineTypeOptions
              .filter((lt) => {
                const mk = marketFor(lt);
                return mk && card.markets.some((m) => m.market === mk && m.season);
              })
              .map((lt) => ({ value: lt, label: marketFor(lt) })),
          }
        : null;
      html =
        variant === 'G'
          ? drawCardG(card, shown, { note, open })
          : variant.startsWith('S')
            ? drawCardS(card, shown, { note, open: effective, mode: variant, combo, picker })
            : drawCardH(card, shown, { note, open, mode: variant });
    }
  }

  // A new market or player starts the fit over.
  useEffect(() => {
    setFitted(new Set());
    setTouched(false);
    setOpen(new Set());
  }, [lineType, playerName, combo, variant]);

  const ready = html !== '';
  // The picker lives in innerHTML, where React's change event resolves to this div rather than
  // the select, so it gets a native listener. It writes the game logs' Line Type and nothing else.
  useEffect(() => {
    const sheet = ref.current;
    if (!sheet || !onLineType) return undefined;
    const onChange = (event) => {
      if (event.target.matches && event.target.matches('[data-market-select]'))
        onLineType(event.target.value);
    };
    sheet.addEventListener('change', onChange);
    return () => sheet.removeEventListener('change', onChange);
  }, [ready, onLineType]);
  // Re-fit when the window or the neighbouring card changes size.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('resize', bump);
    const row = ref.current && ref.current.closest('.row');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(bump) : null;
    if (ro && row) row.querySelectorAll('.dark-card .card-body').forEach((el) => ro.observe(el));
    return () => {
      window.removeEventListener('resize', bump);
      if (ro) ro.disconnect();
    };
  }, [ready]);

  // Fit: from the compact sheet, open whole groups in display order while the sheet still fits.
  useLayoutEffect(() => {
    const sheet = ref.current;
    if (!sheet || touched) return;
    const groups = [...sheet.querySelectorAll('.w3g[data-grp]')];
    if (!groups.length) return;
    const rowEl = sheet.querySelector('.w3b');
    const moreEl = sheet.querySelector('.w3more');
    const rowH = rowEl ? rowEl.getBoundingClientRect().height : 0;
    const moreH = moreEl ? moreEl.getBoundingClientRect().height : 0;
    if (!rowH) return;
    const extra = (g) =>
      (Number(g.dataset.bases) - 1) * rowH - (Number(g.dataset.bases) > 1 ? moreH : 0);
    // The sheet as it would be with every group compact.
    let height =
      sheet.getBoundingClientRect().height -
      groups.filter((g) => fitted.has(g.dataset.grp)).reduce((sum, g) => sum + extra(g), 0);
    const budget = sheetBudget(sheet);
    const next = new Set();
    groups.forEach((g) => {
      if (Number(g.dataset.bases) < 2) return;
      if (height + extra(g) <= budget + 0.5) {
        next.add(g.dataset.grp);
        height += extra(g);
      }
    });
    const same = next.size === fitted.size && [...next].every((k) => fitted.has(k));
    if (!same) setFitted(next);
    sheet.dataset.fitBudget = String(Math.round(budget));
  });
  void tick;

  if (state.loading) return <p>Loading data...</p>;
  if (state.error) return <p className="text-danger">{state.error}</p>;
  return (
    <div
      ref={ref}
      className="mcc"
      data-market-shown={variant}
      onClick={(event) => {
        const tile = event.target.closest?.('[data-market]');
        if (tile) setTileMarket(tile.dataset.market);
        const more = event.target.closest?.('[data-more]');
        if (more) {
          event.preventDefault();
          const key = more.dataset.more;
          // The user's choices win from here on: keep what the fit opened, stop re-fitting.
          const base = new Set([...open, ...[...fitted].map((k) => `fit${k}`)]);
          // part: and acc: keys are one-of-a-kind: picking one replaces the last.
          const group = ['part:', 'acc:'].find((g) => key.startsWith(g));
          const next = new Set([...base].filter((k) => !(group && k.startsWith(group))));
          if (base.has(key) && !group) next.delete(key);
          else next.add(key);
          setTouched(true);
          setOpen(next);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MatchupCard;
