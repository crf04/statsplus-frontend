import { useState, useEffect } from 'react';

import { Card } from 'react-bootstrap';
import { withRequestReference } from './gameLogsApi';
import { SeasonUnavailableError, seasonUnavailableText } from './servingSeason';
import ProfileMatchupCard from './profileMatchup/ProfileMatchupCard';
import { fetchProfileMatchup, matchupUnavailable } from './profileMatchup/profileMatchupApi';
import { TEAM_CODES } from './targets/opponentContextApi';
import ErrorMessage from './feedback/ErrorMessage';

/*
 * The Player Profile: the MCP `get_matchup` read of this player against the opponent chosen in
 * the Opposing Team card (crf04/statsplus#451), for the game logs' Line Type. It reads the
 * Workspace's Evidence season, as the Opposing Team Profile does (crf04/statsplus#453):
 * `seasonChoice` is that season's choice when it is not the default, else null, and the read
 * then names no season. The header names the season the response read.
 */
const PlayerProfile = ({
  selectedPlayer,
  selectedTeam,
  seasonChoice = null,
  lineType,
  setLineType,
  onSettled,
}) => {
  const opponent = TEAM_CODES[selectedTeam] ?? null;
  const season = seasonChoice?.season ?? null;
  const hasPlayer = selectedPlayer !== 'None';
  const readKey = hasPlayer && opponent ? `${selectedPlayer}|${opponent}|${season}` : null;
  // The read last finished, with the inputs it was for, so a late answer for an earlier
  // player, opponent or season can never stand in for the current one.
  const [read, setRead] = useState({ key: null, reading: null, error: null });
  // Each new read starts unsettled, before any effect reports readiness, so returning to an
  // earlier player and opponent waits for that read again.
  const [readingFor, setReadingFor] = useState(readKey);
  if (readingFor !== readKey) {
    setReadingFor(readKey);
    setRead({ key: null, reading: null, error: null });
  }
  const settled = !readKey || read.key === readKey;

  useEffect(() => {
    // Unsettled is reported too, so readiness from an earlier read of the same
    // player and opponent cannot stand in for the one now in flight.
    if (settled) onSettled?.(selectedPlayer, selectedTeam);
    else onSettled?.(null);
  }, [settled, selectedPlayer, selectedTeam, onSettled]);
  // Unmounted, it has settled for nothing; a remount must answer again.
  useEffect(() => () => onSettled?.(null), [onSettled]);

  useEffect(() => {
    if (!readKey) return undefined;
    const controller = new AbortController();
    fetchProfileMatchup(selectedPlayer, opponent, { signal: controller.signal, season })
      .then((reading) => {
        if (!controller.signal.aborted) setRead({ key: readKey, reading, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setRead({
          key: readKey,
          reading: null,
          error: matchupUnavailable(error)
            ? `No matchup read for ${selectedPlayer} this season.`
            : error instanceof SeasonUnavailableError
              ? seasonUnavailableText(error.selectedSeason ?? season)
              : withRequestReference('Failed to fetch data. Please try again.', error),
        });
      });
    return () => controller.abort();
  }, [readKey, selectedPlayer, opponent, season]);

  const renderContent = () => {
    if (!hasPlayer) return <p>Select a player to see his matchup.</p>;
    if (!opponent) {
      return <p>Pick an opponent in the Opposing Team card to see his matchup against them.</p>;
    }
    if (!settled) return <p>Loading data...</p>;
    if (read.error) {
      return (
        <p className="text-danger">
          <ErrorMessage message={read.error} />
        </p>
      );
    }
    return (
      <ProfileMatchupCard reading={read.reading} lineType={lineType} setLineType={setLineType} />
    );
  };

  return (
    <Card className="dark-card pmc-card">
      <Card.Body>
        <h4 className="mb-2">Player Profile</h4>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default PlayerProfile;
