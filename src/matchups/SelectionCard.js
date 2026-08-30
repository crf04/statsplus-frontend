import { useEffect, useRef, useState } from 'react';
import { formatFocalGameLine } from './displayConfig';

const BASE_LABELS = {
  playTypes: 'Play types',
  shotZones: 'Shot zones',
  shotTypes: 'Shot types',
  assistLocations: 'Assist locations',
  traditional: 'Traditional',
};
const formatPercent = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const WINDOW_LABELS = { season: 'Season', last15: 'Last 15' };

function LogTable({ title, table, market }) {
  return (
    <section className="selection-log" aria-labelledby={`${title.replaceAll(' ', '-')}-heading`}>
      <h3 id={`${title.replaceAll(' ', '-')}-heading`}>{title}</h3>
      {table.thin && <p className="thin-note">Thin sample — interpret cautiously.</p>}
      {table.rows.length === 0 ? (
        <p className="honest-empty">No {title.toLowerCase()} data is available.</p>
      ) : (
        <div className="selection-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">MIN</th>
                <th scope="col">{market}</th>
                <th scope="col">±STAT/MIN</th>
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
                  <td>
                    {row.deltas[market] >= 0 ? '+' : ''}
                    {row.deltas[market].toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SelectionCard({
  player,
  selection,
  status,
  error,
  windowKey,
  sheetMarket,
  whyRelevant,
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
  const rows = player.statCategories.map((market) => ({
    market,
    score: player.scores[market][windowKey],
  }));
  const bases = [...new Set(rows.flatMap(({ score }) => Object.keys(score.components)))];
  const hasBlend = rows.some(({ score }) => score.blend);
  return (
    <section
      ref={panelRef}
      id="matchup-selection-card"
      className="selection-card"
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
      </p>
      {player.focalGameLine && (
        <p className="focal-line">
          {formatFocalGameLine(player.focalGameLine, player.statCategories, {
            includeDate: true,
          })}
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
      <div className="selection-table-wrap">
        <table aria-label={`${player.name} Score Matrix`}>
          <thead>
            <tr>
              <th scope="col">Market</th>
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
                    {score.components[base] ? (
                      <>
                        {formatPercent(score.components[base].value)}
                        {score.components[base].thin && <span className="thin-flag">thin</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                ))}
                {hasBlend && (
                  <td>
                    {score.blend ? (
                      <>
                        {formatPercent(score.blend.value)}
                        {score.blend.thin && <span className="thin-flag">thin</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows
        .filter(({ score }) => Object.keys(score.components).length === 0 && score.blend === null)
        .map(({ market }) => (
          <p className="honest-empty" key={`degraded-${market}`}>
            No score components were computable for {market} in {WINDOW_LABELS[windowKey]}.
          </p>
        ))}
      {status === 'loading' && <p role="status">Loading selection logs…</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {status === 'ready' && (
        <div className="selection-logs">
          {selection.experience?.samples.excludesFocalGame && (
            <p className="selection-provenance">
              Pregame samples use games strictly before the focal game.
            </p>
          )}
          {selection.experience?.baseline.hindsight && (
            <p className="selection-provenance">
              Completed-season baseline — hindsight, not pregame evidence.
            </p>
          )}
          <LogTable title="Games vs this opponent" table={selection.h2h} market={activeStat} />
          <LogTable title="Archetype sample" table={selection.archetype} market={activeStat} />
        </div>
      )}
    </section>
  );
}
