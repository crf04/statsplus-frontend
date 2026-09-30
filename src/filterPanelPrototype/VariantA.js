/*
 * PROTOTYPE — Variant A: grouped sheet. Every control is on screen, sorted
 * into four labelled groups (Lineup, Games, Matchup, Own stats). Values are
 * read beside each label; the Apply bar sticks to the bottom of the panel.
 */
import {
  DefenseBuilder,
  DefenseChips,
  Range,
  Segmented,
  SelfChips,
  StatRange,
  StatSelect,
  TeammateChips,
  TeammateSearch,
} from './parts';

const Section = ({ title, active, hint, children }) => (
  <section className="fpa-section">
    <header className="fpa-section-head">
      <h3>
        {title}
        {active ? <span className="fpa-dot" aria-label="has filters" /> : null}
      </h3>
      {hint && <p>{hint}</p>}
    </header>
    {children}
  </section>
);

const VariantA = ({ panel }) => {
  const s = panel.summary;
  const firstName = panel.selectedPlayer.split(' ')[0];
  return (
    <div className="fp fp-a">
      <div className="fpa-top">
        <h2>Filters</h2>
        <div className="fpa-top-meta">
          <span className="fp-count">{panel.activeCount || 'No'} active</span>
          {panel.activeCount > 0 && (
            <button type="button" className="fp-link" onClick={panel.resetAll}>
              Reset
            </button>
          )}
        </div>
      </div>

      <Section title="Lineup" active={s.players} hint="Tap a chip to flip on/off.">
        <TeammateSearch panel={panel} />
        <TeammateChips panel={panel} />
      </Section>

      <Section title="Games" active={s.date || s.games || s.location || s.minutes}>
        <div className="fpa-grid2">
          <label className="fp-field">
            <span>Since</span>
            <input
              className="fp-input"
              type="date"
              value={panel.dateFilter}
              onChange={(e) => panel.changeDate(e.target.value)}
            />
          </label>
          <label className="fp-field">
            <span>Last</span>
            <div className="fp-suffix">
              <input
                className="fp-input"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="All"
                value={Number(panel.gameFilter) > 0 ? panel.gameFilter : ''}
                onChange={(e) =>
                  panel.changeGames(e.target.value === '' ? 0 : parseInt(e.target.value, 10))
                }
              />
              <em>games</em>
            </div>
          </label>
        </div>
        <div className="fp-field">
          <span>Location</span>
          <Segmented
            name="Location"
            value={panel.locationFilter}
            onChange={panel.changeLocation}
            options={['Both', 'Home', 'Away']}
          />
        </div>
        <div className="fp-field">
          <div className="fp-rowlabel">
            <span>Minutes</span>
            <span className={`fp-val${s.minutes ? ' is-set' : ''}`}>
              {s.minutes ? `${panel.minutesFilter[0]}–${panel.minutesFilter[1]}` : 'Any'}
            </span>
          </div>
          <Range
            value={panel.minutesFilter}
            min={0}
            max={48}
            onChange={panel.changeMinutes}
            labels={['Minimum minutes', 'Maximum minutes']}
          />
        </div>
      </Section>

      <Section title="Matchup" active={s.playtype || s.defense || s.opponent}>
        {panel.opponentTricode && (
          <div className="fp-chips">
            <span className="fp-chip fp-chip-gold">
              <span className="fp-chip-body">vs {panel.opponentTricode}</span>
              <button type="button" className="fp-chip-x" onClick={panel.clearOpponent}>
                ×
              </button>
            </span>
          </div>
        )}
        <div className="fp-field">
          <div className="fp-rowlabel">
            <span>Playtype matchup rating</span>
            <span className={`fp-val${s.playtype ? ' is-set' : ''}`}>
              {s.playtype
                ? `${panel.playstyleMatchupRating[0]}–${panel.playstyleMatchupRating[1]}`
                : 'Any'}
            </span>
          </div>
          <Range
            value={panel.playstyleMatchupRating}
            min={0}
            max={200}
            onChange={panel.changePlaytype}
            labels={['Minimum rating', 'Maximum rating']}
          />
        </div>
        <div className="fp-field">
          <span>Opponent defense</span>
          <DefenseChips panel={panel} />
          <DefenseBuilder panel={panel} />
        </div>
      </Section>

      <Section
        title="Own stats"
        active={s.self}
        hint={`Keep games where ${firstName}'s own line fell in a range.`}
      >
        <SelfChips panel={panel} />
        <div className="fpa-stat-row">
          <StatSelect panel={panel} />
          <button
            type="button"
            className="fp-btn-ghost"
            disabled={!panel.canAddSelfFilter}
            onClick={panel.addSelfFilter}
          >
            Add
          </button>
        </div>
        <StatRange panel={panel} />
      </Section>

      <div className="fpa-applybar">
        <button type="button" className="fp-btn-primary" onClick={panel.apply}>
          {panel.dirtyCount > 0
            ? `Apply ${panel.dirtyCount} change${panel.dirtyCount === 1 ? '' : 's'}`
            : 'Apply filters'}
        </button>
      </div>
    </div>
  );
};

export default VariantA;
