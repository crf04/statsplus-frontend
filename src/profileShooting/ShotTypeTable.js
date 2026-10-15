import './profileShooting.css';
import { toFiniteNumber } from '../numberUtils';

const SHOT_TYPES = {
  'C&S': { name: 'Catch & shoot', dietKey: 'Catch and Shoot' },
  Pullup: { name: 'Pull-up', dietKey: 'Pullups' },
  '<10 Ft': { name: 'Inside 10 ft', dietKey: 'Less Than 10 ft' },
};

const wholePercent = (share) => (share === null ? '—' : `${Math.round(share * 100)}%`);
const onePlace = (value) => (value === null ? '—' : value.toFixed(1));
const clampShare = (share) => Math.max(0, Math.min(1, share));

const ShareCell = ({ share, league }) => (
  <td className="ps-num">
    <span className="ps-main">{wholePercent(share)}</span>
    <span className="ps-bar" aria-hidden="true">
      {share !== null && (
        <span className="ps-bar-fill" style={{ width: `${clampShare(share) * 100}%` }} />
      )}
      {league !== null && (
        <span className="ps-bar-tick" style={{ left: `${clampShare(league) * 100}%` }} />
      )}
    </span>
    <span className="ps-sub">lg {wholePercent(league)}</span>
  </td>
);

/* Percentage on top, made/attempted per game below; no attempts reads "—". */
const ShootingCell = ({ made, attempts, percent }) => {
  const tried = attempts !== null && attempts > 0;
  return (
    <td className="ps-num">
      <span className="ps-main">
        {tried && percent !== null ? `${(percent * 100).toFixed(1)}%` : '—'}
      </span>
      <span className="ps-sub">{tried ? `${onePlace(made)}/${onePlace(attempts)}` : ''}</span>
    </td>
  );
};

/*
 * The Shooting Type profile: one row per shot type, sized to its card. Share is
 * his `FGA_FREQUENCY`; the tick and `lg` line are the league-average Diet share
 * from /api/diet/baselines, which is the same quantity.
 */
const ShotTypeTable = ({ rows, leagueShares }) => (
  <div className="ps">
    <table className="ps-table">
      <colgroup>
        <col className="ps-col-name" />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th className="ps-left">Shot type</th>
          <th>Share</th>
          <th>FG</th>
          <th>2PT</th>
          <th>3PT</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const type = SHOT_TYPES[row.SHOT_TYPE];
          const number = (key) => toFiniteNumber(row[key]);
          return (
            <tr key={row.SHOT_TYPE}>
              <td className="ps-left ps-name">{type?.name ?? row.SHOT_TYPE}</td>
              <ShareCell
                share={number('FGA_FREQUENCY')}
                league={toFiniteNumber(leagueShares?.[type?.dietKey])}
              />
              <ShootingCell
                made={number('FGM')}
                attempts={number('FGA')}
                percent={number('FG_PCT')}
              />
              <ShootingCell
                made={number('FG2M')}
                attempts={number('FG2A')}
                percent={number('FG2_PCT')}
              />
              <ShootingCell
                made={number('FG3M')}
                attempts={number('FG3A')}
                percent={number('FG3_PCT')}
              />
            </tr>
          );
        })}
      </tbody>
    </table>
    <p className="ps-caption">
      Per game, season. Share = of all his field-goal attempts; lg = league-average share (tick on
      the bar).
    </p>
  </div>
);

export default ShotTypeTable;
