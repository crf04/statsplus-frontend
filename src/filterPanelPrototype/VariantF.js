/*
 * PROTOTYPE — Variant F: no sidebar. C's summary rows become a bar of
 * buttons above the chart, one per filter, each showing its value and
 * opening its editor in a popover. The chart takes the full width, so there
 * is no second column whose height has to match.
 */
import { useEffect, useRef, useState } from 'react';
import { DefenseChips, SelfChips, TeammateChips, selfChipLabel } from './parts';
import { Editor, formatDate } from './VariantB';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const VariantF = ({ panel }) => {
  const [open, setOpen] = useState(null);
  const [left, setLeft] = useState(0);
  const barRef = useRef(null);
  const s = panel.summary;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) setOpen(null);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pills = [
    {
      key: 'teammate',
      label: 'Teammates',
      value: s.players
        ? s.players.length === 1
          ? `${s.players[0].name.split(' ').slice(-1)[0]} ${s.players[0].status}`
          : plural(s.players.length, 'teammate')
        : 'Any',
      set: s.players,
    },
    { key: 'games', label: 'Games', value: s.games ? `Last ${s.games}` : 'All', set: s.games },
    { key: 'date', label: 'Since', value: s.date ? formatDate(s.date) : 'Season', set: s.date },
    { key: 'location', label: 'Venue', value: s.location || 'Both', set: s.location },
    {
      key: 'minutes',
      label: 'Minutes',
      value: s.minutes ? `${s.minutes[0]}–${s.minutes[1]}` : 'Any',
      set: s.minutes,
    },
    {
      key: 'playtype',
      label: 'Playtype',
      value: s.playtype ? `${s.playtype[0]}–${s.playtype[1]}` : 'Any',
      set: s.playtype,
    },
    {
      key: 'defense',
      label: 'Opp. defense',
      value: s.defense ? plural(s.defense.length, 'rule') : 'Any',
      set: s.defense,
    },
    {
      key: 'self',
      label: 'Own stats',
      value: s.self
        ? s.self.length === 1
          ? selfChipLabel(s.self[0])
          : plural(s.self.length, 'range')
        : 'Add',
      set: s.self,
    },
  ];

  const toggle = (key, event) => {
    if (open === key) {
      setOpen(null);
      return;
    }
    if (key === 'self') panel.ensureSeason();
    const bar = barRef.current.getBoundingClientRect();
    const pill = event.currentTarget.getBoundingClientRect();
    const width = Math.min(360, bar.width - 16);
    setLeft(Math.max(8, Math.min(pill.left - bar.left, bar.width - width - 8)));
    setOpen(key);
  };

  return (
    <div className="fp fp-f" ref={barRef}>
      <div className="fpf-bar">
        <span className="fpf-title">Filters</span>
        <div className="fpf-pills">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className={`fpf-pill${pill.set ? ' is-set' : ''}${open === pill.key ? ' is-open' : ''}`}
              aria-expanded={open === pill.key}
              onClick={(event) => toggle(pill.key, event)}
            >
              <span className="fpf-pill-label">{pill.label}</span>
              <span className="fpf-pill-value">{pill.value}</span>
            </button>
          ))}
        </div>
        <div className="fpf-actions">
          {panel.activeCount > 0 && (
            <button type="button" className="fp-link" onClick={panel.resetAll}>
              Reset
            </button>
          )}
          <button type="button" className="fp-btn-primary fpf-apply" onClick={panel.apply}>
            {panel.dirtyCount > 0 ? `Apply ${panel.dirtyCount}` : 'Apply'}
          </button>
        </div>
      </div>
      {open && (
        <div className="fpf-pop" style={{ left }}>
          <Editor which={open} panel={panel} onDone={() => setOpen(null)} />
          {open === 'teammate' && <TeammateChips panel={panel} />}
          {open === 'defense' && <DefenseChips panel={panel} />}
          {open === 'self' && <SelfChips panel={panel} />}
        </div>
      )}
    </div>
  );
};

export default VariantF;
