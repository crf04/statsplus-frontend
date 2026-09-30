/*
 * PROTOTYPE — throwaway. Small controls the variants share. Layout is never
 * shared: each variant arranges these however it likes.
 */
import ReactSlider from 'react-slider';
import { formatNumber } from '../numberUtils';
import { OPPONENT_FILTERS, RANK_TEAM_LIMIT, opponentFilterRankLabel } from '../opponentFilters';
import {
  DEFENSIVE_CATEGORY_PILL_LABELS,
  STAT_COLUMNS,
  STAT_LABELS,
  defensiveCategoryItems,
} from './useFilterPanel';

export const fmt = (value, digits = 0) =>
  digits === 0 ? String(Math.round(value)) : formatNumber(value, digits);

/* Thin two-thumb range. Values are read beside the label, not inside the
   thumbs, so the thumbs can be small and the track can be the full width. */
export const Range = ({ value, min, max, step = 1, onChange, labels, digits = 0 }) => (
  <ReactSlider
    className="fp-range"
    thumbClassName="fp-range-thumb"
    trackClassName="fp-range-track"
    value={value}
    min={min}
    max={max}
    step={step}
    pearling
    minDistance={0}
    ariaLabel={labels}
    ariaValuetext={(state) => fmt(state.valueNow, digits)}
    onChange={onChange}
  />
);

export const Segmented = ({ options, value, onChange, name, size }) => (
  <div className={`fp-seg${size ? ` fp-seg-${size}` : ''}`} role="radiogroup" aria-label={name}>
    {options.map((option) => {
      const key = typeof option === 'string' ? option : option.value;
      const label = typeof option === 'string' ? option : option.label;
      return (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? 'is-on' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      );
    })}
  </div>
);

export const Chip = ({ tone = 'gold', children, onRemove, onClick, removeLabel }) => (
  <span className={`fp-chip fp-chip-${tone}`}>
    {onClick ? (
      <button type="button" className="fp-chip-body" onClick={onClick}>
        {children}
      </button>
    ) : (
      <span className="fp-chip-body">{children}</span>
    )}
    {onRemove && (
      <button type="button" className="fp-chip-x" aria-label={removeLabel} onClick={onRemove}>
        ×
      </button>
    )}
  </span>
);

/* Teammate search. Picking a name adds it with the chosen on/off state. */
export const TeammateSearch = ({ panel, compact }) => (
  <div className="fp-teammate">
    <div className="fp-teammate-row">
      <input
        className="fp-input"
        type="text"
        value={panel.playerInput}
        onChange={(e) => panel.changePlayerSearch(e.target.value)}
        onKeyDown={panel.playerSearchKeyDown}
        placeholder={compact ? 'Teammate…' : 'Search a teammate…'}
        aria-label="Teammate"
        role="combobox"
        aria-expanded={panel.playerSuggestions.length > 0}
      />
      <Segmented
        name="Teammate on or off court"
        size="sm"
        value={panel.playerStatus}
        onChange={panel.setPlayerStatus}
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
        ]}
      />
    </div>
    {panel.playerSuggestions.length > 0 && (
      <ul className="fp-suggest" role="listbox">
        {panel.playerSuggestions.map((name, index) => (
          <li key={name}>
            <button
              type="button"
              role="option"
              aria-selected={index === panel.activePlayerSuggestionIndex}
              className={index === panel.activePlayerSuggestionIndex ? 'is-active' : ''}
              onClick={() => panel.addPlayer(name)}
            >
              <span>{name}</span>
              <em>+ {panel.playerStatus === 'on' ? 'on court' : 'off court'}</em>
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const TeammateChips = ({ panel }) =>
  panel.activePlayers.length > 0 && (
    <div className="fp-chips">
      {panel.activePlayers.map((player) => (
        <Chip
          key={`${player.status}-${player.name}`}
          tone={player.status === 'on' ? 'hit' : 'miss'}
          onClick={() => panel.togglePlayer(player)}
          onRemove={() => panel.removePlayer(player)}
          removeLabel={`Remove ${player.name}`}
        >
          <b>{player.status === 'on' ? 'ON' : 'OFF'}</b> {player.name}
        </Chip>
      ))}
    </div>
  );

export const StatSelect = ({ panel, id }) => (
  <select
    id={id}
    className="fp-select"
    value={panel.selectedSelfFilter}
    onFocus={panel.ensureSeason}
    onPointerDown={panel.ensureSeason}
    onChange={(e) => panel.selectSelfStat(e.target.value)}
    aria-label="Stat"
  >
    <option value="">Choose a stat…</option>
    {STAT_COLUMNS.map((column) => (
      <option key={column} value={column}>
        {STAT_LABELS[column] || column} ({column})
      </option>
    ))}
  </select>
);

/* The slider for the stat being built, or why it is not there yet. */
export const StatRange = ({ panel }) => {
  const column = panel.selectedSelfFilter;
  if (!column) return null;
  const bounds = panel.columnRanges[column];
  if (!bounds || !panel.selfFilterRange) {
    return (
      <div className="fp-note" role="status">
        {panel.seasonGameLogsFailed
          ? "Couldn't load this player's season, so there is no range to offer."
          : 'Loading the season range…'}
      </div>
    );
  }
  const digits = column === 'FG_PCT' ? 2 : bounds.max - bounds.min < 10 ? 1 : 0;
  return (
    <div className="fp-statrange">
      <div className="fp-rowlabel">
        <span>{STAT_LABELS[column] || column}</span>
        <span className="fp-val">
          {fmt(panel.selfFilterRange[0], digits)}–{fmt(panel.selfFilterRange[1], digits)}
        </span>
      </div>
      <Range
        value={panel.selfFilterRange}
        min={bounds.min}
        max={bounds.max}
        step={column === 'FG_PCT' ? 0.01 : 0.1 * (digits ? 1 : 10)}
        digits={digits}
        onChange={panel.setSelfFilterRange}
        labels={[`Minimum ${column}`, `Maximum ${column}`]}
      />
      <div className="fp-scale">
        <span>{fmt(bounds.min, digits)}</span>
        <span>season range</span>
        <span>{fmt(bounds.max, digits)}</span>
      </div>
    </div>
  );
};

export const selfChipLabel = (filter) => {
  const digits =
    filter.column === 'FG_PCT' ? 2 : filter.range.every((v) => Number.isInteger(v)) ? 0 : 1;
  return `${filter.column} ${fmt(filter.range[0], digits)}–${fmt(filter.range[1], digits)}`;
};

/* Opponent-defense builder: category tabs, metric, rank window, add. */
export const DefenseBuilder = ({ panel, onAdded }) => (
  <div className="fp-defense">
    <div className="fp-tabs" role="tablist" aria-label="Defense category">
      {OPPONENT_FILTERS.map((group) => (
        <button
          key={group.category}
          type="button"
          role="tab"
          aria-selected={group.category === panel.activeDefensiveCategory}
          className={group.category === panel.activeDefensiveCategory ? 'is-on' : ''}
          onClick={() => panel.changeDefensiveCategory(group.category)}
        >
          {DEFENSIVE_CATEGORY_PILL_LABELS[group.category]}
        </button>
      ))}
    </div>
    <select
      className="fp-select"
      aria-label="Defensive metric"
      value={panel.selectedDefensiveFilter}
      onChange={(e) => panel.setSelectedDefensiveFilter(e.target.value)}
    >
      <option value="None">Choose a metric…</option>
      {defensiveCategoryItems(panel.activeDefensiveCategory).map((item) => (
        <option key={item.token} value={item.token}>
          {item.label}
        </option>
      ))}
    </select>
    <div className="fp-rowlabel">
      <span>Opponent rank</span>
      <span className="fp-val">
        {panel.rankRange[0]}–{panel.rankRange[1]}
      </span>
    </div>
    <Range
      value={panel.rankRange}
      min={1}
      max={RANK_TEAM_LIMIT}
      onChange={panel.setRankRange}
      labels={['From rank', 'To rank']}
    />
    <div className="fp-scale">
      <span>1 · highest</span>
      <span>30 · lowest</span>
    </div>
    <button
      type="button"
      className="fp-btn-ghost fp-btn-block"
      disabled={!panel.canAddFilter}
      onClick={() => {
        if (panel.addDefensiveFilter()) onAdded?.();
      }}
    >
      {panel.selectedDefensiveFilter === 'None'
        ? 'Pick a metric to add'
        : `Add: ${panel.opponentFilterLabel(panel.selectedDefensiveFilter)}, ranks ${panel.rankRange[0]}–${panel.rankRange[1]}`}
    </button>
  </div>
);

export const DefenseChips = ({ panel }) =>
  panel.activeFilters.length > 0 && (
    <div className="fp-chips">
      {panel.activeFilters.map((filter, index) => (
        <Chip
          key={filter.filter}
          onRemove={() => panel.removeDefensiveFilter(index)}
          removeLabel={`Remove ${panel.opponentFilterLabel(filter.filter)}`}
        >
          {opponentFilterRankLabel(filter.filter, filter.number)}
        </Chip>
      ))}
    </div>
  );

export const SelfChips = ({ panel }) =>
  panel.activeSelfFilters.length > 0 && (
    <div className="fp-chips">
      {panel.activeSelfFilters.map((filter, index) => (
        <Chip
          key={filter.column}
          onRemove={() => panel.removeSelfFilter(index)}
          removeLabel={`Remove ${filter.column} filter`}
        >
          {selfChipLabel(filter)}
        </Chip>
      ))}
    </div>
  );
