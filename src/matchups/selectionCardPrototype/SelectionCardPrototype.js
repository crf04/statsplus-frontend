/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Three layouts for the selection card body once the Archetype sample is
 * gone. Header, explainer, focal line and stat chips are copied from the
 * shipped SelectionCard so the variants sit in the real card.
 */
import { useEffect, useRef, useState } from 'react';
import { formatFocalGameLine } from '../displayConfig';
import PrototypeSwitcher from './PrototypeSwitcher';
import './prototype.css';

const BASE_LABELS = {
  playTypes: 'Play types',
  shotZones: 'Shot zones',
  shotTypes: 'Shot types',
  assistLocations: 'Assist locations',
  traditional: 'Traditional',
};
const formatPercent = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const formatDelta = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
const WINDOW_LABELS = { season: 'Season', last15: 'Last 15' };

const useRows = (player, windowKey) => {
  const rows = player.statCategories.map((market) => ({
    market,
    score: player.scores[market][windowKey],
  }));
  const bases = [...new Set(rows.flatMap(({ score }) => Object.keys(score.components)))];
  const hasBlend = rows.some(({ score }) => score.blend);
  return { rows, bases, hasBlend };
};

function Cell({ component }) {
  if (!component) return '—';
  return (
    <>
      {formatPercent(component.value)}
      {component.thin && <span className="thin-flag">thin</span>}
    </>
  );
}

function Matrix({ player, rows, bases, hasBlend, activeStat, historical, compact }) {
  return (
    <div className={`selection-table-wrap${compact ? ' proto-matrix-compact' : ''}`}>
      <table aria-label={`${player.name} Score Matrix`}>
        <thead>
          <tr>
            <th scope="col">{historical ? 'Category' : 'Market'}</th>
            {bases.map((base) => (
              <th scope="col" key={base}>
                {BASE_LABELS[base] || base}
              </th>
            ))}
            {hasBlend && <th scope="col">Blend</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ market, score }) => (
            <tr key={market} className={market === activeStat ? 'active-market-row' : undefined}>
              <th scope="row">{market}</th>
              {bases.map((base) => (
                <td key={base}>
                  <Cell component={score.components[base]} />
                </td>
              ))}
              {hasBlend && (
                <td>
                  <Cell component={score.blend} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpponentLog({ table, market, headed }) {
  return (
    <section className="selection-log proto-h2h" aria-label="Games vs this opponent">
      {headed && <h3>Games vs this opponent</h3>}
      {table.thin && <p className="thin-note">Thin sample — interpret cautiously.</p>}
      {table.rows.length === 0 ? (
        <p className="honest-empty">No games vs this opponent data is available.</p>
      ) : (
        <div className="selection-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">MIN</th>
                <th scope="col">{market}</th>
                <th scope="col">±/MIN</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr
                  key={row.date || `average-${index}`}
                  className={row.average ? 'average-row' : undefined}
                >
                  <th scope="row">{row.average ? 'AVG' : `${row.date} · ${row.matchup}`}</th>
                  <td>{row.minutes.toFixed(1)}</td>
                  <td>{row.stats[market].toFixed(1)}</td>
                  <td>{formatDelta(row.deltas[market])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* A — the ask: matrix left, opponent log right, archetype gone. */
function VariantA({ player, rows, bases, hasBlend, activeStat, historical, selection, status }) {
  return (
    <div className="proto-split">
      <Matrix
        player={player}
        rows={rows}
        bases={bases}
        hasBlend={hasBlend}
        activeStat={activeStat}
        historical={historical}
        compact
      />
      <div className="proto-split-log">
        <h3>Games vs this opponent</h3>
        {status === 'loading' && <p role="status">Loading…</p>}
        {status === 'ready' && <OpponentLog table={selection.h2h} market={activeStat} />}
        {status === 'ready' && selection.experience?.samples.excludesFocalGame && (
          <p className="selection-provenance">Games strictly before the focal game.</p>
        )}
      </div>
    </div>
  );
}

/* B — only the active stat's scores as a strip; full matrix folded away. */
function VariantB({ player, rows, bases, hasBlend, activeStat, historical, selection, status }) {
  const active = rows.find(({ market }) => market === activeStat);
  const cells = [
    ...bases.map((base) => ({
      label: BASE_LABELS[base] || base,
      component: active.score.components[base],
    })),
    ...(hasBlend ? [{ label: 'Blend', component: active.score.blend }] : []),
  ];
  return (
    <>
      <dl className="proto-strip" aria-label={`${activeStat} scores`}>
        {cells.map(({ label, component }) => (
          <div key={label} className={label === 'Blend' ? 'proto-strip-blend' : undefined}>
            <dt>{label}</dt>
            <dd>
              <Cell component={component} />
            </dd>
          </div>
        ))}
      </dl>
      {status === 'loading' && <p role="status">Loading selection logs…</p>}
      {status === 'ready' && (
        <div className="proto-b-log">
          <OpponentLog table={selection.h2h} market={activeStat} headed />
          {selection.experience?.samples.excludesFocalGame && (
            <p className="selection-provenance">Games strictly before the focal game.</p>
          )}
        </div>
      )}
      <details className="proto-fold">
        <summary>All {rows.length} categories</summary>
        <Matrix
          player={player}
          rows={rows}
          bases={bases}
          hasBlend={hasBlend}
          activeStat={activeStat}
          historical={historical}
        />
      </details>
    </>
  );
}

/* C — matrix unchanged; the opponent log becomes one line under the chips. */
function VariantC({ player, rows, bases, hasBlend, activeStat, historical, selection, status }) {
  const table = status === 'ready' ? selection.h2h : null;
  const games = table ? table.rows.filter((row) => !row.average) : [];
  const avg = table ? table.rows.find((row) => row.average) : null;
  const opponent = games[0]?.matchup.replace(/^.*(?:vs\.|@)\s*/, '') || 'opponent';
  return (
    <>
      <div className="proto-line" aria-label="Games vs this opponent">
        {status === 'loading' && <span role="status">Loading games vs opponent…</span>}
        {table && games.length === 0 && (
          <span className="honest-empty">No games vs this opponent.</span>
        )}
        {table && games.length > 0 && (
          <>
            <span className="proto-line-lead">
              vs {opponent} · {games.length} {games.length === 1 ? 'game' : 'games'}
              {table.thin && <span className="thin-flag">thin</span>}
            </span>
            {avg && (
              <span className="proto-line-avg">
                <b>{avg.stats[activeStat].toFixed(1)}</b> {activeStat} · {avg.minutes.toFixed(1)}{' '}
                MIN
                {' · '}
                {formatDelta(avg.deltas[activeStat])}/min
              </span>
            )}
            <span className="proto-line-games">
              {games.map((row) => (
                <span
                  key={row.date}
                  title={`${row.date} · ${row.matchup} · ${row.minutes.toFixed(1)} MIN`}
                >
                  <small>{row.date.slice(5)}</small> {row.stats[activeStat].toFixed(1)}
                </span>
              ))}
            </span>
          </>
        )}
      </div>
      <Matrix
        player={player}
        rows={rows}
        bases={bases}
        hasBlend={hasBlend}
        activeStat={activeStat}
        historical={historical}
      />
    </>
  );
}

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC };

export default function SelectionCardPrototype({
  variant,
  onStep,
  player,
  selection,
  status,
  error,
  windowKey,
  sheetMarket,
  whyRelevant,
  historical,
  onClose,
}) {
  const panelRef = useRef(null);
  const previousPlayerId = useRef(player.id);
  const previousSheetMarket = useRef(sheetMarket);
  const [activeStat, setActiveStat] = useState(
    player.statCategories.includes(sheetMarket) ? sheetMarket : player.statCategories[0],
  );
  useEffect(() => panelRef.current?.focus(), [player.id]);
  useEffect(() => {
    const playerChanged = previousPlayerId.current !== player.id;
    const sheetMarketChanged = previousSheetMarket.current !== sheetMarket;
    setActiveStat((current) => {
      if (playerChanged) {
        return player.statCategories.includes(sheetMarket) ? sheetMarket : player.statCategories[0];
      }
      if (
        sheetMarketChanged &&
        sheetMarket !== 'All' &&
        player.statCategories.includes(sheetMarket)
      ) {
        return sheetMarket;
      }
      return player.statCategories.includes(current) ? current : player.statCategories[0];
    });
    previousPlayerId.current = player.id;
    previousSheetMarket.current = sheetMarket;
  }, [player.id, player.statCategories, sheetMarket]);
  const { rows, bases, hasBlend } = useRows(player, windowKey);
  const Body = VARIANTS[variant];
  return (
    <section
      ref={panelRef}
      id="matchup-selection-card"
      className={`selection-card proto-card proto-card-${variant}`}
      aria-labelledby="selection-heading"
      tabIndex="-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="selection-card-heading">
        <div>
          <p className="matchup-eyebrow">Selection card</p>
          <h2 id="selection-heading">{player.name}</h2>
        </div>
        <button type="button" className="selection-close" onClick={onClose}>
          Close selection card
        </button>
      </div>
      <p className="selection-explainer">
        {whyRelevant
          ? 'Highlighted Defense Sheet rows show displayed Season Diet Share inputs.'
          : 'This player is not opposing the viewed Defense Sheet, so no why rows are highlighted.'}{' '}
        Scores and deltas are delivered by the API.
        {historical ? ' The Score Matrix reflects completed-season context.' : ''}
      </p>
      {player.focalGameLine && (
        <p className="focal-line">
          {formatFocalGameLine(player.focalGameLine, player.statCategories, { includeDate: true })}
        </p>
      )}
      <div className="selection-stat-control" role="group" aria-label="Selection log stat">
        {player.statCategories.map((market) => (
          <button
            type="button"
            key={market}
            aria-pressed={activeStat === market}
            onClick={() => setActiveStat(market)}
          >
            {market}
          </button>
        ))}
      </div>
      {status === 'error' && <p role="alert">{error}</p>}
      <Body
        player={player}
        rows={rows}
        bases={bases}
        hasBlend={hasBlend}
        activeStat={activeStat}
        historical={historical}
        selection={selection}
        status={status}
      />
      {rows
        .filter(({ score }) => Object.keys(score.components).length === 0 && score.blend === null)
        .map(({ market }) => (
          <p className="honest-empty" key={`degraded-${market}`}>
            No score components were computable for {market} in {WINDOW_LABELS[windowKey]}.
          </p>
        ))}
      {rows
        .filter(({ score }) => score.blend === null && score.missingInputs.length > 0)
        .map(({ market, score }) => (
          <p className="honest-empty" key={`withheld-${market}`}>
            {market} Matchup Score unavailable in {WINDOW_LABELS[windowKey]}: missing{' '}
            {score.missingInputs.join(', ')}.
          </p>
        ))}
      <PrototypeSwitcher variant={variant} onStep={onStep} />
    </section>
  );
}
