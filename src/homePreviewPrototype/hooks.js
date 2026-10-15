/*
 * PROTOTYPE — throwaway. Two ways to draw a visitor in, both on captured
 * production data (mock/hooks.json, captured 2026-10-14):
 *
 * - Spotlight: the slate's best and toughest points matchup (non-thin, 12+
 *   PPG) with the two play types behind each and where the opponent ranks.
 * - AnswerLadder: the existing three-step ladder, with each step's real
 *   answer under it, so the payoff shows before anyone types.
 */
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QUERY_LADDER, splitAddedClause } from '../help/queryHelp';
import { targetSliceLabel } from '../targets/targetCatalog';
import hooks from './mock/hooks.json';
import { pct, tipoff } from './parts';

const ordinal = (n) => {
  const tail =
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${tail}`;
};

/* Rank 30 allows the most of the metric, rank 1 the fewest. */
const rankPhrase = (rank) =>
  rank >= 16 ? `allow the ${ordinal(31 - rank)} most` : `allow the ${ordinal(rank)} fewest`;

const BASE_LABELS = {
  play_types: 'Play types',
  shot_types: 'Shot types',
  shot_zones: 'Shot zones',
};

export const SpotlightCard = ({ kind, pick, game, onUseQuery }) => {
  const up = pick.value >= 0;
  const query = `${pick.name} this year against ${up ? 'bottom' : 'top'} 10 defenses`;
  return (
    <article className={`hp-spot ${up ? 'is-up' : 'is-down'}`}>
      <span className="hp-kicker">{kind}</span>
      <div className="hp-spot-head">
        <div>
          <h3 className="hp-spot-name">{pick.name}</h3>
          <p className="hp-spot-game">
            {pick.tricode} vs {pick.opponent}
            {game && ` · ${tipoff(game.scheduledAt)}`} · {pick.ppg} PPG
          </p>
        </div>
        <div className="hp-spot-score">
          <b>{pct(pick.value, 1)}</b>
          <small>PTS matchup</small>
        </div>
      </div>
      <ul className="hp-spot-why">
        {pick.why.map((slice) => (
          <li key={slice.key}>
            <span className="hp-spot-slice">
              {targetSliceLabel('play_types', slice.key)}
              <small>
                {Math.round(slice.share * 100)}% of his plays · lg {Math.round(slice.league * 100)}%
              </small>
            </span>
            <span className="hp-spot-opp">
              {pick.opponent} {rankPhrase(slice.rank)}
              <small className={slice.pct >= 0 ? 'is-up' : 'is-down'}>
                {slice.pct >= 0 ? '+' : '−'}
                {Math.abs(slice.pct).toFixed(1)}% vs lg
              </small>
            </span>
          </li>
        ))}
      </ul>
      <div className="hp-spot-parts">
        {Object.entries(pick.components).map(([base, value]) => (
          <span key={base}>
            {BASE_LABELS[base]} <b className={value >= 0 ? 'is-up' : 'is-down'}>{pct(value, 1)}</b>
          </span>
        ))}
      </div>
      <button type="button" className="hp-spot-cta" onClick={() => onUseQuery(query)}>
        Try “{query}” <ArrowRight size={14} aria-hidden="true" />
      </button>
    </article>
  );
};

export const Spotlight = ({ slate, onUseQuery }) => {
  const gameOf = (pick) => slate?.games.find((game) => game.gameId === pick.gameId);
  const { best, worst } = hooks.spotlight;
  return (
    <section className="hp-spotlight" aria-label="Tonight's spotlight">
      <SpotlightCard
        kind="Best matchup tonight"
        pick={best}
        game={gameOf(best)}
        onUseQuery={onUseQuery}
      />
      <SpotlightCard
        kind="Toughest matchup tonight"
        pick={worst}
        game={gameOf(worst)}
        onUseQuery={onUseQuery}
      />
    </section>
  );
};

const Bars = ({ series, average }) => {
  const max = Math.max(...series, 1);
  return (
    <span className="hp-bars" aria-hidden="true">
      {series.map((value, index) => (
        <i
          key={index}
          className={value >= average ? 'is-over' : ''}
          style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
        />
      ))}
    </span>
  );
};

export const AnswerLadder = ({ onUseQuery, compact = false, referenceUp = false }) => (
  <section
    className={`query-ladder hp-answers${compact ? ' hp-answers-compact' : ''}`}
    aria-labelledby="hp-answers-heading"
  >
    <div className="query-ladder-head">
      <h2 id="hp-answers-heading" className="query-ladder-title">
        One question, three steps
      </h2>
      <p className="query-ladder-sub">Real answers from last season. Click one to load it.</p>
      {referenceUp && (
        <Link to="/help" className="hp-reference-up">
          Every filter we understand <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
    <ol className="query-ladder-rungs">
      {QUERY_LADDER.map((step, index) => {
        const { before, added, after } = splitAddedClause(step.query, step.added);
        const answer = hooks.ladder[index];
        const previous = hooks.ladder[index - 1];
        const delta = previous ? Math.round((answer.PTS - previous.PTS) * 10) / 10 : null;
        return (
          <li className="query-ladder-rung" key={step.id}>
            <button
              type="button"
              className="query-ladder-button"
              onClick={() => onUseQuery(step.query)}
            >
              <span className="query-ladder-index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="query-ladder-body">
                <span className="query-ladder-query">
                  {before}
                  <mark>{added}</mark>
                  {after}
                </span>
                <span className="hp-answer">
                  <span className="hp-answer-pts">
                    <b>{answer.PTS.toFixed(1)}</b> PTS
                    {delta !== null && (
                      <small className={delta >= 0 ? 'is-up' : 'is-down'}>
                        {delta >= 0 ? '+' : '−'}
                        {Math.abs(delta).toFixed(1)}
                      </small>
                    )}
                  </span>
                  <span className="hp-answer-line" hidden={compact}>
                    {answer.REB.toFixed(1)} REB · {answer.AST.toFixed(1)} AST ·{' '}
                    <b>{answer.games}</b> games
                  </span>
                  <Bars series={answer.series} average={answer.PTS} />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </section>
);

/* K/L: the spotlight reduced to one reason, the slice whose opponent effect
   pushes hardest in the score's direction. */
export const SlimSpot = ({ kind, pick, game, onUseQuery }) => {
  const up = pick.value >= 0;
  const reason = [...pick.why].sort((a, b) => (up ? b.pct - a.pct : a.pct - b.pct))[0];
  const query = `${pick.name} this year against ${up ? 'bottom' : 'top'} 10 defenses`;
  return (
    <article className={`hp-slim ${up ? 'is-up' : 'is-down'}`}>
      <span className="hp-kicker">{kind}</span>
      <div className="hp-slim-head">
        <h3 className="hp-slim-name">{pick.name}</h3>
        <b className="hp-slim-score">{pct(pick.value, 1)}</b>
      </div>
      <p className="hp-slim-game">
        {pick.tricode} vs {pick.opponent}
        {game && ` · ${tipoff(game.scheduledAt)}`} · PTS matchup
      </p>
      <p className="hp-slim-why">
        {targetSliceLabel('play_types', reason.key)} is {Math.round(reason.share * 100)}% of his
        plays; {pick.opponent} {rankPhrase(reason.rank)}.
      </p>
      <button type="button" className="hp-slim-cta" onClick={() => onUseQuery(query)}>
        Try it <ArrowRight size={13} aria-hidden="true" />
      </button>
    </article>
  );
};
