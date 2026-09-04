/* PROTOTYPE — throwaway. Pieces every variant shares. A shared <Header> is
   fine; each variant still owns its layout. */
import { Link } from 'react-router-dom';
import { filterSetToSearchParams } from '../../filterUtils';
import { sliceLabel } from './catalog';
import { COMPARATOR_SYMBOL, qualifierLabel, titleOf, unitOf } from './targetsStore';
import { stubBacktest } from './resolveTargets';

export const pct = (share) => `${Math.round(share * 100)}%`;
export const signed = (n, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

export const formatTip = (iso) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/* Title as two weights: opponent heavy, criteria as mono. */
export function Title({ target, as: Tag = 'h3', className = '' }) {
  return (
    <Tag className={`tp-title ${className}`} title={titleOf(target)}>
      <span className="tp-title-team">{target.opponent}</span>
      <span className="tp-title-vs">vs</span>
      <span className="tp-title-q">
        {target.qualifiers.map((q, i) => (
          <span key={i}>
            {i > 0 && <em> & </em>}
            {sliceLabel(q.base, q.sliceKey)} <b>{COMPARATOR_SYMBOL[q.comparator]} {pct(q.threshold)}</b>
          </span>
        ))}
      </span>
    </Tag>
  );
}

/* One defense-sheet reading: rank pill + % vs league + σ, for one window. */
export function Reading({ stat, windowLabel }) {
  if (!stat) return <span className="tp-reading is-empty">{windowLabel}: n/a</span>;
  const tone = stat.percentVsLeagueAverage === null ? 'neutral' : stat.percentVsLeagueAverage < 0 ? 'under' : 'over';
  return (
    <span className={`tp-reading is-${tone}`}>
      <span className="rank-pill" style={{ '--rank': stat.rank }} title={`Rank ${stat.rank}/30 — 30 allows the most`}>
        {stat.rank}
      </span>
      <span className="tp-reading-window">{windowLabel}</span>
      <strong>
        {stat.percentVsLeagueAverage === null ? 'n/a' : `${signed(stat.percentVsLeagueAverage)}%`}
      </strong>
      <small>{signed(stat.sigmaDeviation)}σ</small>
    </span>
  );
}

/* Live context for one Qualifier: every sheet row on that slice, both windows. */
export function Context({ item, compact = false }) {
  const { qualifier, rows } = item;
  return (
    <div className={`tp-context${compact ? ' is-compact' : ''}`}>
      <span className="tp-context-q">{qualifierLabel(qualifier)} <em>{unitOf(qualifier)}</em></span>
      {rows.length === 0 ? (
        <span className="honest-empty">No sheet row for this slice.</span>
      ) : (
        rows.map((row) => (
          <span className="tp-context-row" key={row.key}>
            <span className="tp-context-label">{row.label}</span>
            <Reading stat={row.season} windowLabel="Season" />
            {!compact && <Reading stat={row.last15} windowLabel="L15" />}
          </span>
        ))
      )}
    </div>
  );
}

export const logsPath = (player) => `/?${filterSetToSearchParams({ player_name: player.name })}`;

export function Availability({ result }) {
  if (result.availability === 'loading') return <p className="honest-empty">Loading {result.game.away.tricode} @ {result.game.home.tricode}…</p>;
  if (result.availability === 'error') return <p className="honest-empty">Matchup failed to load.</p>;
  if (result.availability === 'unavailable')
    return <p className="honest-empty tp-unavailable">{result.opposingTeam?.tricode} pool unavailable — this is not “nobody qualifies”.</p>;
  if (result.players.length === 0)
    return <p className="honest-empty">No {result.opposingTeam?.tricode} player fits. {result.poolSize} in pool.</p>;
  return null;
}

/* Fit table: one row per qualifying player, one share column per Qualifier. */
export function FitTable({ result, dense = false }) {
  if (result.availability !== 'available' || result.players.length === 0) return <Availability result={result} />;
  return (
    <table className={`tp-fits${dense ? ' is-dense' : ''}`}>
      <thead>
        <tr>
          <th>Player</th>
          {result.target.qualifiers.map((q, i) => (
            <th key={i} className="num">{sliceLabel(q.base, q.sliceKey)}</th>
          ))}
          <th className="num">PPG</th>
          {!dense && <th>Markets</th>}
        </tr>
      </thead>
      <tbody>
        {result.players.map(({ player, shares, thin }) => (
          <tr key={player.id} className={thin ? 'is-thin' : ''}>
            <td>
              <Link to={logsPath(player)} className="tp-player">{player.name}</Link>
              <small>{player.tricode}</small>
              {thin && <span className="thin-flag" title="Thin diet sample">thin</span>}
            </td>
            {shares.map((s, i) => (
              <td key={i} className="num">
                <b>{pct(s.entry.share)}</b>
                {s.entry.leagueAverageShare !== null && <small>lg {pct(s.entry.leagueAverageShare)}</small>}
              </td>
            ))}
            <td className="num">{player.seasonScoring === null ? '—' : player.seasonScoring.toFixed(1)}</td>
            {!dense && (
              <td>
                <span className="market-chips">
                  {player.postedMarkets.length ? player.postedMarkets.map((m) => <span key={m}>{m}</span>) : <span>game logs</span>}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* Chips instead of a table, for the denser layouts. */
export function FitChips({ result }) {
  if (result.availability !== 'available' || result.players.length === 0) return <Availability result={result} />;
  return (
    <div className="diet-chips tp-fit-chips">
      {result.players.map(({ player, shares, thin }) => (
        <Link key={player.id} to={logsPath(player)} className={thin ? 'is-thin' : ''}>
          {player.name} · {shares.map((s) => pct(s.entry.share)).join(' / ')}
          {thin ? ' · thin' : ''}
        </Link>
      ))}
    </div>
  );
}

export function Backtest({ result, open = true }) {
  const bt = stubBacktest(result);
  return (
    <div className="tp-backtest" hidden={!open}>
      <div className="tp-backtest-head">
        <span className="matchup-eyebrow">Backtest · season to date · vs {result.target.opponent}</span>
        <span className="tp-stub">STUB — synthetic rows until backend#246</span>
      </div>
      <p className="honest-empty">{bt.proxy} Thin diets excluded.</p>
      {bt.rows.length === 0 ? (
        <p className="honest-empty">Nobody qualifying has faced {result.target.opponent} yet.</p>
      ) : (
        <table className="tp-bt">
          <thead>
            <tr>
              <th>Player</th>
              <th>Game</th>
              {bt.markets.map((m) => <th key={m} className="num">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {bt.rows.map(({ player, season, games }) =>
              games.map((g, i) => (
                <tr key={`${player.id}-${i}`}>
                  {i === 0 && (
                    <td rowSpan={games.length}>
                      <Link to={logsPath(player)} className="tp-player">{player.name}</Link>
                      <small>season {bt.markets.map((m) => `${season[m].toFixed(1)} ${m}`).join(' · ')}</small>
                    </td>
                  )}
                  <td className="mono">{g.date}</td>
                  {bt.markets.map((m) => {
                    const diff = g.stats[m] - season[m];
                    return (
                      <td key={m} className={`num ${diff >= 0 ? 'is-over' : 'is-under'}`}>
                        {g.stats[m].toFixed(1)} <small>{signed(diff)}</small>
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
