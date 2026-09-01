/*
 * PROTOTYPE — throwaway, see branch prototype/defensive-filter-look
 * Plan: Three variants of the defensive filter control, switchable via
 * #dfproto=, inside the existing filter panel on /.
 *
 * Three structurally different presentations of the defensive-filter control
 * from src/FilterOptions.js, chosen at runtime by `#dfproto=A|B|C` in the URL
 * hash (never a query param — on `/` the query string is parsed as a Saved
 * Filter Set, and an unknown param makes the page refuse to load). Defaults
 * to A. Gated end-to-end on NODE_ENV !== 'production': in production this
 * module always resolves to variant A and the switcher bar never renders.
 */
import { useState, useEffect } from 'react';
import { Form, FormControl, Button, InputGroup } from 'react-bootstrap';
import { OPPONENT_FILTERS, opponentFilterLabel } from './opponentFilters';
import './DefensiveFilterPrototype.css';

const VARIANTS = ['A', 'B', 'C'];
const VARIANT_NAMES = {
  A: 'Grouped select',
  B: 'Category pills',
  C: 'Searchable picker',
};

const CATEGORY_SHORT_LABELS = {
  'General defense': 'General',
  'Shot type defense': 'Shot type',
  'Play type defense': 'Play type',
  'Assists allowed': 'Assists',
};

const parseVariantFromHash = () => {
  const match = (window.location.hash || '').match(/dfproto=([ABC])/);
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
