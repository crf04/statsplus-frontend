import { useState } from 'react';
import { fetchMatchup } from '../../matchups/matchupApi';
import { fetchSlate } from '../../slateApi';
import {
  DateField,
  gameName,
  PickerField,
  PreviewButton,
  ReadNote,
  slateToday,
  TeamSelect,
  useRead,
} from './pickerParts';

/*
 * The Matchup and rotation pickers (crf04/statsplus#382): each offers only the
 * games and players whose Card the server can draw.
 */

/* A Matchup Card: a date (today by default), one of that day's games, then a player in it. */
export const MatchupPicker = ({ busy, onPreview }) => {
  const [date, setDate] = useState(slateToday);
  const [gameId, setGameId] = useState('');
  const [player, setPlayer] = useState('');
  const slate = useRead(date || null, (signal) => fetchSlate(date, { signal }));
  const games = (slate.data?.games ?? []).filter((game) => game.status !== 'postponed');
  const game = games.find((candidate) => candidate.gameId === gameId) ?? null;
  const matchup = useRead(game ? game.gameId : null, (signal) =>
    fetchMatchup(game.gameId, { signal }),
  );
  const teams = game ? [game.away.tricode, game.home.tricode] : [];
  const players = matchup.data?.players ?? [];
  const request =
    game && player ? { tool: 'get_matchup', args: { game: gameName(game), date, player } } : null;

  return (
    <>
      <DateField
        id="report-pick-matchup-date"
        value={date}
        onChange={(next) => {
          setDate(next);
          setGameId('');
          setPlayer('');
        }}
      />
      <ReadNote
        read={slate}
        loading="Finding that day’s games…"
        failed="We couldn’t load that day’s games."
      />
      {slate.status === 'ready' &&
        (games.length ? (
          <PickerField id="report-pick-matchup-game" label="Game">
            <select
              id="report-pick-matchup-game"
              value={gameId}
              onChange={(event) => {
                setGameId(event.target.value);
                setPlayer('');
              }}
            >
              <option value="">Choose a game</option>
              {games.map((candidate) => (
                <option key={candidate.gameId} value={candidate.gameId}>
                  {gameName(candidate)}
                </option>
              ))}
            </select>
          </PickerField>
        ) : (
          <p className="report-edit-help">No games on this date.</p>
        ))}
      {game && (
        <ReadNote
          read={matchup}
          loading="Finding the game’s players…"
          failed="We couldn’t load this game’s players."
        />
      )}
      {matchup.status === 'ready' && (
        <PickerField id="report-pick-matchup-player" label="Player">
          <select
            id="report-pick-matchup-player"
            value={player}
            onChange={(event) => setPlayer(event.target.value)}
          >
            <option value="">Choose a player</option>
            {teams.map((tricode) => (
              <optgroup key={tricode} label={tricode}>
                {players
                  .filter((candidate) => candidate.tricode === tricode)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.name}>
                      {candidate.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </PickerField>
      )}
      <PreviewButton request={request} busy={busy} onPreview={onPreview} />
    </>
  );
};

const plays = (team) => (game) => game.away.tricode === team || game.home.tricode === team;

// At most this many Slate reads walk back for a team's last games.
const MAX_SLATE_READS = 60;

/* A team's last `n` completed games, newest first, each with the Slate date it was played on. */
const recentGames = async (team, n, signal) => {
  const found = [];
  let date = slateToday();
  for (let reads = 0; date && found.length < n && reads < MAX_SLATE_READS; reads += 1) {
    const slate = await fetchSlate(date, { signal });
    slate.games
      .filter((game) => game.status === 'final' && plays(team)(game))
      .forEach((game) => found.push({ date: slate.slateDate, game }));
    date = slate.previousGameDate;
  }
  return found.slice(0, n);
};

const rotationRequest = (choice) =>
  choice
    ? { tool: 'get_rotation', args: { game: gameName(choice.game), date: choice.date } }
    : null;

const RotationOnDate = ({ team, busy, onPreview }) => {
  const [date, setDate] = useState(slateToday);
  const slate = useRead(date ? `${team}|${date}` : null, (signal) => fetchSlate(date, { signal }));
  const game = slate.data?.games.find(plays(team)) ?? null;
  const played = game?.status === 'final';
  return (
    <>
      <DateField id="report-pick-rotation-date" value={date} onChange={setDate} />
      <ReadNote
        read={slate}
        loading="Finding the game…"
        failed="We couldn’t load that day’s games."
      />
      {slate.status === 'ready' && (
        <p className="report-edit-help" role="status">
          {!game
            ? `${team} has no game on this date.`
            : played
              ? `${gameName(game)}, final.`
              : `${gameName(game)} hasn’t finished, so it has no rotation yet.`}
        </p>
      )}
      <PreviewButton
        request={played ? rotationRequest({ game, date }) : null}
        busy={busy}
        onPreview={onPreview}
      />
    </>
  );
};

const RotationRecent = ({ team, busy, onPreview }) => {
  const [count, setCount] = useState(5);
  const [chosen, setChosen] = useState(null);
  const n = Math.min(20, Math.max(1, Number(count) || 1));
  const games = useRead(`${team}|${n}`, (signal) => recentGames(team, n, signal));
  const choice = games.data?.find(({ game }) => game.gameId === chosen) ?? null;
  return (
    <>
      <PickerField id="report-pick-rotation-count" label="Last N games">
        <input
          id="report-pick-rotation-count"
          type="number"
          min="1"
          max="20"
          inputMode="numeric"
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
      </PickerField>
      <ReadNote
        read={games}
        loading="Finding the team’s games…"
        failed="We couldn’t load the team’s games."
      />
      {games.status === 'ready' &&
        (games.data.length ? (
          <fieldset className="report-pick-choices">
            <legend>Game</legend>
            {games.data.map(({ date, game }) => (
              <label key={game.gameId}>
                <input
                  type="radio"
                  name="report-pick-rotation-game"
                  checked={chosen === game.gameId}
                  onChange={() => setChosen(game.gameId)}
                />
                {gameName(game)}, {date}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="report-edit-help">{team} has no completed games yet.</p>
        ))}
      <PreviewButton request={rotationRequest(choice)} busy={busy} onPreview={onPreview} />
    </>
  );
};

/* A rotation Card: a team, then its game on a date or one of its last N games. */
export const RotationPicker = ({ busy, onPreview }) => {
  const [team, setTeam] = useState('');
  const [way, setWay] = useState('date');
  const Way = way === 'date' ? RotationOnDate : RotationRecent;
  return (
    <>
      <TeamSelect id="report-pick-rotation-team" value={team} onChange={setTeam} />
      <fieldset className="report-pick-choices report-pick-inline">
        <legend>Find the game</legend>
        <label>
          <input
            type="radio"
            name="report-pick-rotation-way"
            checked={way === 'date'}
            onChange={() => setWay('date')}
          />
          On a date
        </label>
        <label>
          <input
            type="radio"
            name="report-pick-rotation-way"
            checked={way === 'recent'}
            onChange={() => setWay('recent')}
          />
          From the last N games
        </label>
      </fieldset>
      {team ? (
        <Way key={team} team={team} busy={busy} onPreview={onPreview} />
      ) : (
        <PreviewButton request={null} busy={busy} onPreview={onPreview} />
      )}
    </>
  );
};
