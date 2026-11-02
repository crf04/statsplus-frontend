import { useCallback, useEffect, useState } from 'react';
import { apiClient, getApiUrl } from '../../config';
import FilterPanelView from '../../filterPanel/FilterPanelView';
import useFilterPanel, { STAT_COLUMNS, STAT_LABELS } from '../../filterPanel/useFilterPanel';
import { lineTypeOptions, mergeFilterSet, parseLine } from '../../filterUtils';
import { fetchGameLogsData, postedLineFor } from '../../gameLogsApi';
import { bookName } from '../../matchups/displayConfig';
import { formatNumber } from '../../numberUtils';
import { PickerField, ReadNote, useRead, useReportRequest } from './pickerParts';
import '../../filterPanel/filterPanel.css';

/*
 * The game-log picker (crf04/statsplus#382): the Log Workspace filter panel,
 * driven from here rather than the URL, starting from Game Logs' defaults: a
 * player, PTS and his posted line. It sends the Filter Set in the web app's
 * own names, and the server converts it to query_game_logs args.
 */

/*
 * The markets a game-log Card charts: the Line Types the MCP tool also takes,
 * in its spelling (FG3M is 3PM), with no FanDuel points and no "None", plus
 * the two tracking stats it charts.
 */
const MCP_SPELLING = { FG3M: '3PM' };
const MARKETS = [
  ...lineTypeOptions.filter((lineType) => !['None', 'FD_PTS'].includes(lineType)),
  'REB_CHANCES',
  'POTENTIAL_AST',
].map((lineType) => ({
  lineType,
  label: `${MCP_SPELLING[lineType] ?? lineType} · ${STAT_LABELS[lineType]}`,
}));

// A Card cannot draw a playtype rating, so the panel never offers it.
const CARD_STAT_COLUMNS = STAT_COLUMNS.filter((column) => column !== 'PLAYTYPE_RTG');

const decodePlayers = (data) => {
  const players = Array.isArray(data) ? data : data?.players;
  if (!Array.isArray(players)) throw new Error('The players endpoint returned an invalid list.');
  return players;
};

const gameDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/* The posted line as its toggle names it, and the game it is posted for: 'MEM @ ORL, Oct 29'. */
const postedLine = (read, lineType) => {
  if (read.status === 'loading') return { name: 'Finding the line…', game: '' };
  const posted = read.status === 'ready' && postedLineFor(read.data.postedLine, lineType);
  if (!posted) return { name: 'None posted', game: '' };
  return {
    name: `${bookName(posted.key)} ${formatNumber(posted.line, 1)}`,
    game: [
      posted.matchup,
      posted.gameDate && gameDay.format(new Date(`${posted.gameDate}T12:00:00Z`)),
    ]
      .filter(Boolean)
      .join(', '),
  };
};

// One empty list, so the panel's season ranges never see a new one each render.
const NO_GAMES = [];

const PlayerPanel = ({ filters, setFilters, playerList, season }) => {
  const player = filters.player_name;
  const noSeason = useCallback(() => {}, []);
  const panel = useFilterPanel({
    playerList,
    selectedPlayer: player,
    appliedFilters: filters,
    seasonGameLogs: season.data?.gameLogs ?? NO_GAMES,
    seasonGameLogsLoading: season.status === 'loading',
    seasonGameLogsFailed: season.status === 'failed',
    onOpenSelfFilters: noSeason,
    onSeasonChange: (choice) =>
      setFilters((current) => mergeFilterSet(current, { season_filter: choice })),
    onApplyFilters: (patch) => setFilters((current) => mergeFilterSet(current, patch)),
  });
  // The builder has no Apply (crf04/statsplus#406): each filter edit applies at
  // once, and the Card pane waits for the edits to settle before it draws.
  const { dirtyCount, apply } = panel;
  useEffect(() => {
    if (dirtyCount > 0) apply();
  }, [dirtyCount, apply]);
  return <FilterPanelView panel={panel} statColumns={CARD_STAT_COLUMNS} menu />;
};

/* A game-log Card: a player, a market, the posted line or one the author types, and filters. */
const GameLogPicker = ({ onRequest }) => {
  const [filters, setFilters] = useState({});
  const [lineType, setLineType] = useState('PTS');
  const [playerInput, setPlayerInput] = useState('');
  const [typed, setTyped] = useState(null);
  const players = useRead('players', (signal) =>
    apiClient.get(getApiUrl('PLAYERS'), { signal }).then(({ data }) => decodePlayers(data)),
  );
  const playerList = players.data ?? [];
  const player = filters.player_name ?? null;
  const season = useRead(player && `${player}|${filters.season_filter ?? ''}`, (signal) =>
    fetchGameLogsData(
      {
        player_name: player,
        ...(filters.season_filter && { season_filter: filters.season_filter }),
      },
      { signal },
    ),
  );
  const line = typed === null ? null : parseLine(typed);
  const posted = postedLine(season, lineType);

  // The Card counts the posted line unless the author typed one.
  useReportRequest(
    player && (typed === null || line)
      ? {
          tool: 'query_game_logs',
          filter_set: { ...filters, line_type: lineType, ...(line && { line: Number(line) }) },
        }
      : null,
    onRequest,
  );

  // A name typed before the list arrived is chosen when it arrives, if it is exactly a listed name.
  const listed = players.data;
  useEffect(() => {
    if (listed?.includes(playerInput) && !player) setFilters({ player_name: playerInput });
  }, [listed, playerInput, player]);

  const choosePlayer = (name) => {
    setPlayerInput(name);
    if (playerList.includes(name)) setFilters({ player_name: name });
    else if (player) setFilters({});
  };

  return (
    <>
      <div className="report-pick-row">
        <PickerField id="report-pick-logs-player" label="Player">
          <input
            id="report-pick-logs-player"
            type="text"
            list="report-pick-logs-players"
            autoComplete="off"
            placeholder="Search a player…"
            value={playerInput}
            onChange={(event) => choosePlayer(event.target.value)}
          />
          <datalist id="report-pick-logs-players">
            {playerList.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </PickerField>
        <PickerField id="report-pick-logs-market" label="Market">
          <select
            id="report-pick-logs-market"
            value={lineType}
            onChange={(event) => setLineType(event.target.value)}
          >
            {MARKETS.map(({ lineType, label }) => (
              <option key={lineType} value={lineType}>
                {label}
              </option>
            ))}
          </select>
        </PickerField>
      </div>
      <ReadNote
        read={players}
        loading="Loading players…"
        failed="We couldn’t load the player list."
      />
      {player && (
        <fieldset className="report-pick-line">
          <legend>Line</legend>
          <div className="report-pick-toggle">
            <label className={typed === null ? 'is-on' : undefined}>
              <input
                type="radio"
                name="report-pick-logs-line"
                checked={typed === null}
                onChange={() => setTyped(null)}
              />
              {posted.name}
            </label>
            <label className={typed !== null ? 'is-on' : undefined}>
              <input
                type="radio"
                name="report-pick-logs-line"
                checked={typed !== null}
                onChange={() => setTyped('')}
              />
              My line
            </label>
          </div>
          {typed === null ? (
            posted.game && <span className="report-edit-help">{posted.game}</span>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              aria-label="My line"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          )}
        </fieldset>
      )}
      {player && (
        <PlayerPanel
          filters={filters}
          setFilters={setFilters}
          playerList={playerList}
          season={season}
        />
      )}
    </>
  );
};

export default GameLogPicker;
