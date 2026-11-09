/*
 * PROTOTYPE — throwaway. The home ticker with every stat instead of PTS only.
 *
 * Each player's season Matchup cell per market comes from ./allStats.json,
 * derived from the captured Matchups by ./derive.py with the Slate Edges rule
 * (Blend, else a lone component; 8 PPG floor). The real build would have the
 * edges endpoint return it.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTip } from '../../calendarDate';
import { dayName, lastName, matchupsPath, shortSlateDay, signedPercent } from '../homeFormat';
import allStats from './allStats.json';
import Switcher from './Switcher';
import { useVariant } from './mode';
import './proto.css';

const ROWS = 5;
const ALL_MARKETS = [
  'PTS',
  'REB',
  'AST',
  '3PM',
  'PRA',
  'PR',
  'PA',
  'RA',
  'STL',
  'BLK',
  'STKS',
  'TOV',
  'FGA',
  'FGM',
  'FG2A',
  'FG2M',
  'FG3A',
  'FTA',
  'FTM',
];
// B: player stats only. STL and BLK score the opponent's team rate, so every
// player on a team carries the same number and would fill the list.
const CORE = ['PTS', 'REB', 'AST', '3PM'];
const GRID = ['PTS', 'REB', 'AST', '3PM', 'PRA'];

const byEffect = (a, b) => Math.abs(b.value) - Math.abs(a.value) || b.ppg - a.ppg;

const cellsFor = (gameId, market) =>
  (allStats[gameId] || [])
    .filter((row) => row.cells[market])
    .map((row) => ({
      name: row.name,
      ppg: row.ppg,
      market,
      value: row.cells[market][0],
      thin: row.cells[market][1],
    }));

const topForMarket = (gameId, market, n = ROWS) =>
  cellsFor(gameId, market).sort(byEffect).slice(0, n);

const topAcross = (gameId) =>
  CORE.flatMap((market) => cellsFor(gameId, market))
    .sort(byEffect)
    .slice(0, ROWS);

const Value = ({ effect }) => (
  <span
    className={`tsp-val ${effect.value >= 0 ? 'is-up' : 'is-down'}${effect.thin ? ' thin' : ''}`}
    title={effect.thin ? 'Thin sample' : undefined}
  >
    {signedPercent(effect.value)}
  </span>
);

const Cell = ({ game, children }) => (
  <Link to={`/matchups/${game.gameId}`} className="home-tick tsp-tick">
    <span className="home-tick-teams">
      {game.away.tricode} @ {game.home.tricode}
    </span>
    <span className="home-tick-time">{formatTip(game.scheduledAt)}</span>
    {children}
  </Link>
);

const Empty = () => <span className="tsp-empty">No scores yet</span>;

const Label = ({ slateDate, games, fallback, children }) => (
  <div className="home-ticker-label tsp-label">
    <Link to={matchupsPath(fallback, slateDate)}>
      {fallback && `${dayName(fallback)} · `}
      {shortSlateDay(slateDate)} <b>{games.length} games</b>
    </Link>
    {children}
  </div>
);

const VariantA = ({ slateDate, games, fallback }) => {
  const [market, setMarket] = useState('PTS');
  return (
    <nav className="home-ticker tsp tsp-a" aria-label="Today's games">
      <Label slateDate={slateDate} games={games} fallback={fallback}>
        <div className="tsp-chips" role="radiogroup" aria-label="Stat">
          {ALL_MARKETS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={key === market}
              className={key === market ? 'is-on' : ''}
              onClick={() => setMarket(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </Label>
      <div className="home-ticker-track">
        {games.map((game) => {
          const rows = topForMarket(game.gameId, market);
          return (
            <Cell key={game.gameId} game={game}>
              {rows.length ? (
                <ul className="home-tick-effects">
                  {rows.map((effect) => (
                    <li key={effect.name}>
                      <span>{lastName(effect.name)}</span>
                      <Value effect={effect} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty />
              )}
            </Cell>
          );
        })}
      </div>
    </nav>
  );
};

const VariantB = ({ slateDate, games, fallback }) => (
  <nav className="home-ticker tsp tsp-b" aria-label="Today's games">
    <Label slateDate={slateDate} games={games} fallback={fallback}>
      <span className="tsp-legend">Biggest of {CORE.join(' · ')}</span>
    </Label>
    <div className="home-ticker-track">
      {games.map((game) => {
        const rows = topAcross(game.gameId);
        return (
          <Cell key={game.gameId} game={game}>
            {rows.length ? (
              <ul className="home-tick-effects tsp-rows3">
                {rows.map((effect) => (
                  <li key={`${effect.name}-${effect.market}`}>
                    <span>{lastName(effect.name)}</span>
                    <span className="tsp-stat">{effect.market}</span>
                    <Value effect={effect} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Cell>
        );
      })}
    </div>
  </nav>
);

const VariantC = ({ slateDate, games, fallback }) => (
  <nav className="home-ticker tsp tsp-c" aria-label="Today's games">
    <Label slateDate={slateDate} games={games} fallback={fallback}>
      <span className="tsp-legend">Biggest mover per stat</span>
    </Label>
    <div className="home-ticker-track">
      {games.map((game) => {
        const hasAny = (allStats[game.gameId] || []).length > 0;
        return (
          <Cell key={game.gameId} game={game}>
            {hasAny ? (
              <ul className="home-tick-effects tsp-rows3 tsp-grid">
                {GRID.map((market) => {
                  const [effect] = topForMarket(game.gameId, market, 1);
                  return (
                    <li key={market}>
                      <span className="tsp-stat">{market}</span>
                      <span>{effect ? lastName(effect.name) : '—'}</span>
                      {effect ? <Value effect={effect} /> : <span />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty />
            )}
          </Cell>
        );
      })}
    </div>
  </nav>
);

const TickerStatsPrototype = (props) => {
  const { variant, goTo, step } = useVariant();
  const Variant = { A: VariantA, B: VariantB, C: VariantC }[variant];
  return (
    <>
      <Variant {...props} />
      <Switcher variant={variant} goTo={goTo} step={step} />
    </>
  );
};

export default TickerStatsPrototype;
