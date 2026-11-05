/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Four ways to show "Add a filter" in the Log Workspace panel. Each one only
 * changes how the filters are offered; every button opens the same editor as
 * today (`start(key)`), and C's presets call the panel's own actions.
 */
import './variants.css';

// The same eight filters, grouped by what they narrow.
const GROUPS = [
  {
    title: 'Games',
    question: 'Which games?',
    items: [
      {
        key: 'games',
        label: 'Last N games',
        hint: 'most recent only',
        phrase: 'from his last N games',
      },
      { key: 'date', label: 'Since a date', hint: 'from a start date', phrase: 'since a date' },
      { key: 'location', label: 'Home / Away', hint: 'venue', phrase: 'at home or away' },
    ],
  },
  {
    title: 'Opponent',
    question: 'Against whom?',
    items: [
      { key: 'opponent', label: 'One team', hint: 'e.g. vs BOS', phrase: 'against one team' },
      {
        key: 'defense',
        label: 'Defense rank',
        hint: 'e.g. top-10 vs PTS',
        phrase: 'against a defense ranked…',
      },
    ],
  },
  {
    title: 'Player',
    question: 'What else happened?',
    items: [
      {
        key: 'teammate',
        label: 'Teammate on/off',
        hint: 'with or without',
        phrase: 'with or without a teammate',
      },
      {
        key: 'minutes',
        label: 'Minutes played',
        hint: 'his minutes',
        phrase: 'when he played N min',
      },
      {
        key: 'self',
        label: 'Own stat line',
        hint: 'e.g. PTS 20+',
        phrase: 'when he had a stat line',
      },
    ],
  },
];

// A: the tiles stay, under headings, with labels that need no hint.
const Grouped = ({ start }) => (
  <div className="af-a">
    {GROUPS.map((group) => (
      <section key={group.title}>
        <h4>{group.title}</h4>
        <div className="af-a-row">
          {group.items.map((item) => (
            <button
              key={item.key}
              type="button"
              className="fpb-tile"
              onClick={() => start(item.key)}
            >
              <b>+ {item.label}</b>
            </button>
          ))}
        </div>
      </section>
    ))}
  </div>
);

// B: a settings-style list; the hint is always visible on the right.
const List = ({ start }) => (
  <div className="af-b">
    {GROUPS.map((group) => (
      <section key={group.title}>
        <h4>{group.title}</h4>
        <ul>
          {group.items.map((item) => (
            <li key={item.key}>
              <button type="button" onClick={() => start(item.key)}>
                <span className="af-b-plus">+</span>
                <b>{item.label}</b>
                <span className="af-b-hint">{item.hint}</span>
                <span className="af-b-chev">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);

// C: a question per group, common values one tap away, "…" for the rest.
const Questions = ({ start, panel }) => {
  const s = panel.summary;
  const minutes = s.minutes || [0, 48];
  const presets = {
    Games: [
      ...[5, 10, 20].map((n) => ({
        label: `Last ${n}`,
        on: s.games === n,
        tap: () => panel.changeGames(s.games === n ? 0 : n),
      })),
      {
        label: 'Home',
        on: s.location === 'Home',
        tap: () => panel.changeLocation(s.location === 'Home' ? 'Both' : 'Home'),
      },
      {
        label: 'Away',
        on: s.location === 'Away',
        tap: () => panel.changeLocation(s.location === 'Away' ? 'Both' : 'Away'),
      },
      { label: 'Since…', tap: () => start('date') },
    ],
    Opponent: [
      { label: 'One team…', tap: () => start('opponent') },
      { label: 'Defense rank…', tap: () => start('defense') },
    ],
    Player: [
      {
        label: '30+ min',
        on: minutes[0] === 30 && minutes[1] === 48,
        tap: () => panel.changeMinutes(minutes[0] === 30 ? [0, 48] : [30, 48]),
      },
      { label: 'Minutes…', tap: () => start('minutes') },
      { label: 'Teammate on/off…', tap: () => start('teammate') },
      { label: 'Stat line…', tap: () => start('self') },
    ],
  };
  return (
    <div className="af-c">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h4>{group.question}</h4>
          <div className="af-c-chips">
            {presets[group.title].map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-pressed={Boolean(chip.on)}
                className={chip.on ? 'is-on' : ''}
                onClick={chip.tap}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

// D: the panel reads as a sentence; each pill is the next phrase.
const Sentence = ({ start, panel }) => {
  const player = String(panel.selectedPlayer || '').split(' ')[0];
  return (
    <div className="af-d">
      <p>
        Narrow {player ? `${player}'s` : 'the'} games<span>…</span>
      </p>
      <div className="af-d-pills">
        {GROUPS.flatMap((group) => group.items).map((item) => (
          <button key={item.key} type="button" onClick={() => start(item.key)}>
            + {item.phrase}
          </button>
        ))}
      </div>
    </div>
  );
};

const VARIANT_VIEWS = { A: Grouped, B: List, C: Questions, D: Sentence };

export const AddFilterVariant = ({ variant, start, panel }) => {
  const View = VARIANT_VIEWS[variant];
  return View ? <View start={start} panel={panel} /> : null;
};
