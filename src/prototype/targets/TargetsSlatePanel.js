/*
 * PROTOTYPE — throwaway. How live Targets show up on the Slate page.
 *   A · a strip above the board, one row per live Target
 *   B · a sticky ribbon of chips under the header
 *   C · a sub-line under each game row that has a Target
 */
import { Link } from 'react-router-dom';
import { PAGE_PATH, protoQuery } from './prototypeMode';
import { useTargetsStore } from './targetsStore';
import { useResolvedTargets } from './resolveTargets';
import { Title, pct } from './shared';
import './prototype.css';

const fitCount = (r) => (r.availability === 'available' ? `${r.players.length} fit` : r.availability === 'loading' ? '…' : 'pool n/a');

export const useSlateTargets = (date, variant) => {
  const { targets } = useTargetsStore();
  const resolved = useResolvedTargets(date, targets);
  const pageLink = (extra) => `${PAGE_PATH}?${protoQuery(variant, { date, ...extra }, { page: true })}`;

  const panel =
    variant === 'A' ? (
      <section className="tp-strip" aria-labelledby="tp-strip-h">
        <div className="tp-strip-head">
          <p className="matchup-eyebrow" id="tp-strip-h">Targets live · {resolved.live.length}</p>
          <Link to={pageLink()}>All Targets →</Link>
        </div>
        {resolved.live.length === 0 ? (
          <p className="honest-empty">No Target has a game on this date.</p>
        ) : (
          <ul className="tp-strip-rows">
            {resolved.live.map((r) => (
              <li key={r.target.id}>
                <Link to={pageLink()} className="tp-strip-row">
                  <Title target={r.target} as="span" />
                  <span className="tp-strip-game">{r.game.away.tricode} @ {r.game.home.tricode}</span>
                  <b>{fitCount(r)}</b>
                  {r.availability === 'available' && r.players.length > 0 && (
                    <span className="tp-strip-names">{r.players.slice(0, 3).map((p) => p.player.name.split(' ').at(-1)).join(', ')}{r.players.length > 3 ? ` +${r.players.length - 3}` : ''}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    ) : variant === 'B' ? (
      <div className="tp-ribbon" role="region" aria-label="Live Targets">
        <span className="tp-ribbon-label">Targets</span>
        {resolved.live.length === 0 && <span className="tp-ribbon-empty">none live today</span>}
        {resolved.live.map((r) => (
          <Link key={r.target.id} to={pageLink()} className="tp-ribbon-chip">
            <b>{r.target.opponent}</b> {r.target.qualifiers.map((q) => `${q.sliceKey.replace(/Assists$/, '')} ${pct(q.threshold)}`).join(' & ')}
            <small>{fitCount(r)}</small>
          </Link>
        ))}
        <Link to={pageLink()} className="tp-ribbon-all">All →</Link>
      </div>
    ) : null;

  const rowExtra =
    variant === 'C'
      ? (game) => {
          const here = resolved.live.filter((r) => r.game.gameId === game.gameId);
          if (here.length === 0) return null;
          return (
            <ul className="tp-subline">
              {here.map((r) => (
                <li key={r.target.id}>
                  <Link to={pageLink()}>
                    <span className="tp-dot is-live" />
                    <Title target={r.target} as="span" />
                    <b>{fitCount(r)}</b>
                    {r.availability === 'available' && r.players.length > 0 && (
                      <span className="tp-strip-names">{r.players.slice(0, 4).map((p) => p.player.name.split(' ').at(-1)).join(', ')}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }
      : null;

  return { resolved, panel, rowExtra, pageLink };
};
