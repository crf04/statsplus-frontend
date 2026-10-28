import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authorPath, previewSrc, shortDate } from './researchFormat';

const PLAYERS_SHOWN = 4;

/* What a report's cards cover: its games as chips, then the players it names. */
const Covers = ({ games, players }) => {
  if (!games.length && !players.length) return null;
  const more = players.length - PLAYERS_SHOWN;
  return (
    <div className="research-covers">
      {games.length > 0 && (
        <ul className="research-games" aria-label="Games">
          {games.map((game) => (
            <li key={game}>{game}</li>
          ))}
        </ul>
      )}
      {players.length > 0 && (
        <p className="research-players">
          {players.slice(0, PLAYERS_SHOWN).join(', ')}
          {more > 0 ? ` +${more} more` : ''}
        </p>
      )}
    </div>
  );
};

/* One listed report in the feed: the whole card opens it; the handle opens its author. */
const ResearchEntry = ({ entry, featured = false, compact = false, headingLevel = 3 }) => {
  const Heading = `h${headingLevel}`;
  // An image that fails to load leaves the card's own ground, not a broken icon.
  const [broken, setBroken] = useState(false);
  return (
    <article
      className={`research-entry${featured ? ' is-featured' : ''}${compact ? ' is-compact' : ''}`}
    >
      <div className="research-entry-media">
        {broken ? (
          <span className="research-entry-placeholder" aria-hidden="true">
            CourtAI report
          </span>
        ) : (
          <img
            src={previewSrc(entry.previewUrl)}
            alt=""
            loading="lazy"
            width="1200"
            height="630"
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <div className="research-entry-body">
        {featured && <p className="research-entry-flag">Featured</p>}
        <Heading className="research-entry-title">
          <Link to={`/reports/${entry.id}`}>{entry.title}</Link>
        </Heading>
        <p className="research-entry-meta">
          <Link to={authorPath(entry.handle)} className="research-entry-author">
            @{entry.handle}
          </Link>
          <span aria-hidden="true"> · </span>
          <time dateTime={entry.date || entry.createdAt}>
            {shortDate(entry.date || entry.createdAt)}
          </time>
        </p>
        {!compact && <Covers games={entry.games} players={entry.players} />}
      </div>
    </article>
  );
};

export default ResearchEntry;
