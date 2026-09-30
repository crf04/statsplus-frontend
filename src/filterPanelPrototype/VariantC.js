/*
 * PROTOTYPE — Variant C: summary rows. One row per filter, label left and
 * its current value right, like a settings list. Tapping a row opens its
 * editor in place; several can be open. Short controls (location) live in
 * the row itself. Every filter, Own stats included, is always listed.
 */
import { useState } from 'react';
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

const Row = ({ id, label, value, set, open, onToggle, children }) => (
  <div className={`fpc-row${open ? ' is-open' : ''}`}>
    <button
      type="button"
      className="fpc-row-head"
      aria-expanded={open}
      aria-controls={`fpc-${id}`}
      onClick={onToggle}
    >
      <span className="fpc-label">{label}</span>
      <span className={`fpc-value${set ? ' is-set' : ''}`}>{value}</span>
      <span className="fpc-chev" aria-hidden="true">
        ›
      </span>
    </button>
    {open && (
      <div className="fpc-body" id={`fpc-${id}`}>
        {children}
      </div>
    )}
  </div>
);

const VariantC = ({ panel, pinned, filler }) => {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => {
    if (id === 'self') panel.ensureSeason();
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const s = panel.summary;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const teammateValue = s.players
    ? s.players.length === 1
      ? `${s.players[0].name.split(' ').slice(-1)[0]} ${s.players[0].status}`
      : plural(s.players.length, 'teammate')
    : 'Any lineup';

  return (
    <div className={`fp fp-c${pinned ? ' fp-pinned' : ''}`}>
      <div className="fp-scroll">
        <div className="fpc-top">
          <h2>Filters</h2>
          {panel.activeCount > 0 && (
            <button type="button" className="fp-link" onClick={panel.resetAll}>
              Reset all
            </button>
          )}
        </div>

        <div className="fpc-list">
          <Row
            id="teammates"
            label="Teammates"
            value={teammateValue}
            set={s.players}
            open={open.has('teammates')}
            onToggle={() => toggle('teammates')}
          >
            <TeammateSearch panel={panel} />
            <TeammateChips panel={panel} />
          </Row>

          <div className="fpc-row fpc-row-inline">
            <span className="fpc-label">Location</span>
            <Segmented
              name="Location"
              size="sm"
              value={panel.locationFilter}
              onChange={panel.changeLocation}
              options={['Both', 'Home', 'Away']}
            />
          </div>

          <Row
            id="games"
            label="Recent games"
            value={s.games ? `Last ${s.games}` : 'All season'}
            set={s.games}
            open={open.has('games')}
            onToggle={() => toggle('games')}
          >
            <div className="fpc-quick">
              {[0, 5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={(Number(panel.gameFilter) || 0) === n ? 'is-on' : ''}
                  onClick={() => panel.changeGames(n)}
                >
                  {n === 0 ? 'All' : n}
                </button>
              ))}
            </div>
          </Row>

          <Row
            id="date"
            label="Since"
            value={s.date || 'Season start'}
            set={s.date}
            open={open.has('date')}
            onToggle={() => toggle('date')}
          >
            <input
              className="fp-input"
              type="date"
              aria-label="Since date"
              value={panel.dateFilter}
              onChange={(e) => panel.changeDate(e.target.value)}
            />
          </Row>

          <Row
            id="minutes"
            label="Minutes"
            value={s.minutes ? `${s.minutes[0]}–${s.minutes[1]}` : 'Any'}
            set={s.minutes}
            open={open.has('minutes')}
            onToggle={() => toggle('minutes')}
          >
            <Range
              value={panel.minutesFilter}
              min={0}
              max={48}
              onChange={panel.changeMinutes}
              labels={['Minimum minutes', 'Maximum minutes']}
            />
            <div className="fp-scale">
              <span>0</span>
              <span>48</span>
            </div>
          </Row>

          <Row
            id="playtype"
            label="Playtype rating"
            value={s.playtype ? `${s.playtype[0]}–${s.playtype[1]}` : 'Any'}
            set={s.playtype}
            open={open.has('playtype')}
            onToggle={() => toggle('playtype')}
          >
            <Range
              value={panel.playstyleMatchupRating}
              min={0}
              max={200}
              onChange={panel.changePlaytype}
              labels={['Minimum rating', 'Maximum rating']}
            />
            <div className="fp-scale">
              <span>0</span>
              <span>200</span>
            </div>
          </Row>

          {panel.opponentTricode && (
            <div className="fpc-row fpc-row-inline">
              <span className="fpc-label">Opponent</span>
              <span className="fp-chip fp-chip-gold">
                <span className="fp-chip-body">vs {panel.opponentTricode}</span>
                <button type="button" className="fp-chip-x" onClick={panel.clearOpponent}>
                  ×
                </button>
              </span>
            </div>
          )}

          <Row
            id="defense"
            label="Opponent defense"
            value={s.defense ? plural(s.defense.length, 'rule') : 'Any team'}
            set={s.defense}
            open={open.has('defense')}
            onToggle={() => toggle('defense')}
          >
            <DefenseChips panel={panel} />
            <DefenseBuilder panel={panel} />
          </Row>

          <Row
            id="self"
            label="Own stat line"
            value={s.self ? plural(s.self.length, 'range') : 'Add a range'}
            set={s.self}
            open={open.has('self')}
            onToggle={() => toggle('self')}
          >
            <SelfChips panel={panel} />
            <StatSelect panel={panel} />
            <StatRange panel={panel} />
            <button
              type="button"
              className="fp-btn-ghost fp-btn-block"
              disabled={!panel.canAddSelfFilter}
              onClick={panel.addSelfFilter}
            >
              Add stat filter
            </button>
          </Row>
        </div>
        {filler}
      </div>

      <button type="button" className="fp-btn-primary fpc-apply" onClick={panel.apply}>
        {panel.dirtyCount > 0
          ? `Apply ${panel.dirtyCount} change${panel.dirtyCount === 1 ? '' : 's'}`
          : 'Apply filters'}
      </button>
    </div>
  );
};

export default VariantC;
