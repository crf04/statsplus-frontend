import { useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { apiClient, getApiUrl } from '../config';
import TargetForm, { blankQualifier, blankTargetDraft } from './TargetForm';
import {
  deriveTargetTitle,
  formatQualifier,
  NBA_TEAM_TRICODES,
  TARGET_SLICES,
  targetSliceLabel,
} from './targetCatalog';
import './TeamContextPrototype.css';

/* Three deliberately different answers to the same question, all on /targets. */
export const TEAM_CONTEXT_VARIANTS = {
  A: { label: 'Comparison table', shortLabel: 'Table-first' },
  B: { label: 'Team sidebar', shortLabel: 'Team-first' },
  C: { label: 'League lens', shortLabel: 'Rank-first' },
};

const TEAM_CODES = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};

const CATEGORY_CONFIG = {
  Playtypes: {
    label: 'Play types',
    description: 'Opponent points by play type',
    unit: 'points allowed /48',
    note: 'Per 48; rank 1 = least allowed.',
    rows: [
      ['Transition', 'Transition', 'play_types', 'Transition'],
      ['Isolation', 'Isolation', 'play_types', 'Isolation'],
      ['PRBallHandler', 'P&R ball handler', 'play_types', 'PRBallHandler'],
      ['PRRollMan', 'P&R roll man', 'play_types', 'PRRollMan'],
      ['Spotup', 'Spot up', 'play_types', 'Spotup'],
      ['Cut', 'Cut', 'play_types', 'Cut'],
      ['Handoff', 'Handoff', 'play_types', 'Handoff'],
      ['OffScreen', 'Off screen', 'play_types', 'OffScreen'],
      ['Postup', 'Post up', 'play_types', 'Postup'],
      ['OffRebound', 'Putback', 'play_types', 'OffRebound'],
      ['Misc', 'Miscellaneous'],
    ],
  },
  'Zone Shooting': {
    label: 'Shot zones',
    description: 'Opponent volume by floor location',
    unit: 'opponent production / 48',
    note: 'Per 48; rank 1 = least allowed.',
    rows: [
      ['Restricted Area_OPP_FGA', 'Restricted area', 'shot_zones', 'Restricted Area', 'FGA/48'],
      [
        'In The Paint (Non-RA)_OPP_FGA',
        'Paint (non-RA)',
        'shot_zones',
        'In The Paint (Non-RA)',
        'FGA/48',
      ],
      ['Mid-Range_OPP_FGA', 'Mid-range', 'shot_zones', 'Mid-Range', 'FGA/48'],
      ['Corner 3_OPP_FGA', 'Corner 3', 'shot_zones', 'Corner 3', 'FGA/48'],
      ['Above the Break 3_OPP_FGA', 'Above-break 3', 'shot_zones', 'Above the Break 3', 'FGA/48'],
      ['Restricted Area_OPP_FGM', 'Restricted area makes', null, null, 'FGM/48'],
      ['In The Paint (Non-RA)_OPP_FGM', 'Paint (non-RA) makes', null, null, 'FGM/48'],
      ['Mid-Range_OPP_FGM', 'Mid-range makes', null, null, 'FGM/48'],
      ['Corner 3_OPP_FGM', 'Corner 3 makes', null, null, 'FGM/48'],
      ['Above the Break 3_OPP_FGM', 'Above-break 3 makes', null, null, 'FGM/48'],
    ],
  },
  Assists: {
    label: 'Assist locations',
    description: 'Assist volume vs league mean',
    unit: 'league index',
    note: '1.00× = league mean.',
    rows: [
      ['Assists', 'All assists'],
      ['AssistPoints', 'Assisted points'],
      ['TwoPtAssists', 'Two-point assists'],
      ['ThreePtAssists', 'Three-point assists'],
      ['Arc3Assists', 'Arc 3 assists', 'assist_locations', 'Arc3Assists'],
      ['Corner3Assists', 'Corner 3 assists', 'assist_locations', 'Corner3Assists'],
      ['AtRimAssists', 'At-rim assists', 'assist_locations', 'AtRimAssists'],
      ['ShortMidRangeAssists', 'Short mid assists', 'assist_locations', 'ShortMidRangeAssists'],
      ['LongMidRangeAssists', 'Long mid assists', 'assist_locations', 'LongMidRangeAssists'],
    ],
  },
  'Shooting Type': {
    label: 'Shot types',
    description: 'Opponent volume by shot type',
    unit: 'opponent production / 48',
    note: 'PTS and attempts are per 48.',
    rows: [],
  },
  Traditional: {
    label: 'Traditional',
    description: 'Opponent box score production',
    unit: 'opponent production / 48',
    note: 'Per 48; rank 1 = least allowed.',
    rows: [
      ['OPP_PTS', 'Points'],
      ['OPP_FG_PCT', 'Field-goal percentage'],
      ['OPP_FG3_PCT', '3-point percentage'],
      ['OPP_FGA', 'Field-goal attempts'],
      ['OPP_FG3A', '3-point attempts'],
      ['OPP_FTA', 'Free-throw attempts'],
      ['OPP_REB', 'Rebounds'],
      ['OPP_OREB', 'Offensive rebounds'],
      ['OPP_DREB', 'Defensive rebounds'],
      ['OPP_AST', 'Assists'],
      ['OPP_TOV', 'Turnovers'],
      ['OPP_STL', 'Steals'],
      ['OPP_BLK', 'Blocks'],
      ['OPP_STL+BLK', 'Steals + blocks'],
    ],
  },
};

const SHOOTING_TYPE_ROWS = [
  ['Catch and Shoot', 'Catch & shoot'],
  ['Pullups', 'Pull-up'],
  ['Less Than 10 ft', 'Inside 10 ft'],
];

const allCategories = Object.keys(CATEGORY_CONFIG);

const parseTeams = (payload) => {
  const values = Array.isArray(payload) ? payload : payload?.teams;
  if (!Array.isArray(values)) throw new Error('The teams endpoint returned an invalid list.');
  return values.filter((team) => typeof team === 'string' && team.trim());
};

const parseStats = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') return [payload];
  throw new Error('The team stats endpoint returned an invalid response.');
};

export const codeForTeam = (name) => TEAM_CODES[name] || (name === 'LA Clippers' ? 'LAC' : null);

export const teamNameForCode = (code) =>
  Object.entries(TEAM_CODES).find(([, tricode]) => tricode === code)?.[0] || null;

const formatNumber = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
};

const formatPercent = (value) =>
  Number.isFinite(value) ? `${(value * 100).toFixed(1).replace(/\.0$/, '')}%` : '—';

const formatSignedPercent = (value) => {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace(/\.0$/, '')}%`;
};

export const statRowsFor = (category, payload) => {
  const data = payload?.[0];
  if (!data) return [];
  if (category === 'Shooting Type') {
    return payload.flatMap((item) =>
      ['PTS', 'FG2A', 'FG3A'].flatMap((key) =>
        Number.isFinite(item?.[key])
          ? [
              {
                key: `${item.ShootingType || 'Unknown'}:${key}`,
                rawKey: key,
                label: item.ShootingType || 'Unknown',
                sublabel:
                  key === 'PTS'
                    ? 'Points'
                    : key === 'FG2A'
                      ? '2-point attempts'
                      : '3-point attempts',
                value: item[key],
                rank: item[`${key}_RANK`],
                vsAverage: item[`${key}_vs_avg_pct`],
                targetBase: 'shot_types',
                targetSlice: item.ShootingType,
              },
            ]
          : [],
      ),
    );
  }
  return CATEGORY_CONFIG[category].rows.flatMap(([key, label, targetBase, targetSlice, unit]) =>
    Number.isFinite(data[key])
      ? [
          {
            key,
            rawKey: key,
            label,
            value: data[key],
            rank: data[`${key}_RANK`],
            vsAverage: data[`${key}_vs_avg_pct`],
            targetBase,
            targetSlice,
            unit,
          },
        ]
      : [],
  );
};

export const formatValue = (category, row) => {
  if (category === 'Assists') return `${formatNumber(row.value, 2)}×`;
  if (row.rawKey.endsWith('_PCT')) return formatPercent(row.value);
  return formatNumber(row.value, 1);
};

export const unitForRow = (category, row) => {
  if (category === 'Assists') return 'index';
  if (row.rawKey.endsWith('_PCT')) return '%';
  return row.unit || '/48';
};

export const formatLeagueComparison = (category, row) =>
  category === 'Assists'
    ? formatSignedPercent((row.value - 1) * 100)
    : formatSignedPercent(row.vsAverage);

export const qualifierFor = (category, row) => {
  if (!row?.targetBase || !row.targetSlice) return null;
  return {
    ...blankQualifier(),
    base: row.targetBase,
    sliceKey: row.targetSlice,
  };
};

export function useTeamContextRead() {
  const [teams, setTeams] = useState([]);
  const [teamsState, setTeamsState] = useState('loading');
  const [teamsError, setTeamsError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [category, setCategory] = useState('Playtypes');
  const [stats, setStats] = useState([]);
  const [statsState, setStatsState] = useState('idle');
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setTeamsState('loading');
    apiClient
      .get(getApiUrl('TEAMS'), { signal: controller.signal })
      .then((response) => {
        const nextTeams = parseTeams(response.data);
        setTeams(nextTeams);
        setSelectedTeam((current) =>
          current && nextTeams.includes(current)
            ? current
            : nextTeams.includes('Boston Celtics')
              ? 'Boston Celtics'
              : nextTeams[0] || '',
        );
        setTeamsState('ready');
      })
      .catch((error) => {
        if (isRequestCancelled(error)) return;
        setTeamsState('error');
        setTeamsError(getRequestErrorMessage(error, 'Unable to load teams.'));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedTeam) {
      setStats([]);
      setStatsState('idle');
      return undefined;
    }
    const controller = new AbortController();
    setStats([]);
    setStatsState('loading');
    setStatsError(null);
    const params = {
      category: category === 'Playtypes' ? 'Playtype Points' : category,
      team: selectedTeam,
    };
    apiClient
      .get(getApiUrl('TEAM_STATS'), { params, signal: controller.signal })
      .then((response) => {
        setStats(parseStats(response.data));
        setStatsState('ready');
      })
      .catch((error) => {
        if (isRequestCancelled(error)) return;
        setStatsState('error');
        setStatsError(getRequestErrorMessage(error, 'Unable to load this team profile.'));
      });
    return () => controller.abort();
  }, [category, selectedTeam]);

  const config = CATEGORY_CONFIG[category];
  const sourcePeriod = 'Stored whole-season snapshot';
  return {
    category,
    config,
    setCategory,
    selectedTeam,
    setSelectedTeam,
    sourcePeriod,
    stats,
    statsError,
    statsState,
    teams,
    teamsError,
    teamsState,
  };
}

function TeamSelector({ teams, selectedTeam, onChange, disabled = false }) {
  return (
    <label className="team-context-team-select">
      <span>Opponent team</span>
      <select
        aria-label="Opponent team"
        value={selectedTeam}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !teams.length}
      >
        {!teams.length && <option value="">No teams available</option>}
        {teams.map((team) => (
          <option key={team} value={team}>
            {codeForTeam(team) || '—'} · {team}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategoryTabs({ category, onChange }) {
  return (
    <div className="team-context-category-tabs" role="group" aria-label="Team stat category">
      {allCategories.map((key) => (
        <button
          key={key}
          type="button"
          className={category === key ? 'is-active' : undefined}
          aria-pressed={category === key}
          onClick={() => onChange(key)}
        >
          {CATEGORY_CONFIG[key].label}
        </button>
      ))}
    </div>
  );
}

export function ReadControls({
  read,
  compact = false,
  lockTeam = false,
  hideTeam = false,
  onTeamChange,
}) {
  const { category, setCategory, selectedTeam, setSelectedTeam, teams } = read;
  return (
    <div
      className={`team-context-controls${compact ? ' is-compact' : ''}${hideTeam ? ' is-no-team' : ''}`}
    >
      {!hideTeam && (
        <TeamSelector
          teams={teams}
          selectedTeam={selectedTeam}
          onChange={onTeamChange || setSelectedTeam}
          disabled={lockTeam}
        />
      )}
      <CategoryTabs category={category} onChange={setCategory} />
    </div>
  );
}

function ReadStatus({ read }) {
  if (read.teamsState === 'loading')
    return <p className="team-context-read-status">Loading team catalogue…</p>;
  if (read.teamsState === 'error')
    return <p className="team-context-read-status is-error">{read.teamsError}</p>;
  if (read.statsState === 'loading')
    return (
      <p className="team-context-read-status">
        Reading {read.config.label.toLowerCase()} for{' '}
        {codeForTeam(read.selectedTeam) || read.selectedTeam}…
      </p>
    );
  if (read.statsState === 'error')
    return <p className="team-context-read-status is-error">{read.statsError}</p>;
  if (read.statsState === 'ready' && !statRowsFor(read.category, read.stats).length)
    return <p className="team-context-read-status">No stats returned for this read.</p>;
  return null;
}

function RankBadge({ rank }) {
  return Number.isFinite(rank) ? (
    <span className="team-context-rank">#{Math.round(rank)}</span>
  ) : (
    <span className="team-context-rank is-missing">—</span>
  );
}

function UseTargetButton({ row, onUse, label = 'Use in Target' }) {
  const available = Boolean(row?.targetBase && row?.targetSlice);
  if (!available) return null;
  return (
    <button type="button" className="team-context-use" onClick={() => onUse(row)}>
      {label}
    </button>
  );
}

export function TeamIdentity({ read, eyebrow = 'Opponent context' }) {
  const code = codeForTeam(read.selectedTeam) || '—';
  return (
    <div className="team-context-identity">
      <div>
        <span className="team-context-eyebrow">{eyebrow}</span>
        <h2>{read.selectedTeam || 'Choose an opponent'}</h2>
      </div>
      <strong>{code}</strong>
    </div>
  );
}

function TableStats({ read, onUse }) {
  const rows = statRowsFor(read.category, read.stats);
  const config = read.config;
  return (
    <div className="team-context-table-wrap">
      <table className="team-context-table">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">
              Opponent value <small>{config.unit}</small>
            </th>
            <th scope="col">League rank</th>
            <th scope="col">Vs league</th>
            <th scope="col">
              <span className="visually-hidden">Target action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                <span>{row.label}</span>
                {row.sublabel && <small>{row.sublabel}</small>}
              </th>
              <td className="team-context-value">
                <b>{formatValue(read.category, row)}</b>{' '}
                <small>{unitForRow(read.category, row)}</small>
              </td>
              <td>
                <RankBadge rank={row.rank} />
              </td>
              <td className="team-context-vs">{formatLeagueComparison(read.category, row)}</td>
              <td>
                <UseTargetButton row={row} onUse={onUse} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatBars({ read, onUse }) {
  const rows = statRowsFor(read.category, read.stats);
  return (
    <>
      <p className="team-context-bars-legend">League rank · 1 lowest · 30 highest</p>
      <ul className="team-context-bars">
        {rows.map((row) => {
          const rank = Number.isFinite(row.rank) ? Math.round(row.rank) : null;
          const rankWidth = rank >= 1 && rank <= 30 ? ((rank - 1) / 29) * 100 : null;
          return (
            <li key={row.key}>
              <div className="team-context-bar-head">
                <span>
                  {row.label}
                  {row.sublabel ? ` · ${row.sublabel}` : ''}
                </span>
                <b>{formatValue(read.category, row)}</b>
              </div>
              {rankWidth !== null && (
                <div className="team-context-bar-track" aria-hidden="true">
                  <i style={{ width: `${rankWidth}%` }} />
                </div>
              )}
              <div className="team-context-bar-foot">
                <RankBadge rank={row.rank} />
                <span>{formatLeagueComparison(read.category, row)} vs league</span>
                <UseTargetButton row={row} onUse={onUse} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function LeagueLens({ read, onUse }) {
  const rows = statRowsFor(read.category, read.stats).filter((row) => Number.isFinite(row.rank));
  const sorted = [...rows].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  return (
    <div className="team-context-rankboard">
      {sorted.map((row) => (
        <article key={row.key} className="team-context-rank-card">
          <div className="team-context-rank-number">
            {String(Math.round(row.rank)).padStart(2, '0')}
          </div>
          <div className="team-context-rank-copy">
            <span>{row.label}</span>
            {row.sublabel && <small>{row.sublabel}</small>}
          </div>
          <div className="team-context-rank-value">
            <b>{formatValue(read.category, row)}</b>
            <small>{unitForRow(read.category, row)}</small>
          </div>
          <div className="team-context-rank-delta">
            {formatLeagueComparison(read.category, row)}
          </div>
          <UseTargetButton row={row} onUse={onUse} />
        </article>
      ))}
    </div>
  );
}

function ShootingTypeTable({ read, onUse }) {
  const rows = read.stats;
  return (
    <div className="team-context-table-wrap">
      <table className="team-context-table team-context-shooting-table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">
              Points <small>/48</small>
            </th>
            <th scope="col">
              2PA <small>/48</small>
            </th>
            <th scope="col">
              3PA <small>/48</small>
            </th>
            <th scope="col">Target</th>
          </tr>
        </thead>
        <tbody>
          {SHOOTING_TYPE_ROWS.map(([key, label]) => {
            const item = rows.find((entry) => entry.ShootingType === key);
            if (!item) return null;
            const pointRow = statRowsFor('Shooting Type', [item]).find(
              (row) => row.rawKey === 'PTS',
            );
            const targetRow = pointRow || null;
            return (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td className="team-context-value">
                  <b>{formatNumber(item.PTS)}</b> <small>PTS/48</small>
                  <RankBadge rank={item.PTS_RANK} />
                </td>
                <td className="team-context-value">
                  <b>{formatNumber(item.FG2A)}</b> <small>FGA/48</small>
                  <RankBadge rank={item.FG2A_RANK} />
                </td>
                <td className="team-context-value">
                  <b>{formatNumber(item.FG3A)}</b> <small>FGA/48</small>
                  <RankBadge rank={item.FG3A_RANK} />
                </td>
                <td>
                  <UseTargetButton row={targetRow} onUse={onUse} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CompactStatsTable({ read, onUse }) {
  const rows = statRowsFor(read.category, read.stats);
  const config = read.config;
  return (
    <div className="team-context-table-wrap team-context-compact-wrap">
      <table className="team-context-table team-context-compact-table">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">
              Opponent value <small>{config.unit}</small>
            </th>
            <th scope="col">Rank</th>
            <th scope="col">
              <span className="visually-hidden">Target action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                <span>{row.label}</span>
                {row.sublabel && <small>{row.sublabel}</small>}
              </th>
              <td className="team-context-value">
                <b>{formatValue(read.category, row)}</b>{' '}
                <small>{unitForRow(read.category, row)}</small>
                <small className="team-context-compact-vs">
                  {formatLeagueComparison(read.category, row)} vs league
                </small>
              </td>
              <td>
                <RankBadge rank={row.rank} />
              </td>
              <td>
                <UseTargetButton row={row} onUse={onUse} label="Add" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsSurface({ read, mode, onUse }) {
  if (read.statsState !== 'ready' || read.teamsState !== 'ready') return <ReadStatus read={read} />;
  if (!statRowsFor(read.category, read.stats).length) return <ReadStatus read={read} />;
  if (mode === 'compact') return <CompactStatsTable read={read} onUse={onUse} />;
  if (mode === 'bars') return <StatBars read={read} onUse={onUse} />;
  if (mode === 'rankboard') return <LeagueLens read={read} onUse={onUse} />;
  if (read.category === 'Shooting Type') return <ShootingTypeTable read={read} onUse={onUse} />;
  return <TableStats read={read} onUse={onUse} />;
}

export function SourceNote({ read, compact = false }) {
  if (compact) {
    return (
      <p className="team-context-source">
        <span>{read.config.note}</span>
        <span>{read.sourcePeriod}</span>
      </p>
    );
  }
  return (
    <p className="team-context-source">
      <span>{read.config.description}</span>
      <span>{read.sourcePeriod}</span>
      <span>{read.config.note}</span>
      <span>Read-only prototype</span>
    </p>
  );
}

function TargetList({ targets, prototypeTargets, onNewTarget, activity }) {
  const allTargets = [...prototypeTargets, ...targets];
  return (
    <section className="team-context-targets" aria-label="Saved Targets">
      <div className="team-context-section-head">
        <div>
          <span className="team-context-eyebrow">Your board</span>
          <h2>Saved Targets</h2>
        </div>
        <button type="button" className="team-context-button is-primary" onClick={onNewTarget}>
          + New Target
        </button>
      </div>
      <p className="team-context-target-activity">{activity}</p>
      {allTargets.length ? (
        <ul className="team-context-target-list">
          {allTargets.map((target) => {
            const prototype = String(target.id).startsWith('prototype-');
            return (
              <li key={target.id} className={prototype ? 'is-prototype' : undefined}>
                <div className="team-context-target-copy">
                  <b>{target.opponent}</b>
                  <span>{target.qualifiers.map(formatQualifier).join(' · ')}</span>
                  {target.note && <small>{target.note}</small>}
                </div>
                {prototype ? (
                  <span className="team-context-held">held in session</span>
                ) : (
                  <Link to={`/targets/${target.id}`}>
                    Open <span aria-hidden="true">↗</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="team-context-empty-targets">
          <span>—</span>
          <p>No Targets yet. Start with a team read.</p>
        </div>
      )}
    </section>
  );
}

function VariantA({ read, targets, prototypeTargets, onNewTarget, onUse, activity }) {
  return (
    <div className="team-context-layout team-context-layout-a">
      <section className="team-context-main-panel">
        <TeamIdentity read={read} />
        <ReadControls read={read} />
        <SourceNote read={read} />
        <StatsSurface read={read} onUse={onUse} />
      </section>
      <TargetList
        targets={targets}
        prototypeTargets={prototypeTargets}
        onNewTarget={onNewTarget}
        activity={activity}
      />
    </div>
  );
}

function VariantB({ read, targets, prototypeTargets, onNewTarget, onUse, activity }) {
  return (
    <div className="team-context-layout team-context-layout-b">
      <TargetList
        targets={targets}
        prototypeTargets={prototypeTargets}
        onNewTarget={onNewTarget}
        activity={activity}
      />
      <aside className="team-context-inspector" aria-label="Team context inspector">
        <div className="team-context-inspector-head">
          <span className="team-context-eyebrow">Defense inspector</span>
          <span className="team-context-inspector-dot" aria-hidden="true" />
        </div>
        <TeamIdentity read={read} eyebrow="Selected opponent" />
        <ReadControls read={read} compact />
        <SourceNote read={read} />
        <StatsSurface read={read} mode="bars" onUse={onUse} />
        <button type="button" className="team-context-inspector-action" onClick={onNewTarget}>
          Start a Target against {codeForTeam(read.selectedTeam) || 'this team'}{' '}
          <span aria-hidden="true">→</span>
        </button>
      </aside>
    </div>
  );
}

function VariantC({ read, targets, prototypeTargets, onNewTarget, onUse, activity }) {
  return (
    <div className="team-context-layout team-context-layout-c">
      <section className="team-context-rank-panel">
        <div className="team-context-rank-head">
          <div>
            <span className="team-context-eyebrow">League lens</span>
            <h2>{codeForTeam(read.selectedTeam) || 'Team'} ranked by opponent context</h2>
          </div>
          <button type="button" className="team-context-button is-primary" onClick={onNewTarget}>
            + New Target
          </button>
        </div>
        <ReadControls read={read} />
        <SourceNote read={read} />
        <p className="team-context-rank-explainer">
          Rankings make the team’s defensive shape legible at a glance. Rank 1 is the least opponent
          volume or production in the selected measure. Lowest value first; rank is not a defense
          grade.
        </p>
        <StatsSurface read={read} mode="rankboard" onUse={onUse} />
      </section>
      <TargetList
        targets={targets}
        prototypeTargets={prototypeTargets}
        onNewTarget={onNewTarget}
        activity={activity}
      />
    </div>
  );
}

function PrototypeComposer({ open, draft, busy, onChange, onSubmit, onCancel }) {
  return (
    <Modal
      show={open}
      onHide={onCancel}
      centered
      scrollable
      backdrop="static"
      className="target-new-layer team-context-composer-layer"
      dialogClassName="target-new-dialog"
      contentClassName="target-new-modal team-context-composer"
      backdropClassName="target-new-backdrop"
      aria-labelledby="team-context-composer-heading"
    >
      <Modal.Header closeButton closeVariant="white">
        <Modal.Title as="h2" className="h5 mb-0" id="team-context-composer-heading">
          New Target
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="team-context-composer-note">
          This composer is the existing Target form. Save keeps a copy in this prototype session
          only.
        </p>
        <TargetForm
          draft={draft}
          busy={busy}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </Modal.Body>
    </Modal>
  );
}

function PrototypeSwitcher({ current, disabled = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const keys = Object.keys(TEAM_CONTEXT_VARIANTS);
  const index = Math.max(0, keys.indexOf(current));
  const update = useCallback(
    (nextIndex) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('variant', keys[(nextIndex + keys.length) % keys.length]);
      setSearchParams(nextParams, { replace: true });
    },
    [keys, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || disabled) return undefined;
    const onKeyDown = (event) => {
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable)
      )
        return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        update(index - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        update(index + 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [disabled, index, update]);

  if (process.env.NODE_ENV === 'production' || disabled) return null;
  return (
    <nav className="team-context-switcher" aria-label="Prototype variants">
      <button
        type="button"
        aria-label="Previous prototype variant"
        onClick={() => update(index - 1)}
      >
        ←
      </button>
      <span>
        <b>{current}</b> · {TEAM_CONTEXT_VARIANTS[current]?.label}
      </span>
      <button type="button" aria-label="Next prototype variant" onClick={() => update(index + 1)}>
        →
      </button>
    </nav>
  );
}

export default function TeamContextPrototype({
  variant,
  targets,
  targetStatus,
  targetError,
  resolved,
}) {
  const read = useTeamContextRead();
  const [prototypeTargets, setPrototypeTargets] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [draft, setDraft] = useState(blankTargetDraft);
  const activity =
    resolved?.status === 'ready'
      ? `${resolved.entries.filter((entry) => entry.game).length} active today · ${targets.length} saved`
      : targetStatus === 'loading'
        ? 'Checking today’s activity…'
        : targetError || `${targets.length} saved`;

  const openComposer = useCallback(
    (row = null) => {
      const selectedCode = codeForTeam(read.selectedTeam) || NBA_TEAM_TRICODES[0];
      const qualifier = qualifierFor(read.category, row) || {
        ...blankQualifier(),
        base:
          read.category === 'Playtypes'
            ? 'play_types'
            : read.category === 'Assists'
              ? 'assist_locations'
              : read.category === 'Shooting Type'
                ? 'shot_types'
                : 'shot_zones',
        sliceKey:
          read.category === 'Playtypes'
            ? TARGET_SLICES.play_types[0][0]
            : read.category === 'Assists'
              ? TARGET_SLICES.assist_locations[0][0]
              : read.category === 'Shooting Type'
                ? TARGET_SLICES.shot_types[0][0]
                : TARGET_SLICES.shot_zones[0][0],
      };
      setDraft({ ...blankTargetDraft(), opponent: selectedCode, qualifiers: [qualifier] });
      setComposerOpen(true);
    },
    [read.category, read.selectedTeam],
  );

  const savePrototypeTarget = useCallback((request) => {
    setComposerBusy(true);
    const prototypeTarget = {
      ...request,
      id: `prototype-${Date.now()}`,
      title: deriveTargetTitle(request),
      createdAt: new Date().toISOString(),
      note: request.note || '',
      qualifiers: request.qualifiers,
    };
    setPrototypeTargets((current) => [prototypeTarget, ...current]);
    setComposerBusy(false);
    setComposerOpen(false);
  }, []);

  const variantProps = {
    read,
    targets,
    prototypeTargets,
    onNewTarget: () => openComposer(),
    onUse: openComposer,
    activity,
  };
  return (
    <>
      <main
        className={`slate-page targets-page team-context-page team-context-page-${variant.toLowerCase()}`}
      >
        <section className="team-context-heading">
          <div>
            <p className="eyebrow">Targets</p>
            <h1>Targets</h1>
            <p>
              <b className="team-context-heading-note">Team context prototype</b> · Opponent context
              for building Targets.
            </p>
          </div>
          <div className="team-context-heading-meta">
            <span>Read-only exploration</span>
            <b>{read.teams.length ? `${read.teams.length} teams` : 'Team catalogue'}</b>
          </div>
        </section>
        <p className="team-context-state-line" role="status" aria-live="polite">
          <span>Session state</span>
          <b>{codeForTeam(read.selectedTeam) || '—'}</b>
          <span>{read.config.label}</span>
          <span>
            {prototypeTargets.length} prototype draft{prototypeTargets.length === 1 ? '' : 's'}
          </span>
        </p>
        {variant === 'A' && <VariantA {...variantProps} />}
        {variant === 'B' && <VariantB {...variantProps} />}
        {variant === 'C' && <VariantC {...variantProps} />}
      </main>
      <PrototypeComposer
        open={composerOpen}
        draft={draft}
        busy={composerBusy}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSubmit={savePrototypeTarget}
        onCancel={() => setComposerOpen(false)}
      />
      <PrototypeSwitcher current={variant} disabled={composerOpen} />
    </>
  );
}

// Share whole-season profile reads across cards in this throwaway prototype.
const opponentProfiles = new Map();
const readOpponentProfile = (team, category) => {
  const key = `${category}:${team}`;
  if (!opponentProfiles.has(key)) {
    opponentProfiles.set(
      key,
      apiClient
        .get(getApiUrl('TEAM_STATS'), {
          params: { team, category },
        })
        .then(({ data }) => parseStats(data))
        .catch((error) => {
          opponentProfiles.delete(key);
          throw error;
        }),
    );
  }
  return opponentProfiles.get(key);
};

export const qualifierVolumeRow = (qualifier, profile, leagueProfiles) => {
  const { base, sliceKey } = qualifier;
  if (base === 'shot_types') {
    // Rank summed attempts across teams; component ranks cannot be added or averaged.
    const attempts = (rows) => {
      const row = rows?.find((item) => item.ShootingType === sliceKey);
      return Number.isFinite(row?.FG2A) && Number.isFinite(row?.FG3A) ? row.FG2A + row.FG3A : null;
    };
    const value = attempts(profile);
    const values = leagueProfiles?.map(attempts);
    if (value === null || values?.length !== 30 || values.some((item) => item === null))
      return null;
    const average = values.reduce((sum, item) => sum + item, 0) / values.length;
    return {
      value,
      rank: 1 + values.filter((item) => item < value).length,
      vsAverage: average > 0 ? (value / average - 1) * 100 : null,
    };
  }
  const data = profile?.[0];
  const key = base === 'shot_zones' ? `${sliceKey}_OPP_FGA` : sliceKey;
  if (!Number.isFinite(data?.[key])) return null;
  return {
    value: data[key],
    rank: data[`${key}_RANK`],
    vsAverage: base === 'assist_locations' ? (data[key] - 1) * 100 : data[`${key}_vs_avg_pct`],
  };
};

// Inline evidence follows the player slice, independently of the browsing panel.
export function QualifierOpponentContext({ team, teams, opponent, qualifier, teamsLoading }) {
  const category = {
    play_types: 'Playtype Points',
    shot_zones: 'Zone Shooting',
    assist_locations: 'Assists',
    shot_types: 'Shooting Type',
  }[qualifier.base];
  const [profiles, setProfiles] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!team || !category) return undefined;
    let cancelled = false;
    setProfiles(null);
    setFailed(false);
    const names = category === 'Shooting Type' ? teams : [team];
    Promise.all(names.map((name) => readOpponentProfile(name, category)))
      .then((data) => {
        if (!cancelled) setProfiles({ profile: data[names.indexOf(team)], league: data });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [team, teams, category]);
  const row = qualifierVolumeRow(qualifier, profiles?.profile, profiles?.league);
  const metric =
    qualifier.base === 'play_types'
      ? 'Points allowed /48'
      : qualifier.base === 'assist_locations'
        ? 'Assists allowed'
        : 'FGA allowed /48';
  return (
    <div className="target-qualifier-opponent" aria-label={`${opponent} opponent context`}>
      <span className="target-qualifier-opponent-label">
        {opponent} · {targetSliceLabel(qualifier.base, qualifier.sliceKey)}
        <small className="target-qualifier-opponent-metric">{metric}</small>
      </span>
      {row ? (
        <>
          <span title="League rank: 1 is lowest, 30 is highest">
            <b>{Number.isFinite(row.rank) ? `#${Math.round(row.rank)}` : '—'}</b> rank · 1 lowest
          </span>
          <span>
            <b>{formatSignedPercent(row.vsAverage)}</b> vs avg
          </span>
        </>
      ) : (
        <span>
          {failed || profiles || (!team && !teamsLoading)
            ? 'Context unavailable'
            : 'Loading context…'}
        </span>
      )}
    </div>
  );
}
