import { Link } from 'react-router-dom';
import { formatTip } from '../calendarDate';
import { dayName, lastName, matchupsPath, shortSlateDay, signedPercent } from './homeFormat';

/*
 * The scoreboard under the header: every game today, in tip-off order, with
 * its five biggest Matchup effects either way across the player-level stats
 * (PTS, REB, AST, 3PM, combos and field goals), each tagged with its stat
 * (crf04/statsplus#470). A backend that does not send those leaders yet
 * leaves the game's three biggest points effects, untagged. A thin sample is underlined dotted as on the Matchup rail. Each
 * cell opens the game's Matchup.
 */
const rowsOf = (game) => game.leaders ?? game.effects;

const rowLabel = (row) =>
  `, ${lastName(row.name)}${row.market ? ` ${row.market}` : ''} ${signedPercent(row.value)}${
    row.thin ? ' thin sample' : ''
  }`;

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
          className={`home-tick${game.leaders ? ' has-stat' : ''}`}
          aria-label={`${game.away.tricode} at ${game.home.tricode} Matchup, ${formatTip(
            game.scheduledAt,
          )}${rowsOf(game).map(rowLabel).join('')}`}
        >
          <span className="home-tick-teams">
            {game.away.tricode} @ {game.home.tricode}
          </span>
          <span className="home-tick-time">{formatTip(game.scheduledAt)}</span>
          <ul className="home-tick-effects">
            {rowsOf(game).map((row) => (
              <li key={row.canonicalId}>
                <span className="home-tick-name">{lastName(row.name)}</span>
                {row.market && <span className="home-tick-stat">{row.market}</span>}
                <span
                  className={`${row.value >= 0 ? 'is-up' : 'is-down'}${row.thin ? ' thin' : ''}`}
                  title={row.thin ? 'Thin sample' : undefined}
                >
                  {signedPercent(row.value)}
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
