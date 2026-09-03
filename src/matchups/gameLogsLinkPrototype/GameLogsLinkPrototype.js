/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Four ways a player card on the matchup page can hand you off to that
 * player's game logs. Each variant owns the card's header (name + season
 * scoring) and its footer (the select button), because that is where the
 * variants disagree. Everything between is the shipped card.
 */
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import './prototype.css';

const ScoringLine = ({ player, historical }) => (
  <p>
    {player.seasonScoring === null
      ? 'Season scoring unavailable'
      : `${player.seasonScoring.toFixed(1)} PPG`}
    {historical && player.seasonScoring !== null ? ' · completed-season context' : ''}
  </p>
);

/* A — the name itself is the link. No second line, no second label. */
const HeaderA = ({ player, historical, gameLogsPath }) => (
  <div>
    <h3>
      <Link className="pa-name" to={gameLogsPath} aria-label={`${player.name} game logs`}>
        {player.name}
        <ArrowUpRight size={11} strokeWidth={2.4} aria-hidden="true" />
      </Link>
    </h3>
    <ScoringLine player={player} historical={historical} />
  </div>
);

/* B — the name stays text; a round arrow sits at the right edge of the name row. */
const HeaderB = ({ player, historical, gameLogsPath }) => (
  <div className="pb-row">
    <div>
      <h3>{player.name}</h3>
      <ScoringLine player={player} historical={historical} />
    </div>
    <Link
      className="pb-arrow"
      to={gameLogsPath}
      aria-label={`${player.name} game logs`}
      title="Game logs"
    >
      <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
    </Link>
  </div>
);

/* C — nothing changes up top; the footer carries a paired action "Game logs →". */
const HeaderC = ({ player, historical }) => (
  <div>
    <h3>{player.name}</h3>
    <ScoringLine player={player} historical={historical} />
  </div>
);

const FooterC = ({ player, gameLogsPath, selectButton }) => (
  <div className="pc-actions">
    {selectButton}
    <Link className="pc-logs" to={gameLogsPath} aria-label={`${player.name} game logs`}>
      Game logs <span aria-hidden="true">→</span>
    </Link>
  </div>
);

/* D — a mono LOGS tag on the scoring line, in the same family as the market chips. */
const HeaderD = ({ player, historical, gameLogsPath }) => (
  <div>
    <h3>{player.name}</h3>
    <p className="pd-line">
      <span>
        {player.seasonScoring === null
          ? 'Season scoring unavailable'
          : `${player.seasonScoring.toFixed(1)} PPG`}
        {historical && player.seasonScoring !== null ? ' · completed-season context' : ''}
      </span>
      <Link className="pd-tag" to={gameLogsPath} aria-label={`${player.name} game logs`}>
        LOGS <span aria-hidden="true">↗</span>
      </Link>
    </p>
  </div>
);

const HEADERS = { A: HeaderA, B: HeaderB, C: HeaderC, D: HeaderD };

export const ProtoHeader = ({ variant, ...props }) => {
  const Header = HEADERS[variant] || HeaderA;
  return <Header {...props} />;
};

export const ProtoFooter = ({ variant, selectButton, ...props }) =>
  variant === 'C' ? <FooterC selectButton={selectButton} {...props} /> : selectButton;

export { default as PrototypeSwitcher } from './PrototypeSwitcher';
