import '../readings.css';
import './OpponentBars.css';
import { barScale, formatVsLeague, splitColumns } from './opponentReadings';

// A gap from league this small reads as average, so it is not coloured.
const tone = (vs) => (vs === null ? 'flat' : vs >= 3 ? 'more' : vs <= -3 ? 'less' : 'flat');

const Rank = ({ rank }) =>
  rank === null ? (
    <span className="opp-bars-rank-none">–</span>
  ) : (
    <span
      className="rank-pill opp-bars-rank"
      style={{ '--rank': rank }}
      title={`Rank ${rank} of 30`}
    >
      {rank}
    </span>
  );

const Bar = ({ row, scale }) => {
  const width = row.vs === null ? 0 : (Math.min(Math.abs(row.vs), scale) / scale) * 50;
  return (
    <div className="opp-bars-row">
      <span className="opp-bars-label">
        {row.label}
        {row.value !== null && <span className="opp-bars-value">{row.value}</span>}
      </span>
      <span className="opp-bars-track" aria-hidden="true">
        <span className="opp-bars-axis" />
        {row.vs !== null && (
          <span
            className={`opp-bars-fill opp-bars-fill-${row.vs >= 0 ? 'more' : 'less'}`}
            style={
              row.vs >= 0
                ? { left: '50%', width: `${width}%` }
                : { right: '50%', width: `${width}%` }
            }
          />
        )}
      </span>
      <span className={`opp-bars-vs opp-bars-vs-${tone(row.vs)}`}>{formatVsLeague(row.vs)}</span>
      <Rank rank={row.rank} />
    </div>
  );
};

const Scale = ({ scale }) => (
  <div className="opp-bars-scale" aria-hidden="true">
    <span />
    <span className="opp-bars-scale-track">
      <span>−{scale}%</span>
      <span>avg</span>
      <span>+{scale}%</span>
    </span>
    <span />
    <span />
  </div>
);

const Group = ({ group, scale }) => (
  <div
    className={[
      'opp-bars-group',
      group.continues && 'opp-bars-group-continues',
      group.continued && 'opp-bars-group-continued',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {group.title && (
      <div className="opp-bars-group-title">
        <span>
          {group.title}
          {group.continued && <span className="opp-bars-cont"> cont.</span>}
        </span>
        {group.head && <span className="opp-bars-group-head">{group.head}</span>}
      </div>
    )}
    {group.rows.map((row) => (
      <Bar key={row.key} row={row} scale={scale} />
    ))}
  </div>
);

/*
 * The opponent's readings as bars diverging from league average. Long lists
 * split into two columns, which sit side by side only when the card is wide
 * enough; otherwise they stack into one seamless column.
 */
const OpponentBars = ({ groups }) => {
  const scale = barScale(groups);
  const columns = splitColumns(groups);
  return (
    <div className="opp-bars">
      <div className={`opp-bars-columns${columns.length > 1 ? ' opp-bars-columns-split' : ''}`}>
        {columns.map((column, index) => (
          <div key={index} className="opp-bars-column" data-testid="opponent-bars-column">
            <Scale scale={scale} />
            {column.map((group) => (
              <Group
                key={`${group.key}${group.continued ? '-cont' : ''}`}
                group={group}
                scale={scale}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="opp-bars-legend">
        <span>
          <i className="opp-bars-key opp-bars-fill-less" /> allows less
        </span>
        <span>
          <i className="opp-bars-key opp-bars-fill-more" /> allows more
        </span>
      </div>
    </div>
  );
};

export default OpponentBars;
