/*
 * PROTOTYPE — throwaway. Small pieces the variants share: formatting, a
 * Target card in three densities, a game tile and an edge row. Layout stays
 * in each variant.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { targetSliceLabel } from '../targets/targetCatalog';
import { PROTO_STANDALONE, useTerse } from './prototypeMode';
import { ptsScoreFor } from './useHomePreviewData';

/* The standalone build has no data behind the other pages, so links there
   are inert; on a dev server they navigate. */
export const ProtoLink = ({ to, children, ...rest }) =>
  PROTO_STANDALONE ? (
    <a href={to} onClick={(event) => event.preventDefault()} title="Prototype: not wired" {...rest}>
      {children}
    </a>
  ) : (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );

export const tipoff = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const pct = (value, digits = 0) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(digits)}%`;

const SUFFIXES = new Set(['Jr.', 'Sr.', 'II', 'III', 'IV']);

/* "Wendell Carter Jr." → "Carter". */
export const lastName = (name) => {
  const parts = name.split(' ');
  while (parts.length > 1 && SUFFIXES.has(parts.at(-1))) parts.pop();
  return parts.at(-1);
};

export const shortName = (name) => {
  const [first, ...rest] = name.split(' ');
  return rest.length ? `${first[0]}. ${rest.join(' ')}` : name;
};

const comparatorSign = (comparator) => (comparator === 'at_or_below' ? '≤' : '≥');

export const qualifierText = (qualifier) =>
  `${targetSliceLabel(qualifier.base, qualifier.sliceKey)} ${comparatorSign(qualifier.comparator)} ${Math.round(qualifier.threshold * 1000) / 10}%`;

export const gameLabel = (game) => `${game.away.tricode} @ ${game.home.tricode}`;

export const SectionHead = ({ kicker, title, to, cta }) => (
  <div className="hp-section-head">
    <div>
      {kicker && <span className="hp-kicker">{kicker}</span>}
      <h2 className="hp-section-title">{title}</h2>
    </div>
    {to && (
      <ProtoLink to={to} className="hp-more">
        {cta} <ArrowRight size={13} aria-hidden="true" />
      </ProtoLink>
    )}
  </div>
);

export const EdgeValue = ({ value, market }) => (
  <span className={`hp-edge ${value >= 0 ? 'is-up' : 'is-down'}`}>
    {pct(value)}
    {market && <small>{market}</small>}
  </span>
);

/* A Target that fires on the slate: who it's against, what it asks for, and
   who fits. `density` is how much of the fit list shows. */
export const TargetCard = ({ entry, density = 'full', withMatchup = false }) => {
  const terse = useTerse();
  const { target, game, players } = entry;
  const shown = density === 'full' ? players.slice(0, 3) : players.slice(0, 2);
  return (
    <ProtoLink to={`/targets/${target.id}`} className={`hp-target hp-target-${density}`}>
      <div className="hp-target-top">
        <span className="hp-opp">vs {target.opponent}</span>
        <span className="hp-target-game">
          {gameLabel(game)} · {tipoff(game.scheduledAt)}
        </span>
      </div>
      <div className="hp-target-criteria">
        {target.qualifiers.map((qualifier) => (
          <span key={`${qualifier.base}:${qualifier.sliceKey}`} className="hp-qual">
            {qualifierText(qualifier)}
          </span>
        ))}
      </div>
      {density !== 'pill' && (
        <ul className={`hp-fits${withMatchup ? ' hp-fits-matchup' : ''}`}>
          {shown.map((player) => (
            <li key={player.canonicalId}>
              <span className="hp-fit-name">
                {player.name} <small>{player.tricode}</small>
              </span>
              <span className="hp-fit-share">
                {Math.round(player.shares[0].share * 100)}%
                {!terse && player.shares[0].leagueAverageShare !== null && (
                  <small> lg {Math.round(player.shares[0].leagueAverageShare * 100)}%</small>
                )}
              </span>
              {withMatchup && (
                <span className="hp-fit-matchup">
                  {ptsScoreFor(game.gameId, player.canonicalId) === null ? (
                    '–'
                  ) : (
                    <EdgeValue value={ptsScoreFor(game.gameId, player.canonicalId)} />
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="hp-target-foot">
        <span>
          <b>{players.length}</b>{' '}
          {terse ? 'fit' : players.length === 1 ? 'player fits' : 'players fit'}
        </span>
        <ArrowRight size={13} aria-hidden="true" />
      </div>
    </ProtoLink>
  );
};

export const GameTile = ({ game, edge }) => (
  <ProtoLink to={`/matchups/${game.gameId}`} className="hp-game">
    <div className="hp-game-teams">
      <span>{game.away.tricode}</span>
      <i>@</i>
      <span>{game.home.tricode}</span>
    </div>
    <div className="hp-game-time">{tipoff(game.scheduledAt)}</div>
    {edge && (
      <div className="hp-game-edge">
        <span className="hp-game-edge-name">{shortName(edge.name)}</span>
        <EdgeValue value={edge.value} market={edge.market} />
      </div>
    )}
  </ProtoLink>
);

export const EdgeRow = ({ player, max = 0.25 }) => (
  <li className="hp-edge-row">
    <span className="hp-edge-row-name">
      {player.name} <small>{player.ppg?.toFixed(1)} PPG</small>
    </span>
    <span className="hp-edge-bar" aria-hidden="true">
      <span
        className={player.value >= 0 ? 'is-up' : 'is-down'}
        style={{ width: `${Math.min(100, (Math.abs(player.value) / max) * 100)}%` }}
      />
    </span>
    <EdgeValue value={player.value} />
  </li>
);
