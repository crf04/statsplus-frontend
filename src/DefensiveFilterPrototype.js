/*
 * PROTOTYPE — throwaway, see branch prototype/defensive-filter-look
 * Plan: Six variants of the defensive filter control, switchable via
 * #dfproto=, inside the existing filter panel on /.
 *
 * Six structurally different presentations of the defensive-filter control
 * from src/FilterOptions.js, chosen at runtime by `#dfproto=A|B|C|D|E|F` in
 * the URL hash (never a query param — on `/` the query string is parsed as a
 * Saved Filter Set, and an unknown param makes the page refuse to load).
 * Defaults to A. Gated end-to-end on NODE_ENV !== 'production': in
 * production this module always resolves to variant A and the switcher bar
 * never renders.
 */
import { useState, useEffect } from 'react';
import { Form, FormControl, Button, InputGroup } from 'react-bootstrap';
import { OPPONENT_FILTERS, opponentFilterLabel } from './opponentFilters';
import './DefensiveFilterPrototype.css';

const VARIANTS = ['A', 'B', 'C', 'D', 'E', 'F'];
const VARIANT_NAMES = {
  A: 'Grouped select',
  B: 'Category pills',
  C: 'Searchable picker',
  D: 'Pills + select',
  E: 'Scout sheet',
  F: 'Sentence builder',
};

const CATEGORY_SHORT_LABELS = {
  'General defense': 'General',
  'Shot type defense': 'Shot type',
  'Play type defense': 'Play type',
  'Assists allowed': 'Assists',
};

const parseVariantFromHash = () => {
  const match = (window.location.hash || '').match(/dfproto=([A-F])/);
  return match ? match[1] : 'A';
};

/**
 * Reads the current prototype variant from `window.location.hash` and
 * subscribes to `hashchange` so it stays live. Outside development this
 * always resolves to 'A' without ever reading the hash.
 */
export const useDfProtoVariant = () => {
  const [variant, setVariant] = useState(() =>
    process.env.NODE_ENV === 'production' ? 'A' : parseVariantFromHash(),
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const onHashChange = () => setVariant(parseVariantFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return process.env.NODE_ENV === 'production' ? 'A' : variant;
};

const cycleVariant = (direction) => {
  const current = parseVariantFromHash();
  const index = VARIANTS.indexOf(current);
  const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
  window.location.hash = `dfproto=${next}`;
};

const isTypingTarget = (element) =>
  !!element &&
  (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);

/** Fixed bottom-centre pill for cycling prototype variants. Never renders in production. */
export const DfProtoSwitcher = () => {
  const variant = useDfProtoVariant();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTypingTarget(document.activeElement)) return;
      cycleVariant(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div
      className="dfproto-switcher"
      role="toolbar"
      aria-label="Defensive filter prototype switcher"
    >
      <button
        type="button"
        className="dfproto-switcher-btn"
        onClick={() => cycleVariant(-1)}
        aria-label="Previous defensive filter variant"
      >
        ←
      </button>
      <span className="dfproto-switcher-label">
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button
        type="button"
        className="dfproto-switcher-btn"
        onClick={() => cycleVariant(1)}
        aria-label="Next defensive filter variant"
      >
        →
      </button>
    </div>
  );
};

/** Variant A — the grouped native select, verbatim. Also the production markup. */
export const VariantA = ({
  selectedDefensiveFilter,
  setSelectedDefensiveFilter,
  filterNumber,
  setFilterNumber,
  canAddFilter,
  handleAddFilter,
}) => (
  <InputGroup>
    <Form.Select
      id="defensive-filter"
      value={selectedDefensiveFilter}
      onChange={(e) => setSelectedDefensiveFilter(e.target.value)}
    >
      <option value="None">None</option>
      {OPPONENT_FILTERS.map((group) => (
        <optgroup key={group.category} label={group.category}>
          {group.items.map((item) => (
            <option key={item.token} value={item.token}>
              {item.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Form.Select>
    <FormControl
      id="defensive-filter-rank"
      aria-label="Defensive filter rank"
      type="text"
      value={filterNumber}
      onChange={(e) => {
        const value = e.target.value;
        if (value === '' || /^-?\d*$/.test(value)) {
          setFilterNumber(value);
        }
      }}
      onBlur={() => {
        if (filterNumber === '' || isNaN(parseInt(filterNumber))) {
          setFilterNumber('');
        } else {
          setFilterNumber(parseInt(filterNumber).toString());
        }
      }}
      placeholder="Number"
      style={{ appearance: 'textfield' }}
    />
    <Button
      type="button"
      variant="outline-primary"
      onClick={handleAddFilter}
      disabled={!canAddFilter}
    >
      Add
    </Button>
  </InputGroup>
);

/** Variant B — category pills reveal a flat, tappable chip grid. No <select>. */
export const VariantB = ({
  selectedDefensiveFilter,
  setSelectedDefensiveFilter,
  filterNumber,
  setFilterNumber,
  canAddFilter,
  handleAddFilter,
  activeFilters,
  handleRemoveFilter,
}) => {
  const [activeCategory, setActiveCategory] = useState(OPPONENT_FILTERS[0].category);
  const currentGroup = OPPONENT_FILTERS.find((group) => group.category === activeCategory);

  return (
    <div>
      <div className="dfproto-pill-row">
        {OPPONENT_FILTERS.map((group, index) => (
          <Button
            key={group.category}
            type="button"
            id={index === 0 ? 'defensive-filter' : undefined}
            size="sm"
            variant={group.category === activeCategory ? 'primary' : 'outline-primary'}
            onClick={() => setActiveCategory(group.category)}
          >
            {CATEGORY_SHORT_LABELS[group.category] || group.category}
          </Button>
        ))}
      </div>
      <div className="dfproto-status-line">
        {selectedDefensiveFilter === 'None'
          ? 'Pick a filter below'
          : `Selected: ${opponentFilterLabel(selectedDefensiveFilter)}`}
      </div>
      <div className="dfproto-chip-grid">
        {currentGroup.items.map((item) => {
          const addedIndex = activeFilters.findIndex((f) => f.filter === item.token);
          const isAdded = addedIndex !== -1;
          const isSelected = selectedDefensiveFilter === item.token;
          return (
            <Button
              key={item.token}
              type="button"
              size="sm"
              variant={isSelected ? 'primary' : 'outline-primary'}
              className={isAdded ? 'dfproto-chip-added' : undefined}
              onClick={() =>
                isAdded ? handleRemoveFilter(addedIndex) : setSelectedDefensiveFilter(item.token)
              }
            >
              {item.label}
              {isAdded ? ' ✕' : ''}
            </Button>
          );
        })}
      </div>
      <InputGroup className="dfproto-rank-row">
        <FormControl
          id="defensive-filter-rank"
          aria-label="Defensive filter rank"
          type="text"
          value={filterNumber}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^-?\d*$/.test(value)) {
              setFilterNumber(value);
            }
          }}
          onBlur={() => {
            if (filterNumber === '' || isNaN(parseInt(filterNumber))) {
              setFilterNumber('');
            } else {
              setFilterNumber(parseInt(filterNumber).toString());
            }
          }}
          placeholder="Number"
          style={{ appearance: 'textfield' }}
        />
        <Button
          type="button"
          variant="outline-primary"
          onClick={handleAddFilter}
          disabled={!canAddFilter}
        >
          Add
        </Button>
      </InputGroup>
    </div>
  );
};

/** Variant C — a single search box; no category navigation upfront. */
export const VariantC = ({
  selectedDefensiveFilter,
  setSelectedDefensiveFilter,
  filterNumber,
  setFilterNumber,
  canAddFilter,
  handleAddFilter,
  activeFilters,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setQuery(
      selectedDefensiveFilter === 'None' ? '' : opponentFilterLabel(selectedDefensiveFilter),
    );
  }, [selectedDefensiveFilter]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const trimmed = query.trim().toLowerCase();
  const filteredGroups = OPPONENT_FILTERS.map((group) => ({
    category: group.category,
    items: group.items.filter(
      (item) =>
        trimmed === '' ||
        item.label.toLowerCase().includes(trimmed) ||
        item.token.toLowerCase().includes(trimmed),
    ),
  })).filter((group) => group.items.length > 0);
  const flatResults = filteredGroups.flatMap((group) => group.items);

  const selectItem = (item) => {
    setSelectedDefensiveFilter(item.token);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatResults[highlightedIndex];
      if (chosen) selectItem(chosen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div>
      <div className="dfproto-search-wrapper">
        <FormControl
          id="defensive-filter"
          type="text"
          placeholder="Search 35 defensive filters…"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={handleKeyDown}
        />
        {isOpen && (
          <div className="dfproto-results-panel">
            {filteredGroups.length === 0 && (
              <div className="dfproto-results-empty">No filters match &ldquo;{query}&rdquo;</div>
            )}
            {filteredGroups.map((group) => (
              <div key={group.category}>
                <div className="dfproto-results-heading">{group.category}</div>
                {group.items.map((item) => {
                  const flatIndex = flatResults.indexOf(item);
                  const isAdded = activeFilters.some((f) => f.filter === item.token);
                  return (
                    <button
                      type="button"
                      key={item.token}
                      className={`dfproto-result-item${
                        flatIndex === highlightedIndex ? ' highlighted' : ''
                      }${isAdded ? ' added' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectItem(item)}
                    >
                      <span>{item.label}</span>
                      {isAdded && <span className="dfproto-result-tag">Added</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <InputGroup className="dfproto-rank-row">
        <FormControl
          id="defensive-filter-rank"
          aria-label="Defensive filter rank"
          type="text"
          value={filterNumber}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^-?\d*$/.test(value)) {
              setFilterNumber(value);
            }
          }}
          onBlur={() => {
            if (filterNumber === '' || isNaN(parseInt(filterNumber))) {
              setFilterNumber('');
            } else {
              setFilterNumber(parseInt(filterNumber).toString());
            }
          }}
          placeholder="Number"
          style={{ appearance: 'textfield' }}
        />
        <Button
          type="button"
          variant="outline-primary"
          onClick={handleAddFilter}
          disabled={!canAddFilter}
        >
          Add
        </Button>
      </InputGroup>
    </div>
  );
};

/**
 * Variant D — VariantB's category pills on top of a VariantA-style select,
 * scoped to the active category's 7-11 options (plus a leading None) so the
 * select never needs scrolling. Switching category resets the selection to
 * None unless the currently selected token already belongs to the new
 * category. Pills, select, rank input and Add button are styled to read as
 * one composed control.
 */
export const VariantD = ({
  selectedDefensiveFilter,
  setSelectedDefensiveFilter,
  filterNumber,
  setFilterNumber,
  canAddFilter,
  handleAddFilter,
}) => {
  const [activeCategory, setActiveCategory] = useState(OPPONENT_FILTERS[0].category);
  const currentGroup = OPPONENT_FILTERS.find((group) => group.category === activeCategory);

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    const group = OPPONENT_FILTERS.find((g) => g.category === category);
    const belongsToNewCategory = group.items.some((item) => item.token === selectedDefensiveFilter);
    if (!belongsToNewCategory) {
      setSelectedDefensiveFilter('None');
    }
  };

  return (
    <div className="dfproto-d-composed">
      <div className="dfproto-pill-row">
        {OPPONENT_FILTERS.map((group) => (
          <Button
            key={group.category}
            type="button"
            size="sm"
            className="dfproto-pill"
            variant={group.category === activeCategory ? 'primary' : 'outline-primary'}
            onClick={() => handleCategoryChange(group.category)}
          >
            {CATEGORY_SHORT_LABELS[group.category] || group.category}
          </Button>
        ))}
      </div>
      <InputGroup>
        <Form.Select
          id="defensive-filter"
          className="dfproto-select"
          value={selectedDefensiveFilter}
          onChange={(e) => setSelectedDefensiveFilter(e.target.value)}
        >
          <option value="None">None</option>
          {currentGroup.items.map((item) => (
            <option key={item.token} value={item.token}>
              {item.label}
            </option>
          ))}
        </Form.Select>
        <FormControl
          id="defensive-filter-rank"
          aria-label="Defensive filter rank"
          className="dfproto-rank-input"
          type="text"
          value={filterNumber}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^-?\d*$/.test(value)) {
              setFilterNumber(value);
            }
          }}
          onBlur={() => {
            if (filterNumber === '' || isNaN(parseInt(filterNumber))) {
              setFilterNumber('');
            } else {
              setFilterNumber(parseInt(filterNumber).toString());
            }
          }}
          placeholder="Number"
          style={{ appearance: 'textfield' }}
        />
        <Button
          type="button"
          variant="outline-primary"
          onClick={handleAddFilter}
          disabled={!canAddFilter}
        >
          Add
        </Button>
      </InputGroup>
      <div className="dfproto-rank-helper">Positive rank = top defenses, negative = bottom</div>
    </div>
  );
};

// E and F replace the raw signed-number input with an explicit Top/Bottom
// affordance. The signed string handleAddFilter/canAddFilter expect is only
// ever produced here, via each variant's own applyRank, and pushed through
// the existing setFilterNumber setter — the parent's add/validate logic is
// untouched.
const clampMagnitude = (value) => Math.min(30, Math.max(1, value));

/**
 * Variant E — "Scout sheet". The control collapses to a single trigger
 * button; tapping opens an overlay (a bottom sheet on narrow screens, an
 * anchored panel on desktop) with a searchable, grouped list. Picking a row
 * swaps the list for a rank line (Top/Bottom segmented toggle + stepper)
 * inside the same sheet.
 */
export const VariantE = ({
  selectedDefensiveFilter,
  setSelectedDefensiveFilter,
  setFilterNumber,
  canAddFilter,
  handleAddFilter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [direction, setDirection] = useState('top');
  const [magnitude, setMagnitude] = useState(5);

  const phase = selectedDefensiveFilter === 'None' ? 'list' : 'rank';

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const trimmed = query.trim().toLowerCase();
  const filteredGroups = OPPONENT_FILTERS.map((group) => ({
    category: group.category,
    items: group.items.filter(
      (item) =>
        trimmed === '' ||
        item.label.toLowerCase().includes(trimmed) ||
        item.token.toLowerCase().includes(trimmed),
    ),
  })).filter((group) => group.items.length > 0);
  const flatResults = filteredGroups.flatMap((group) => group.items);

  const applyRank = (nextDirection, nextMagnitude) => {
    setFilterNumber(`${nextDirection === 'bottom' ? '-' : ''}${nextMagnitude}`);
  };

  const handleSelectRow = (item) => {
    setSelectedDefensiveFilter(item.token);
    applyRank(direction, magnitude);
  };

  const handleDirectionChange = (nextDirection) => {
    setDirection(nextDirection);
    applyRank(nextDirection, magnitude);
  };

  const handleMagnitudeChange = (nextMagnitude) => {
    const clamped = clampMagnitude(nextMagnitude);
    setMagnitude(clamped);
    applyRank(direction, clamped);
  };

  const handleListKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatResults[highlightedIndex];
      if (chosen) handleSelectRow(chosen);
    }
  };

  return (
    <div>
      <button
        type="button"
        id="defensive-filter"
        className="dfproto-sheet-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <span>
          {selectedDefensiveFilter === 'None'
            ? 'Choose a defensive filter'
            : opponentFilterLabel(selectedDefensiveFilter)}
        </span>
        <span className="dfproto-sheet-trigger-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {isOpen && (
        <>
          <div className="dfproto-sheet-backdrop" onClick={() => setIsOpen(false)} />
          <div
            className="dfproto-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a defensive filter"
          >
            {phase === 'list' ? (
              <>
                <FormControl
                  type="text"
                  autoFocus
                  autoComplete="off"
                  placeholder="Search 35 defensive filters…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleListKeyDown}
                  className="dfproto-picker-search"
                />
                <div className="dfproto-picker-list">
                  {filteredGroups.length === 0 && (
                    <div className="dfproto-results-empty">
                      No filters match &ldquo;{query}&rdquo;
                    </div>
                  )}
                  {filteredGroups.map((group) => (
                    <div key={group.category}>
                      <div className="dfproto-results-heading">{group.category}</div>
                      {group.items.map((item) => {
                        const flatIndex = flatResults.indexOf(item);
                        return (
                          <button
                            type="button"
                            key={item.token}
                            className={`dfproto-sheet-row${
                              flatIndex === highlightedIndex ? ' highlighted' : ''
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectRow(item)}
                          >
                            <span>{item.label}</span>
                            <span className="dfproto-sheet-row-token">{item.token}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="dfproto-sheet-rank">
                <button
                  type="button"
                  className="dfproto-sheet-back"
                  onClick={() => setSelectedDefensiveFilter('None')}
                >
                  ← Change filter
                </button>
                <div className="dfproto-sheet-chosen-label">
                  {opponentFilterLabel(selectedDefensiveFilter)}
                </div>
                <div className="dfproto-segmented" role="group" aria-label="Rank direction">
                  <button
                    type="button"
                    className={direction === 'top' ? 'active' : ''}
                    onClick={() => handleDirectionChange('top')}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    className={direction === 'bottom' ? 'active' : ''}
                    onClick={() => handleDirectionChange('bottom')}
                  >
                    Bottom
                  </button>
                </div>
                <div className="dfproto-stepper">
                  <button
                    type="button"
                    aria-label="Decrease rank"
                    disabled={magnitude <= 1}
                    onClick={() => handleMagnitudeChange(magnitude - 1)}
                  >
                    −
                  </button>
                  <span className="dfproto-stepper-value">{magnitude}</span>
                  <button
                    type="button"
                    aria-label="Increase rank"
                    disabled={magnitude >= 30}
                    onClick={() => handleMagnitudeChange(magnitude + 1)}
                  >
                    +
                  </button>
                </div>
                <div className="dfproto-helper-copy">
                  {direction === 'top'
                    ? `Top ${magnitude} — the ${magnitude} best defenses`
                    : `Bottom ${magnitude} — the ${magnitude} weakest`}
                </div>
                <Button
                  type="button"
                  variant="primary"
                  className="dfproto-sheet-add"
                  disabled={!canAddFilter}
                  onClick={() => {
                    if (!canAddFilter) return;
                    handleAddFilter();
                    setIsOpen(false);
                  }}
                >
                  Add filter
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Variant F — "Sentence builder". The control reads as one line of prose:
 * `vs [top] [8] [Spot-Up] defenses`. "vs"/"defenses" are static; the three
 * blanks are inline controls (direction toggle, inline number, and a
 * category word that opens a compact searchable popover reusing Variant C's
 * grouped/sticky-heading list). An "Add" text-button closes the sentence.
 */
export const VariantF = ({
  selectedDefensiveFilter,
  setSelectedDefensiveFilter,
  setFilterNumber,
  canAddFilter,
  handleAddFilter,
}) => {
  const [direction, setDirection] = useState('top');
  const [magnitudeText, setMagnitudeText] = useState('5');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverQuery, setPopoverQuery] = useState('');
  const [popoverHighlightIndex, setPopoverHighlightIndex] = useState(0);

  useEffect(() => {
    setPopoverHighlightIndex(0);
  }, [popoverQuery]);

  useEffect(() => {
    if (!isPopoverOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsPopoverOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPopoverOpen]);

  const currentMagnitude = () => {
    const parsed = parseInt(magnitudeText, 10);
    return Number.isNaN(parsed) ? 5 : clampMagnitude(parsed);
  };

  const applyRank = (nextDirection, nextMagnitude) => {
    setFilterNumber(`${nextDirection === 'bottom' ? '-' : ''}${nextMagnitude}`);
  };

  const cycleDirection = () => {
    const next = direction === 'top' ? 'bottom' : 'top';
    setDirection(next);
    applyRank(next, currentMagnitude());
  };

  const commitMagnitude = () => {
    const clamped = currentMagnitude();
    setMagnitudeText(clamped.toString());
    applyRank(direction, clamped);
  };

  const trimmed = popoverQuery.trim().toLowerCase();
  const filteredGroups = OPPONENT_FILTERS.map((group) => ({
    category: group.category,
    items: group.items.filter(
      (item) =>
        trimmed === '' ||
        item.label.toLowerCase().includes(trimmed) ||
        item.token.toLowerCase().includes(trimmed),
    ),
  })).filter((group) => group.items.length > 0);
  const flatResults = filteredGroups.flatMap((group) => group.items);

  const selectCategoryItem = (item) => {
    setSelectedDefensiveFilter(item.token);
    applyRank(direction, currentMagnitude());
    setIsPopoverOpen(false);
  };

  const handlePopoverKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPopoverHighlightIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPopoverHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatResults[popoverHighlightIndex];
      if (chosen) selectCategoryItem(chosen);
    }
  };

  return (
    <div className="dfproto-sentence">
      <span className="dfproto-sentence-plain">vs</span>
      <button
        type="button"
        className="dfproto-sentence-blank dfproto-sentence-direction"
        onClick={cycleDirection}
      >
        {direction} <span aria-hidden="true">▾</span>
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Rank number"
        className="dfproto-sentence-number"
        value={magnitudeText}
        size={2}
        onChange={(e) => setMagnitudeText(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onBlur={commitMagnitude}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitMagnitude();
          }
        }}
      />
      <span className="dfproto-sentence-category-wrap">
        <button
          type="button"
          id="defensive-filter"
          className={`dfproto-sentence-blank dfproto-sentence-category${
            selectedDefensiveFilter === 'None' ? ' placeholder' : ''
          }`}
          aria-haspopup="listbox"
          aria-expanded={isPopoverOpen}
          onClick={() => setIsPopoverOpen((open) => !open)}
        >
          {selectedDefensiveFilter === 'None'
            ? 'choose a filter'
            : opponentFilterLabel(selectedDefensiveFilter)}
        </button>
        {isPopoverOpen && (
          <div className="dfproto-results-panel dfproto-sentence-popover">
            <FormControl
              type="text"
              autoFocus
              autoComplete="off"
              placeholder="Search…"
              value={popoverQuery}
              onChange={(e) => setPopoverQuery(e.target.value)}
              onKeyDown={handlePopoverKeyDown}
              onBlur={() => window.setTimeout(() => setIsPopoverOpen(false), 120)}
              className="dfproto-picker-search"
            />
            <div className="dfproto-picker-list">
              {filteredGroups.length === 0 && (
                <div className="dfproto-results-empty">
                  No filters match &ldquo;{popoverQuery}&rdquo;
                </div>
              )}
              {filteredGroups.map((group) => (
                <div key={group.category}>
                  <div className="dfproto-results-heading">{group.category}</div>
                  {group.items.map((item) => {
                    const flatIndex = flatResults.indexOf(item);
                    return (
                      <button
                        type="button"
                        key={item.token}
                        className={`dfproto-result-item${
                          flatIndex === popoverHighlightIndex ? ' highlighted' : ''
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCategoryItem(item)}
                      >
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </span>
      <span className="dfproto-sentence-plain">defenses</span>
      <button
        type="button"
        className="dfproto-sentence-add"
        disabled={!canAddFilter}
        onClick={() => {
          if (!canAddFilter) return;
          handleAddFilter();
        }}
      >
        Add
      </button>
    </div>
  );
};
