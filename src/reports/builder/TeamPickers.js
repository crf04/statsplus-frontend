import { useState } from 'react';
import { fetchSeasons } from '../../seasonsApi';
import { fetchSeasonMinutes } from '../../targets/targetsApi';
import {
  DateField,
  PickerField,
  PreviewButton,
  ReadNote,
  slateToday,
  TeamSelect,
  useRead,
} from './pickerParts';

/* The on/off and injuries pickers (crf04/statsplus#382). */

// get_on_off takes at most 5 players on the floor and 15 off it.
const MAX_ON = 5;
const MAX_OFF = 15;

/* An on/off Card: a team, the players on and off the floor, and a season. */
export const OnOffPicker = ({ busy, onPreview }) => {
  const [team, setTeam] = useState('');
  const [season, setSeason] = useState('');
  const [floor, setFloor] = useState({});
  const seasons = useRead('seasons', () => fetchSeasons());
  const roster = useRead(team ? `${team}|${season}` : null, (signal) =>
    fetchSeasonMinutes({ opponent: team, season: season || undefined, signal }),
  );
  const named = (side) => Object.keys(floor).filter((name) => floor[name] === side);
  const on = named('on');
  const off = named('off');
  const request =
    team && on.length + off.length > 0
      ? {
          tool: 'get_on_off',
          args: {
            team,
            ...(on.length && { on }),
            ...(off.length && { off }),
            ...(season && { season }),
          },
        }
      : null;

  return (
    <>
      <TeamSelect
        id="report-pick-onoff-team"
        value={team}
        onChange={(next) => {
          setTeam(next);
          setFloor({});
        }}
      />
      <PickerField id="report-pick-onoff-season" label="Season">
        <select
          id="report-pick-onoff-season"
          value={season}
          onChange={(event) => {
            setSeason(event.target.value);
            setFloor({});
          }}
        >
          <option value="">Default season</option>
          {(seasons.data?.seasons ?? []).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </PickerField>
      {team && (
        <ReadNote
          read={roster}
          loading="Finding the team’s players…"
          failed="We couldn’t load the team’s players."
        />
      )}
      {roster.status === 'ready' && (
        <fieldset className="report-pick-roster">
          <legend>
            Players on the floor (up to {MAX_ON}) and off it (up to {MAX_OFF})
          </legend>
          {roster.data.players.map(({ playerId, name }) => (
            <PickerField key={playerId} id={`report-pick-onoff-${playerId}`} label={name}>
              <select
                id={`report-pick-onoff-${playerId}`}
                value={floor[name] ?? ''}
                onChange={(event) => setFloor({ ...floor, [name]: event.target.value })}
              >
                <option value="">Either</option>
                <option value="on" disabled={floor[name] !== 'on' && on.length >= MAX_ON}>
                  On the floor
                </option>
                <option value="off" disabled={floor[name] !== 'off' && off.length >= MAX_OFF}>
                  Off the floor
                </option>
              </select>
            </PickerField>
          ))}
        </fieldset>
      )}
      <PreviewButton request={request} busy={busy} onPreview={onPreview} />
    </>
  );
};

/* An injuries Card: the official report on a date, for every team or one. */
export const InjuriesPicker = ({ busy, onPreview }) => {
  const [date, setDate] = useState(slateToday);
  const [team, setTeam] = useState('');
  const request = date ? { tool: 'get_injuries', args: { date, ...(team && { team }) } } : null;
  return (
    <>
      <DateField id="report-pick-injuries-date" value={date} onChange={setDate} />
      <TeamSelect
        id="report-pick-injuries-team"
        label="Team (optional)"
        empty="Every team"
        value={team}
        onChange={setTeam}
      />
      <PreviewButton request={request} busy={busy} onPreview={onPreview} />
    </>
  );
};
