import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatTip } from '../calendarDate';
import { formatObservedShare, formatQualifier, targetSliceLabel } from '../targets/targetCatalog';
import { TargetConditionSummary } from '../targets/TargetConditions';
import { SeasonMinutesProvider } from '../targets/useTargets';
import LoginButton from '../components/Auth/LoginButton';
import { dayName, matchupsPath, rankPhrase, signedPercent } from './homeFormat';

/*
 * The home page's Tonight | Your Targets row (crf04/statsplus#204). Tonight is
 * the slate's most and least favourable points Matchup with the one play-type
 * slice behind each; Your Targets is the two firing Targets with the most fits,
 * each fit carrying its own points Matchup score from the same Slate Edges.
 * Targets belong to an account, so a signed-out visitor gets a sign-up card in
 * that column and a waitlisted account gets no column (crf04/statsplus#211).
 */
const Pick = ({ kind, pick, game, onUseQuery }) => {
  if (!pick) {
    return (
      <article className="home-pick is-empty">
        <span className="home-kicker">{kind}</span>
        <p>No standout matchup</p>
      </article>
    );
  }
  const up = pick.value > 0;
  const { reason } = pick;
  const query = `${pick.name} this year against ${up ? 'bottom' : 'top'} 10 defenses`;
  return (
    <article
      className={`home-pick ${up ? 'is-up' : 'is-down'}`}
      aria-label={`${kind}: ${pick.name}`}
    >
      <span className="home-kicker">{kind}</span>
      <div className="home-pick-head">
        <h3>{pick.name}</h3>
        <b>{signedPercent(pick.value, 1)}</b>
      </div>
      <p className="home-pick-game">
        vs {pick.opponent}
        {game && ` · ${formatTip(game.scheduledAt)}`}
      </p>
      {reason && (
        <p className="home-pick-why">
          {targetSliceLabel(reason.base, reason.sliceKey)} {formatObservedShare(reason.share)} of
          plays · {pick.opponent} {rankPhrase(reason.opponentRank)}
        </p>
      )}
      {/* Fills the Query Prompt; the reader decides whether to run it. */}
      <button type="button" className="home-pick-try" onClick={() => onUseQuery(query)}>
        Try it <ArrowRight size={13} aria-hidden="true" />
      </button>
    </article>
  );
};

const TargetCard = ({ entry, scores }) => {
  const { target, game, players } = entry;
  return (
    <Link to={`/targets/${target.id}`} className="home-target">
      <div className="home-target-top">
        <span className="home-opp">vs {target.opponent}</span>
        <span className="home-target-game">
          {game.away.tricode} @ {game.home.tricode} · {formatTip(game.scheduledAt)}
        </span>
      </div>
      <p className="home-target-criteria">{target.qualifiers.map(formatQualifier).join(' + ')}</p>
      {/* Conditions change who fits, so two Targets with the same Qualifiers stay apart. */}
      <TargetConditionSummary target={target} />
      <ul className="home-target-fits">
        {players.slice(0, 2).map((player) => {
          const score = scores?.get(player.canonicalId);
          return (
            <li key={player.canonicalId}>
              <span>
                {player.name} <small>{player.tricode}</small>
              </span>
              <span className="home-target-share">
                {formatObservedShare(player.shares[0].share)}
              </span>
              <span
                className={`home-target-score${score === undefined ? '' : score >= 0 ? ' is-up' : ' is-down'}`}
              >
                {score === undefined ? '–' : signedPercent(score)}
              </span>
            </li>
          );
        })}
      </ul>
      <span className="home-target-foot">
        <span>
          <b>{players.length}</b> fit
        </span>
        <ArrowRight size={13} aria-hidden="true" />
      </span>
    </Link>
  );
};

const HomeTonight = ({
  games,
  spotlight,
  targets,
  signUp = false,
  onUseQuery,
  slateDate = null,
  fallback = null,
}) => {
  const gameOf = (gameId) => games.find((game) => game.gameId === gameId);
  return (
    <div className="home-tonight">
      <section className="home-col" aria-labelledby="home-tonight-heading">
        <div className="home-col-head">
          <h2 id="home-tonight-heading">{dayName(fallback) ?? 'Tonight'}</h2>
          <Link to={matchupsPath(fallback, slateDate)}>
            Matchups <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <div className="home-col-stack">
          <Pick
            kind="Best"
            pick={spotlight.best}
            game={spotlight.best && gameOf(spotlight.best.gameId)}
            onUseQuery={onUseQuery}
          />
          <Pick
            kind="Toughest"
            pick={spotlight.toughest}
            game={spotlight.toughest && gameOf(spotlight.toughest.gameId)}
            onUseQuery={onUseQuery}
          />
        </div>
      </section>
      {signUp && (
        <section className="home-col" aria-labelledby="home-targets-heading">
          <div className="home-col-head">
            <h2 id="home-targets-heading">Your Targets</h2>
          </div>
          <div className="home-col-stack">
            <div className="home-empty home-signup">
              <p>A Target watches one opponent and flags every player who fits, on game day.</p>
              <LoginButton size="sm" label="Sign up free" />
            </div>
          </div>
        </section>
      )}
      {targets && (
        <section className="home-col" aria-labelledby="home-targets-heading">
          <div className="home-col-head">
            <h2 id="home-targets-heading">Your Targets</h2>
            <Link to="/targets">
              {targets.firing.length > 0 ? `All ${targets.firing.length} firing` : 'Targets'}{' '}
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <SeasonMinutesProvider>
            <div className="home-col-stack">
              {targets.firing.slice(0, 2).map((entry) => (
                <TargetCard
                  key={entry.target.id}
                  entry={entry}
                  scores={gameOf(entry.game.gameId)?.scores}
                />
              ))}
              {targets.firing.length === 0 && (
                <p className="home-empty">
                  {targets.total === 0 ? (
                    <Link to="/targets">
                      Set a Target <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  ) : (
                    'None of your Targets fire today'
                  )}
                </p>
              )}
            </div>
          </SeasonMinutesProvider>
        </section>
      )}
    </div>
  );
};

export default HomeTonight;
