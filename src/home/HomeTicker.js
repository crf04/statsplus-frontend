import { Link } from 'react-router-dom';
import { formatTip } from '../calendarDate';
import { dayName, lastName, matchupsPath, shortSlateDay, signedPercent } from './homeFormat';

/*
 * The scoreboard under the header: every game today, in tip-off order, with
 * its three biggest points Matchup effects either way. Each cell opens the
 * game's Matchup.
 */
const HomeTicker = ({ slateDate, games, fallback = null }) => (
  <nav
    className="home-ticker"
    aria-label={fallback ? `${dayName(fallback)}'s games` : "Today's games"}
  >
    <Link to={matchupsPath(fallback, slateDate)} className="home-ticker-label">
      {fallback && `${dayName(fallback)} · `}
      {shortSlateDay(slateDate)} <b>{games.length === 1 ? '1 game' : `${games.length} games`}</b>
    </Link>
    <div className="home-ticker-track">
      {games.map((game) => (
        <Link
          key={game.gameId}
          to={`/matchups/${game.gameId}`}
          className="home-tick"
          aria-label={`${game.away.tricode} at ${game.home.tricode} Matchup, ${formatTip(
            game.scheduledAt,
          )}${game.effects
            .map((effect) => `, ${lastName(effect.name)} ${signedPercent(effect.value)}`)
            .join('')}`}
        >
          <span className="home-tick-teams">
            {game.away.tricode} @ {game.home.tricode}
          </span>
          <span className="home-tick-time">{formatTip(game.scheduledAt)}</span>
          <ul className="home-tick-effects">
            {game.effects.map((effect) => (
              <li key={effect.canonicalId}>
                <span>{lastName(effect.name)}</span>
                <span className={effect.value >= 0 ? 'is-up' : 'is-down'}>
                  {signedPercent(effect.value)}
                </span>
              </li>
            ))}
          </ul>
        </Link>
      ))}
    </div>
  </nav>
);

export default HomeTicker;
