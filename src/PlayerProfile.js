import { useState, useEffect } from 'react';

import { Card, ToggleButtonGroup, ToggleButton, Row, Col } from 'react-bootstrap';
import PlaystyleComparisonChart from './PlaystyleComparisonChart';
import AssistProfileChart from './AssistProfileChart';
import TwoThreeAssistChart from './TwoThreeAssistChart';
import { withRequestReference } from './gameLogsApi';
import { fetchPlayerProfile } from './playerProfileApi';
import { fetchTeamStats } from './teamStatsApi';
import {
  SeasonUnavailableError,
  seasonChoiceLabel,
  seasonUnavailableText,
  trailingNote,
  trailingSample,
} from './servingSeason';
import ShotTypeTable from './profileShooting/ShotTypeTable';
import ShotZoneCourt from './profileShooting/ShotZoneCourt';
import {
  ShotZoneSeasonUnreadError,
  fetchShotZoneMatchup,
  shotZoneUnavailable,
} from './profileShooting/shotZoneMatchupApi';
import { TEAM_CODES } from './targets/opponentContextApi';
import { fetchDietBaselines } from './targets/targetsApi';
import ErrorMessage from './feedback/ErrorMessage';

/*
 * Under a selection a Diet baseline base names the season it serves, never the
 * response's latest one, with that season's sample: its trailing entry's, or
 * the chosen season's own.
 */
const leagueSeasonLabel = (baselines, base, choice) => {
  const served = baselines?.seasonContext && baselines.bases?.[base];
  if (!served?.season) return null;
  const trailing = baselines.trailing?.find(
    (entry) => entry.family === served.family && entry.servingSeason === served.season,
  );
  const teamGames = trailing
    ? trailing.teamGames
    : served.season === choice?.season
      ? choice.teamGames
      : null;
  return `League averages from ${served.season} (${trailingSample(teamGames)})`;
};

// `seasonChoice` is the /seasons choice of an Evidence season other than the
// default (crf04/statsplus#330), or null for the default.
const PlayerProfile = ({ selectedPlayer, selectedTeam, seasonChoice = null, onSettled }) => {
  const season = seasonChoice?.season ?? null;
  const [selectedProfile, setSelectedProfile] = useState('Playtypes');
  const [playerData, setPlayerData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  // What the profile on screen trails on under a selection.
  const [profileTrailing, setProfileTrailing] = useState(null);
  const [teamError, setTeamError] = useState(null);
  // The read each half last finished for, so "settled" is judged against the
  // current inputs rather than a loading flag an effect has yet to raise.
  const [playerSettledFor, setPlayerSettledFor] = useState(null);
  const [teamSettledFor, setTeamSettledFor] = useState(null);
  // Zone Shooting is the Matchup court against the page's opponent, by tricode.
  const zoneOpponent =
    selectedProfile === 'Zone Shooting' ? (TEAM_CODES[selectedTeam] ?? null) : undefined;
  const hasPlayer = selectedPlayer !== 'None';
  const teamCategory =
    selectedProfile === 'Playtypes'
      ? 'Playtypes'
      : selectedProfile === 'assists'
        ? 'Assists'
        : null;
  const comparisonTeam = hasPlayer && teamCategory ? selectedTeam : null;
  const playerReadKey = hasPlayer
    ? `${selectedPlayer}|${selectedProfile}|${zoneOpponent}|${season}`
    : null;
  const teamReadKey = comparisonTeam ? `${teamCategory}|${comparisonTeam}|${season}` : null;
  const settled =
    (!playerReadKey || playerSettledFor === playerReadKey) &&
    (!teamReadKey || teamSettledFor === teamReadKey);

  useEffect(() => {
    // Unsettled is reported too, so readiness from an earlier read of the same
    // player and opponent cannot stand in for the one now in flight.
    if (settled) onSettled?.(selectedPlayer, selectedTeam);
    else onSettled?.(null);
  }, [settled, selectedPlayer, selectedTeam, onSettled]);
  // Unmounted, it has settled for nothing; a remount must answer again.
  useEffect(() => () => onSettled?.(null), [onSettled]);

  useEffect(() => {
    const controller = new AbortController();
    setPlayerData(null);
    setPlayerError(null);
    setProfileTrailing(null);
    setPlayerLoading(hasPlayer);
    setPlayerSettledFor(null);
    const readProfile = () =>
      fetchPlayerProfile(
        {
          player_name: selectedPlayer,
          category: selectedProfile,
          ...(season ? { season } : {}),
        },
        { signal: controller.signal },
      ).then(({ data, seasonContext, trailing }) => {
        if (!controller.signal.aborted && seasonContext) {
          setProfileTrailing(trailingNote(trailing, seasonContext, 'Profile numbers'));
        }
        return data && Object.keys(data).length > 0 ? data : null;
      });
    const read = () => {
      if (selectedProfile === 'Zone Shooting') {
        return zoneOpponent
          ? fetchShotZoneMatchup(selectedPlayer, zoneOpponent, {
              signal: controller.signal,
              season,
            })
          : Promise.resolve({ noOpponent: true });
      }
      if (selectedProfile === 'Shooting Type') {
        // The league tick is supplementary: without baselines the table still reads.
        return Promise.all([
          readProfile(),
          fetchDietBaselines({ signal: controller.signal, season }).catch(() => null),
        ]).then(([rows, baselines]) =>
          rows
            ? {
                rows,
                leagueShares: baselines?.shares?.shot_types ?? null,
                leagueSeason: leagueSeasonLabel(baselines, 'shot_types', seasonChoice),
              }
            : null,
        );
      }
      return readProfile();
    };
    if (hasPlayer) {
      read()
        .then((data) => {
          if (controller.signal.aborted) return;
          if (data?.noOpponent) return;
          if (data) setPlayerData(data);
          else setPlayerError('No data available for this player');
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setPlayerError(
            selectedProfile === 'Zone Shooting' && shotZoneUnavailable(error)
              ? `No shot zone matchup for ${selectedPlayer} this season.`
              : error instanceof ShotZoneSeasonUnreadError
                ? error.message
                : error instanceof SeasonUnavailableError
                  ? seasonUnavailableText(error.selectedSeason ?? season)
                  : withRequestReference('Failed to fetch data. Please try again.', error),
          );
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setPlayerLoading(false);
          setPlayerSettledFor(playerReadKey);
        });
    }
    return () => controller.abort();
  }, [
    selectedPlayer,
    selectedProfile,
    zoneOpponent,
    season,
    seasonChoice,
    hasPlayer,
    playerReadKey,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setTeamData(null);
    setTeamError(null);
    setTeamLoading(Boolean(comparisonTeam));
    setTeamSettledFor(null);
    if (comparisonTeam) {
      fetchTeamStats(
        {
          category: teamCategory,
          team: comparisonTeam,
          ...(season ? { season } : {}),
        },
        { signal: controller.signal },
      )
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          if (data && Object.keys(data).length > 0) setTeamData(data);
          else setTeamError('No data available for this team');
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setTeamError(
            error instanceof SeasonUnavailableError
              ? seasonUnavailableText(error.selectedSeason ?? season)
              : withRequestReference('Failed to fetch data. Please try again.', error),
          );
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setTeamLoading(false);
          setTeamSettledFor(teamReadKey);
        });
    }
    return () => controller.abort();
  }, [teamCategory, comparisonTeam, season, teamReadKey]);

  // Until the read for the current view has finished, the data in state belongs
  // to the previous view (a tab switch renders once before the read clears it).
  const loading =
    playerLoading ||
    (Boolean(playerReadKey) && playerSettledFor !== playerReadKey) ||
    (Boolean(teamCategory) && teamLoading);
  const error = [...new Set([playerError, teamCategory && teamError].filter(Boolean))].join(' ');

  const renderAssistProfile = () => {
    if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
      return <p>No assist data available</p>;
    }

    const assistData = playerData[0];

    return (
      <Row>
        <Col md={12}>
          <h6 className="subcategory-heading no-border">
            {selectedPlayer}'s Assist Profile vs {selectedTeam || 'All'}
          </h6>
          <AssistProfileChart assistData={assistData} teamData={teamData} />
          <TwoThreeAssistChart assistData={assistData} teamData={teamData} />
        </Col>
      </Row>
    );
  };

  const renderZoneShootingProfile = () => {
    if (!zoneOpponent) {
      return <p>Pick an opponent in the Opposing Team card to see his zones against them.</p>;
    }
    if (!playerData) {
      return <p>No zone shooting data available</p>;
    }
    const { seasonContext, trailing } = playerData;
    const note = seasonContext && trailingNote(trailing, seasonContext, 'Zones');
    return (
      <>
        {seasonContext && (
          <p className="ps-evidence-season">
            Evidence season{' '}
            {seasonChoiceLabel(seasonChoice ?? { season: seasonContext.selectedSeason })}
          </p>
        )}
        {note && <p className="ps-evidence-season">{note}</p>}
        <ShotZoneCourt matchup={playerData} />
      </>
    );
  };

  const renderShootingTypeProfile = () => {
    const rows = playerData?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return <p>No shooting type data available</p>;
    }
    return (
      <>
        {playerData.leagueSeason && <p className="ps-evidence-season">{playerData.leagueSeason}</p>}
        <ShotTypeTable rows={rows} leagueShares={playerData.leagueShares} />
      </>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <p>Loading data...</p>;
    }

    if (error) {
      return (
        <p className="text-danger">
          <ErrorMessage message={error} />
        </p>
      );
    }

    return (
      <>
        {profileTrailing && <p className="ps-evidence-season">{profileTrailing}</p>}
        {renderProfile()}
      </>
    );
  };

  const renderProfile = () => {
    switch (selectedProfile) {
      case 'Playtypes':
        return playerData ? (
          <div style={{ width: '100%', height: '500px' }}>
            <h6 className="subcategory-heading no-border">
              {selectedPlayer} vs {selectedTeam || 'All'}
            </h6>
            <PlaystyleComparisonChart playerData={playerData} teamData={teamData} />
          </div>
        ) : (
          <p>No player data available</p>
        );
      case 'assists':
        return renderAssistProfile();
      case 'Shooting Type':
        return renderShootingTypeProfile();
      case 'Zone Shooting':
        return renderZoneShootingProfile();
      default:
        return <p>Select a profile type</p>;
    }
  };
  const handleSelectedProfile = (profile) => {
    setSelectedProfile(profile);
  };

  return (
    <Card className="dark-card">
      <Card.Body>
        <h4 className="mb-2">Player Profile</h4>
        <div className="category-toggles-wrapper">
          <ToggleButtonGroup
            type="radio"
            name="player-profile"
            value={selectedProfile}
            onChange={handleSelectedProfile}
            className="per36-toggle-group"
          >
            <ToggleButton
              id="profile-playtypes"
              value="Playtypes"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Playtypes
            </ToggleButton>
            <ToggleButton
              id="profile-assists"
              value="assists"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Assists
            </ToggleButton>
            <ToggleButton
              id="profile-shooting-type"
              value="Shooting Type"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Shooting Type
            </ToggleButton>
            <ToggleButton
              id="profile-zone-shooting"
              value="Zone Shooting"
              variant="outline-primary"
              className="per36-toggle-btn"
            >
              Zone Shooting
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default PlayerProfile;
