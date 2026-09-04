/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Three placements for the Defense Sheet controls on the matchup page. Each
 * variant is a set of optional slots (`Title`, `SidebarTop`, `Controls`) that
 * `Detail` renders in place of the shipped markup; every slot receives the
 * same bag of live state and setters, so the controls really drive the page.
 */
import { Fragment } from 'react';
import PrototypeSwitcher from './PrototypeSwitcher';
import './prototype.css';

const WINDOWS = [
  { key: 'season', label: 'Season' },
  { key: 'last15', label: 'Last 15' },
];
const DEVIATIONS = [
  { value: 0, label: 'All deviations', short: 'All' },
  { value: 1, label: 'At least 1 sigma', short: '1σ' },
  { value: 2, label: 'At least 2 sigma', short: '2σ' },
];

// Away first, then home, so every variant reads the same way as the title.
const orderedTeams = ({ matchup, teams }) =>
  [matchup.game.away, matchup.game.home]
    .map((side) => teams.find((team) => team.teamId === side.teamId))
    .filter(Boolean);
const opponentOf = (teams, team) => teams.find((other) => other.teamId !== team.teamId);

function Notes({ windowContext, last15Reason }) {
  return (
    <>
      {windowContext && <p className="window-context">{windowContext}</p>}
      {last15Reason && <p className="honest-empty">{last15Reason}</p>}
    </>
  );
}

function MarketPills({ markets, market, setMarket, historical, className = '' }) {
  return (
    <div
      className={`segmented market-tabs ${className}`.trim()}
      role="group"
      aria-label={historical ? 'Stat category' : 'Market'}
    >
      {markets.map((item) => (
        <button
          type="button"
          aria-pressed={market === item}
          key={item}
          onClick={() => setMarket(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function WindowButtons({ windowKey, setWindowKey, last15Blocked, className = 'segmented' }) {
  return (
    <div className={className} role="group" aria-label="Stat window">
      {WINDOWS.map((item) => (
        <button
          type="button"
          aria-pressed={windowKey === item.key}
          disabled={item.key === 'last15' && last15Blocked}
          key={item.key}
          onClick={() => setWindowKey(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DeviationButtons({ deviation, setDeviation, short = false, className = 'segmented' }) {
  return (
    <div className={className} role="group" aria-label="Deviation filter">
      {DEVIATIONS.map((item) => (
        <button
          type="button"
          aria-pressed={deviation === item.value}
          aria-label={short ? item.label : undefined}
          key={item.value}
          onClick={() => setDeviation(item.value)}
        >
          {short ? item.short : item.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* A — Side tabs: the team switch heads the sidebar; filters get names.      */
/* ------------------------------------------------------------------------ */

function SideTabs(props) {
  const { teams, defenseTeam, setTeamId } = props;
  return (
    <nav className="proto-a-tabs" aria-label="Defense team">
      {orderedTeams(props).map((team) => (
        <button
          type="button"
          key={team.teamId}
          aria-pressed={team.teamId === defenseTeam.teamId}
          onClick={() => setTeamId(team.teamId)}
        >
          <span className="proto-a-tab-team">
            {team.tricode} <small>defense</small>
          </span>
          <span className="proto-a-tab-sub">vs {opponentOf(teams, team)?.tricode} players</span>
        </button>
      ))}
    </nav>
  );
}

function LabelledControls(props) {
  return (
    <section className="detail-controls proto-a-controls" aria-label="Defense Sheet controls">
      <div className="proto-a-group">
        <span className="proto-label">{props.historical ? 'Stat' : 'Market'}</span>
        <MarketPills {...props} />
      </div>
      <div className="proto-a-row">
        <div className="proto-a-group">
          <span className="proto-label">Window</span>
          <WindowButtons {...props} />
        </div>
        <div className="proto-a-group">
          <span className="proto-label">Show</span>
          <DeviationButtons {...props} />
        </div>
      </div>
      <Notes {...props} />
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* B — Header switch: the title is the team switch; one-line toolbar.        */
/* ------------------------------------------------------------------------ */

function HeaderSwitchTitle(props) {
  const { defenseTeam, opposingTeam, setTeamId } = props;
  return (
    <>
      <p className="matchup-eyebrow">
        Viewing {defenseTeam.tricode} defense · vs {opposingTeam?.tricode} players
      </p>
      <h1 className="proto-b-title">
        {orderedTeams(props).map((team, index) => (
          <Fragment key={team.teamId}>
            {index > 0 && (
              <span className="proto-b-at" aria-hidden="true">
                @
              </span>
            )}
            <button
              type="button"
              aria-pressed={team.teamId === defenseTeam.teamId}
              aria-label={`${team.tricode} defense`}
              onClick={() => setTeamId(team.teamId)}
            >
              {team.tricode}
            </button>
          </Fragment>
        ))}
      </h1>
      <p className="proto-b-hint">Tap a team to view its Defense Sheet</p>
    </>
  );
}

function OneLineControls(props) {
  return (
    <section className="detail-controls proto-b-controls" aria-label="Defense Sheet controls">
      <div className="proto-b-line">
        <MarketPills {...props} className="proto-b-markets" />
        <div className="proto-b-right">
          <WindowButtons {...props} className="proto-b-pillgroup" />
          <DeviationButtons {...props} short className="proto-b-pillgroup" />
        </div>
      </div>
      <Notes {...props} />
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* C — Sidebar control panel: team + window + deviation live with the        */
/* players; the workspace keeps only a stat tab strip on top of the sheet.   */
/* ------------------------------------------------------------------------ */

function ControlPanel(props) {
  const { teams, defenseTeam, setTeamId } = props;
  return (
    <section className="proto-c-panel" aria-label="Defense Sheet controls">
      <p className="matchup-eyebrow">Sheet controls</p>
      <div className="proto-c-teams" role="group" aria-label="Defense team">
        {orderedTeams(props).map((team) => (
          <button
            type="button"
            key={team.teamId}
            aria-pressed={team.teamId === defenseTeam.teamId}
            onClick={() => setTeamId(team.teamId)}
          >
            <span className="proto-c-tricode">{team.tricode}</span>
            <span className="proto-c-team-meta">
              <span>Defense Sheet</span>
              <span>vs {opponentOf(teams, team)?.tricode} players</span>
            </span>
          </button>
        ))}
      </div>
      <div className="proto-c-row">
        <span className="proto-label">Window</span>
        <WindowButtons {...props} />
      </div>
      <div className="proto-c-row">
        <span className="proto-label">Deviation</span>
        <DeviationButtons {...props} short />
      </div>
      <Notes {...props} />
    </section>
  );
}

function TabStrip({ markets, market, setMarket, historical }) {
  return (
    <section
      className="detail-controls proto-c-controls"
      aria-label={historical ? 'Stat category' : 'Market'}
    >
      <div
        className="proto-c-tabs"
        role="group"
        aria-label={historical ? 'Stat category' : 'Market'}
      >
        {markets.map((item) => (
          <button
            type="button"
            aria-pressed={market === item}
            key={item}
            onClick={() => setMarket(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

export const VARIANTS = {
  A: { Title: null, SidebarTop: SideTabs, Controls: LabelledControls },
  B: { Title: HeaderSwitchTitle, SidebarTop: null, Controls: OneLineControls },
  C: { Title: null, SidebarTop: ControlPanel, Controls: TabStrip },
};

export { PrototypeSwitcher };
