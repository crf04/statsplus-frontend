/*
 * PROTOTYPE — Variant B: the Filter Set reads as a sentence. Active filters
 * are the top of the panel, one line each; everything else is a tile in an
 * "Add a filter" menu that opens one editor at a time. Nothing that is off
 * takes up room, and Own stats is a tile like any other.
 */
import { useState } from 'react';
import { opponentFilterRankLabel } from '../opponentFilters';
import {
  DefenseBuilder,
  Range,
  Segmented,
  StatRange,
  StatSelect,
  TeammateSearch,
  selfChipLabel,
} from './parts';

export const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const TILES = [
  { key: 'teammate', title: 'Teammate', sub: 'on / off court' },
  { key: 'games', title: 'Last N', sub: 'most recent games' },
  { key: 'date', title: 'Since', sub: 'a date' },
  { key: 'location', title: 'Home / Away', sub: 'venue' },
  { key: 'minutes', title: 'Minutes', sub: 'played' },
  { key: 'playtype', title: 'Playtype', sub: 'matchup rating' },
  { key: 'defense', title: 'Opp. defense', sub: 'team ranks' },
  { key: 'self', title: 'Own stat line', sub: 'e.g. PTS 20+' },
];

const Rule = ({ kind, children, onEdit, onRemove }) => (
  <li className="fpb-rule">
    <button type="button" className="fpb-rule-body" onClick={onEdit}>
      <span className="fpb-rule-kind">{kind}</span>
      <span className="fpb-rule-text">{children}</span>
    </button>
    <button type="button" className="fp-chip-x" aria-label={`Remove ${kind}`} onClick={onRemove}>
      ×
    </button>
  </li>
);

export const Editor = ({ which, panel, onDone }) => {
  const title = TILES.find((tile) => tile.key === which)?.title;
  let body = null;
  if (which === 'teammate') body = <TeammateSearch panel={panel} />;
  if (which === 'games')
    body = (
      <div className="fpb-quick">
        {[5, 10, 15, 20].map((n) => (
          <button
            key={n}
            type="button"
            className={Number(panel.gameFilter) === n ? 'is-on' : ''}
            onClick={() => panel.changeGames(n)}
          >
            {n}
          </button>
        ))}
        <input
          className="fp-input"
          type="number"
          min="0"
          inputMode="numeric"
          placeholder="Custom"
          aria-label="Last N games"
          value={Number(panel.gameFilter) > 0 ? panel.gameFilter : ''}
          onChange={(e) =>
            panel.changeGames(e.target.value === '' ? 0 : parseInt(e.target.value, 10))
          }
        />
      </div>
    );
  if (which === 'date')
    body = (
      <input
        className="fp-input"
        type="date"
        aria-label="Since date"
        value={panel.dateFilter}
        onChange={(e) => panel.changeDate(e.target.value)}
      />
    );
  if (which === 'location')
    body = (
      <Segmented
        name="Location"
        value={panel.locationFilter}
        onChange={panel.changeLocation}
        options={['Both', 'Home', 'Away']}
      />
    );
  if (which === 'minutes')
    body = (
      <>
        <div className="fp-rowlabel">
          <span>Minutes played</span>
          <span className="fp-val is-set">
            {panel.minutesFilter[0]}–{panel.minutesFilter[1]}
          </span>
        </div>
        <Range
          value={panel.minutesFilter}
          min={0}
          max={48}
          onChange={panel.changeMinutes}
          labels={['Minimum minutes', 'Maximum minutes']}
        />
      </>
    );
  if (which === 'playtype')
    body = (
      <>
        <div className="fp-rowlabel">
          <span>Playtype matchup rating</span>
          <span className="fp-val is-set">
            {panel.playstyleMatchupRating[0]}–{panel.playstyleMatchupRating[1]}
          </span>
        </div>
        <Range
          value={panel.playstyleMatchupRating}
          min={0}
          max={200}
          onChange={panel.changePlaytype}
          labels={['Minimum rating', 'Maximum rating']}
        />
      </>
    );
  if (which === 'defense') body = <DefenseBuilder panel={panel} onAdded={onDone} />;
  if (which === 'self')
    body = (
      <>
        <StatSelect panel={panel} />
        <StatRange panel={panel} />
        <button
          type="button"
          className="fp-btn-ghost fp-btn-block"
          disabled={!panel.canAddSelfFilter}
          onClick={() => panel.addSelfFilter() && onDone()}
        >
          Add stat filter
        </button>
      </>
    );
  return (
    <div className="fpb-editor">
      <div className="fpb-editor-head">
        <span>{title}</span>
        <button type="button" className="fp-link" onClick={onDone}>
          Done
        </button>
      </div>
      {body}
    </div>
  );
};

const VariantB = ({ panel, pinned, filler }) => {
  const [editing, setEditing] = useState(null);
  const s = panel.summary;
  const rules = [];
  panel.activePlayers.forEach((player) =>
    rules.push(
      <Rule
        key={`p-${player.name}`}
        kind={player.status === 'on' ? 'with' : 'without'}
        onEdit={() => panel.togglePlayer(player)}
        onRemove={() => panel.removePlayer(player)}
      >
        {player.name} <em>{player.status === 'on' ? 'on court' : 'off court'}</em>
      </Rule>,
    ),
  );
  if (s.games)
    rules.push(
      <Rule
        key="g"
        kind="last"
        onEdit={() => setEditing('games')}
        onRemove={() => panel.changeGames(0)}
      >
        {s.games} games
      </Rule>,
    );
  if (s.date)
    rules.push(
      <Rule
        key="d"
        kind="since"
        onEdit={() => setEditing('date')}
        onRemove={() => panel.changeDate('')}
      >
        {formatDate(s.date)}
      </Rule>,
    );
  if (s.location)
    rules.push(
      <Rule
        key="l"
        kind="venue"
        onEdit={() => setEditing('location')}
        onRemove={() => panel.changeLocation('Both')}
      >
        {s.location} games
      </Rule>,
    );
  if (s.minutes)
    rules.push(
      <Rule
        key="m"
        kind="played"
        onEdit={() => setEditing('minutes')}
        onRemove={() => panel.changeMinutes([0, 48])}
      >
        {s.minutes[0]}–{s.minutes[1]} min
      </Rule>,
    );
  if (s.playtype)
    rules.push(
      <Rule
        key="r"
        kind="rating"
        onEdit={() => setEditing('playtype')}
        onRemove={() => panel.changePlaytype([0, 200])}
      >
        playtype {s.playtype[0]}–{s.playtype[1]}
      </Rule>,
    );
  if (s.opponent)
    rules.push(
      <Rule key="o" kind="versus" onEdit={() => {}} onRemove={panel.clearOpponent}>
        {s.opponent}
      </Rule>,
    );
  panel.activeFilters.forEach((filter, index) =>
    rules.push(
      <Rule
        key={`t-${filter.filter}`}
        kind="versus"
        onEdit={() => setEditing('defense')}
        onRemove={() => panel.removeDefensiveFilter(index)}
      >
        {opponentFilterRankLabel(filter.filter, filter.number)}
      </Rule>,
    ),
  );
  panel.activeSelfFilters.forEach((filter, index) =>
    rules.push(
      <Rule
        key={`s-${filter.column}`}
        kind="own"
        onEdit={() => setEditing('self')}
        onRemove={() => panel.removeSelfFilter(index)}
      >
        {selfChipLabel(filter)}
      </Rule>,
    ),
  );

  return (
    <div className={`fp fp-b${pinned ? ' fp-pinned' : ''}`}>
      <div className="fp-scroll">
        <div className="fpb-head">
          <span className="fpb-eyebrow">Showing</span>
          <h2>{panel.selectedPlayer}&rsquo;s games</h2>
        </div>
        {rules.length > 0 ? (
          <ul className="fpb-rules">{rules}</ul>
        ) : (
          <p className="fpb-empty">Every game this season. Add a filter to narrow it.</p>
        )}

        {editing ? (
          <Editor which={editing} panel={panel} onDone={() => setEditing(null)} />
        ) : (
          <>
            <div className="fpb-addlabel">Add a filter</div>
            <div className="fpb-tiles">
              {TILES.map((tile) => (
                <button
                  key={tile.key}
                  type="button"
                  className="fpb-tile"
                  onClick={() => {
                    if (tile.key === 'self') panel.ensureSeason();
                    setEditing(tile.key);
                  }}
                >
                  <b>+ {tile.title}</b>
                  <span>{tile.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {filler}
      </div>

      <div className="fpb-foot">
        {panel.activeCount > 0 && (
          <button type="button" className="fp-link" onClick={panel.resetAll}>
            Clear all
          </button>
        )}
        <button type="button" className="fp-btn-primary" onClick={panel.apply}>
          {panel.dirtyCount > 0
            ? `Apply ${panel.dirtyCount} change${panel.dirtyCount === 1 ? '' : 's'}`
            : 'Apply'}
        </button>
      </div>
    </div>
  );
};

export default VariantB;
