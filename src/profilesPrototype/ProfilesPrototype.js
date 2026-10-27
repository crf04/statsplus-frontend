/*
 * PROTOTYPE — throwaway (branch prototype/profiles-simplify).
 *
 * Question: can the Player Profile + Opposing Team Profile pair say the same
 * thing with less? Variant 0 is today's pair, untouched. A, B and C read the
 * same three payloads (his play-type mix, the opponent's play-type defense,
 * the opponent's Traditional sheet) and disagree about layout.
 *
 * The old "Total Matchup Rating" (e.g. 102.56) is Σ share × defense ratio, so
 * 102.56 means his mix meets a defense 2.56% softer than league. Every variant
 * says that in words instead of the bare number.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card } from 'react-bootstrap';
import '../readings.css';
import './profilesPrototype.css';
import { apiClient, getApiUrl } from '../config';
import { fetchPlayerProfile } from '../playerProfileApi';
import OpponentBars from '../opponentProfile/OpponentBars';
import { formatVsLeague, opponentReadings } from '../opponentProfile/opponentReadings';
import Switcher from './Switcher';
import { VARIANT_NAMES, useVariant } from './mode';

const LABELS = {
  PRBallHandler: 'P&R handler',
  PRRollMan: 'P&R roll man',
  Isolation: 'Isolation',
  Spotup: 'Spot-up',
  Transition: 'Transition',
  Postup: 'Post-up',
  Cut: 'Cut',
  OffScreen: 'Off screen',
  Handoff: 'Handoff',
  OffRebound: 'Putbacks',
  Misc: 'Misc',
};

const teamShort = (team) => (team ? team.split(' ').slice(-1)[0] : 'opponent');
const lastName = (player) => player.split(' ').slice(-1)[0];

const useProfileData = (player, team) => {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    if (!player || player === 'None' || !team) return undefined;
    const controller = new AbortController();
    const signal = controller.signal;
    setState({ loading: true });
    const teamStats = (category) =>
      apiClient
        .get(getApiUrl('TEAM_STATS'), { params: { category, team }, signal })
        .then(({ data }) => data)
        .catch(() => null);
    Promise.all([
      fetchPlayerProfile({ player_name: player, category: 'Playtypes' }, { signal })
        .then(({ data }) => data)
        .catch(() => null),
      teamStats('Playtypes'),
      teamStats('Traditional'),
    ]).then(([mix, defense, traditional]) => {
      if (!signal.aborted) setState({ loading: false, mix, defense, traditional });
    });
    return () => controller.abort();
  }, [player, team]);
  return state;
};

/* His play types, biggest share first, each with the opponent's reading. */
const playRows = (mix, defense) => {
  if (!mix || typeof mix !== 'object') return [];
  return Object.keys(mix)
    .filter((key) => key.includes('%'))
    .map((key) => {
      const type = key.replace('%', '');
      const share = parseFloat(mix[key]) || 0;
      const ratio = defense ? parseFloat(defense[type]) : NaN;
      return {
        type,
        label: LABELS[type] ?? type,
        share,
        vs: Number.isFinite(ratio) ? (ratio - 1) * 100 : null,
        rank: defense ? parseInt(defense[`${type}_RANK`], 10) || null : null,
      };
    })
    .filter((row) => row.share > 0)
    .sort((a, b) => b.share - a.share);
};

const blended = (rows) => {
  const total = rows.reduce((sum, row) => sum + row.share, 0);
  if (!total || rows.every((row) => row.vs === null)) return null;
  return rows.reduce((sum, row) => sum + row.share * (row.vs ?? 0), 0) / total;
};

const tone = (vs) => (vs === null ? 'flat' : vs >= 3 ? 'more' : vs <= -3 ? 'less' : 'flat');

const Verdict = ({ player, team, blend }) => {
  if (blend === null) return null;
  const word = Math.abs(blend) < 1 ? 'about average' : blend > 0 ? 'softer' : 'tougher';
  return (
    <p className="pp-verdict">
      {lastName(player)}'s play-type mix meets a{' '}
      <span className={`pp-tone-${tone(blend)}`}>
        {Math.abs(blend) < 1 ? word : `${Math.abs(blend).toFixed(1)}% ${word}`}
      </span>{' '}
      {teamShort(team)} defense than league average.
    </p>
  );
};

const Rank = ({ rank }) =>
  rank ? (
    <span className="rank-pill" style={{ '--rank': rank }} title={`Rank ${rank} of 30`}>
      {rank}
    </span>
  ) : (
    <span className="pp-muted">–</span>
  );

const TeamPicker = ({ teams, team, onChange }) => (
  <select className="pp-team-picker" value={team} onChange={(e) => onChange(e.target.value)}>
    {teams.map((t) => (
      <option key={t} value={t}>
        {t}
      </option>
    ))}
  </select>
);

const traditionalRows = (traditional) =>
  opponentReadings('Traditional', traditional).flatMap((group) => group.rows);

/* ---------- A: one card, one table ---------- */

const VariantA = ({ player, team, teams, chooseTeam, data }) => {
  const [tab, setTab] = useState('plays');
  const rows = playRows(data.mix, data.defense);
  const maxShare = Math.max(1, ...rows.map((row) => row.share));
  const team3 = traditionalRows(data.traditional);
  return (
    <Card className="dark-card">
      <Card.Body>
        <div className="pp-head">
          <h4 className="mb-0">
            {player} <span className="pp-muted">vs</span>
          </h4>
          <TeamPicker teams={teams} team={team} onChange={chooseTeam} />
        </div>
        <Verdict player={player} team={team} blend={blended(rows)} />
        <div className="pp-tabs" role="tablist">
          <button
            type="button"
            className={tab === 'plays' ? 'on' : ''}
            onClick={() => setTab('plays')}
          >
            Play types
          </button>
          <button
            type="button"
            className={tab === 'team' ? 'on' : ''}
            onClick={() => setTab('team')}
          >
            Team stats allowed
          </button>
        </div>
        {tab === 'plays' ? (
          <table className="pp-table">
            <thead>
              <tr>
                <th>Play type</th>
                <th>His share</th>
                <th className="num">{teamShort(team)} allows</th>
                <th className="num">Rank</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.type}>
                  <td>{row.label}</td>
                  <td>
                    <span className="pp-share">
                      <span
                        className="pp-share-bar"
                        style={{ width: `${(row.share / maxShare) * 100}%` }}
                      />
                      <span className="pp-share-num">{row.share.toFixed(1)}%</span>
                    </span>
                  </td>
                  <td className={`num pp-tone-${tone(row.vs)}`}>{formatVsLeague(row.vs)}</td>
                  <td className="num">
                    <Rank rank={row.rank} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="pp-table">
            <thead>
              <tr>
                <th>Per game</th>
                <th className="num">{teamShort(team)} allows</th>
                <th className="num">vs avg</th>
                <th className="num">Rank</th>
              </tr>
            </thead>
            <tbody>
              {team3.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="num">{row.value}</td>
                  <td className={`num pp-tone-${tone(row.vs)}`}>{formatVsLeague(row.vs)}</td>
                  <td className="num">
                    <Rank rank={row.rank} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="pp-foot">
          Rank 30 = allows the most. Assists, shot types and zones stay one tap away.
        </p>
      </Card.Body>
    </Card>
  );
};

/* ---------- B: two cards, trimmed ---------- */

const MoverList = ({ title, rows, toneName }) => (
  <div className="pp-movers">
    <div className={`pp-movers-title pp-tone-${toneName}`}>{title}</div>
    {rows.length === 0 ? (
      <div className="pp-muted">Nothing beyond ±3%</div>
    ) : (
      rows.map((row) => (
        <div key={row.key} className="pp-mover">
          <span>{row.label}</span>
          <span className={`pp-tone-${toneName}`}>{formatVsLeague(row.vs)}</span>
          <Rank rank={row.rank} />
        </div>
      ))
    )}
  </div>
);

const VariantB = ({ player, team, teams, chooseTeam, data }) => {
  const [showAll, setShowAll] = useState(false);
  const rows = playRows(data.mix, data.defense);
  const maxShare = Math.max(1, ...rows.map((row) => row.share));
  const team3 = traditionalRows(data.traditional);
  const more = team3.filter((row) => row.vs >= 3).sort((a, b) => b.vs - a.vs);
  const less = team3.filter((row) => row.vs <= -3).sort((a, b) => a.vs - b.vs);
  const near = team3.length - more.length - less.length;
  return (
    <div className="pp-two">
      <Card className="dark-card">
        <Card.Body>
          <h4 className="mb-1">How {lastName(player)} scores</h4>
          <Verdict player={player} team={team} blend={blended(rows)} />
          <div className="pp-bars">
            {rows.map((row) => (
              <div key={row.type} className="pp-bar-row">
                <span className="pp-bar-label">{row.label}</span>
                <span className="pp-bar-track">
                  <span
                    className="pp-share-bar"
                    style={{ width: `${(row.share / maxShare) * 100}%` }}
                  />
                </span>
                <span className="pp-bar-num">{row.share.toFixed(0)}%</span>
                <span
                  className={`pp-dot pp-dot-${tone(row.vs)}`}
                  title={`${teamShort(team)} ${formatVsLeague(row.vs)} vs avg`}
                />
              </div>
            ))}
          </div>
          <p className="pp-foot">
            <span className="pp-dot pp-dot-more" /> {teamShort(team)} softer on it{' '}
            <span className="pp-dot pp-dot-less" /> tougher <span className="pp-dot pp-dot-flat" />{' '}
            about average
          </p>
        </Card.Body>
      </Card>
      <Card className="dark-card">
        <Card.Body>
          <div className="pp-head">
            <TeamPicker teams={teams} team={team} onChange={chooseTeam} />
            <h4 className="mb-0">allow</h4>
          </div>
          {showAll ? (
            <OpponentBars groups={opponentReadings('Traditional', data.traditional)} />
          ) : (
            <div className="pp-movers-grid">
              <MoverList title="More than average" rows={more} toneName="more" />
              <MoverList title="Less than average" rows={less} toneName="less" />
            </div>
          )}
          <button type="button" className="pp-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Only the big gaps' : `+ ${near} stats near average`}
          </button>
        </Card.Body>
      </Card>
    </div>
  );
};

/* ---------- C: mix strip + movers ---------- */

const VariantC = ({ player, team, teams, chooseTeam, data }) => {
  const [open, setOpen] = useState(false);
  const rows = playRows(data.mix, data.defense);
  const total = rows.reduce((sum, row) => sum + row.share, 0) || 1;
  const team3 = traditionalRows(data.traditional)
    .filter((row) => row.vs !== null)
    .sort((a, b) => Math.abs(b.vs) - Math.abs(a.vs))
    .slice(0, 6);
  return (
    <Card className="dark-card">
      <Card.Body>
        <div className="pp-head">
          <h4 className="mb-0">
            {player} <span className="pp-muted">vs</span>
          </h4>
          <TeamPicker teams={teams} team={team} onChange={chooseTeam} />
        </div>
        <Verdict player={player} team={team} blend={blended(rows)} />
        <div className="pp-section-title">
          His plays, coloured by how the {teamShort(team)} defend each
        </div>
        <div className="pp-strip">
          {rows.map((row) => (
            <div
              key={row.type}
              className={`pp-strip-seg pp-seg-${tone(row.vs)}`}
              style={{ flexGrow: row.share / total }}
              title={`${row.label}: ${row.share.toFixed(1)}% of his plays, ${teamShort(team)} ${formatVsLeague(row.vs)} (rank ${row.rank})`}
            >
              <span className="pp-strip-name">{row.label}</span>
              <span className="pp-strip-share">{row.share.toFixed(0)}%</span>
              <span className="pp-strip-vs">{formatVsLeague(row.vs)}</span>
            </div>
          ))}
        </div>
        <div className="pp-section-title">Biggest gaps from league, per game allowed</div>
        <div className="pp-tiles">
          {team3.map((row) => (
            <div key={row.key} className="pp-tile">
              <div className="pp-tile-label">{row.label}</div>
              <div className={`pp-tile-vs pp-tone-${tone(row.vs)}`}>{formatVsLeague(row.vs)}</div>
              <div className="pp-tile-sub">
                {row.value} · rank {row.rank}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="pp-link" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide full team sheet' : 'Full team sheet'}
        </button>
        {open && <OpponentBars groups={opponentReadings('Traditional', data.traditional)} />}
      </Card.Body>
    </Card>
  );
};

const ProfilesPrototype = ({ selectedPlayer, selectedTeam, teams, chooseTeam, current }) => {
  const variant = useVariant();
  const data = useProfileData(selectedPlayer, selectedTeam);
  const teamList = useMemo(
    () => (teams.includes(selectedTeam) ? teams : [selectedTeam, ...teams].filter(Boolean)),
    [teams, selectedTeam],
  );
  const props = { player: selectedPlayer, team: selectedTeam, teams: teamList, chooseTeam, data };
  let body;
  if (variant === '0') body = current;
  else if (data.loading) body = <p className="pp-muted">Loading…</p>;
  else if (variant === 'A') body = <VariantA {...props} />;
  else if (variant === 'B') body = <VariantB {...props} />;
  else body = <VariantC {...props} />;
  return (
    <div className="pp-root mb-5" data-variant={variant} aria-label={VARIANT_NAMES[variant]}>
      {body}
      <Switcher current={variant} />
    </div>
  );
};

export default ProfilesPrototype;
