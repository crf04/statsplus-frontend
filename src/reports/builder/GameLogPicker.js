import { useCallback, useState } from 'react';
import { apiClient, getApiUrl } from '../../config';
import FilterPanelView from '../../filterPanel/FilterPanelView';
import useFilterPanel, { STAT_COLUMNS, STAT_LABELS } from '../../filterPanel/useFilterPanel';
import { lineTypeOptions, mergeFilterSet, parseLine } from '../../filterUtils';
import { fetchGameLogsData, postedLineFor } from '../../gameLogsApi';
import { bookName } from '../../matchups/displayConfig';
import { formatNumber } from '../../numberUtils';
import { PickerField, PreviewButton, ReadNote, TeamSelect, useRead } from './pickerParts';
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

const PostedLine = ({ read, lineType }) => {
  if (read.status === 'loading') return 'finding it…';
  const posted = read.status === 'ready' && postedLineFor(read.data.postedLine, lineType);
  if (!posted) return 'none posted for this market';
  const game = [posted.matchup, posted.gameDate].filter(Boolean).join(', ');
  return `${bookName(posted.key)} ${formatNumber(posted.line, 1)}${game ? ` (${game})` : ''}`;
};

// One empty list, so the panel's season ranges never see a new one each render.
const NO_GAMES = [];

const PlayerPanel = ({ filters, setFilters, playerList, season, request, busy, onPreview }) => {
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
    onSeasonChange: (choice) => setFilters(mergeFilterSet(filters, { season_filter: choice })),
    // The panel's Apply previews the Card with the filters it emits.
    onApplyFilters: (patch) => {
      const next = mergeFilterSet(filters, patch);
      setFilters(next);
      const nextRequest = request(next);
      if (nextRequest) onPreview(nextRequest);
    },
  });
  return (
    <>
      <TeamSelect
        id="report-pick-logs-opponent"
        label="Opponent (optional)"
        empty="Any opponent"
        value={panel.opponentTricode}
        onChange={panel.changeOpponent}
      />
      <FilterPanelView panel={panel} statColumns={CARD_STAT_COLUMNS} />
      <button
        type="button"
        className="report-listing-button"
        disabled={busy || !request(filters)}
        onClick={panel.apply}
      >
        {busy ? 'Drawing…' : 'Preview card'}
      </button>
    </>
  );
};

/* A game-log Card: a player, a market, the posted line or one the author types, and filters. */
const GameLogPicker = ({ busy, onPreview }) => {
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

  // The Card counts the posted line unless the author typed one.
  const request = (set) =>
    set.player_name && (typed === null || line)
      ? {
          tool: 'query_game_logs',
          filter_set: { ...set, line_type: lineType, ...(line && { line: Number(line) }) },
        }
      : null;

  const choosePlayer = (name) => {
    setPlayerInput(name);
    if (playerList.includes(name)) setFilters({ player_name: name });
    else if (player) setFilters({});
  };

  return (
    <>
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
      <ReadNote
        read={players}
        loading="Loading players…"
        failed="We couldn’t load the player list."
      />
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
      {player && (
        <fieldset className="report-pick-choices">
          <legend>Line</legend>
          <label>
            <input
              type="radio"
              name="report-pick-logs-line"
              checked={typed === null}
              onChange={() => setTyped(null)}
            />
            <span>
              Posted line: <PostedLine read={season} lineType={lineType} />
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="report-pick-logs-line"
              checked={typed !== null}
              onChange={() => setTyped('')}
            />
            My line
          </label>
          {typed !== null && (
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
      {player ? (
        <PlayerPanel
          filters={filters}
          setFilters={setFilters}
          playerList={playerList}
          season={season}
          request={request}
          busy={busy}
          onPreview={onPreview}
        />
      ) : (
        <PreviewButton request={null} busy={busy} onPreview={onPreview} />
      )}
    </>
  );
};

export default GameLogPicker;
