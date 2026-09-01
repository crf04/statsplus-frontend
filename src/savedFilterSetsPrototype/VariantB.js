/*
 * PROTOTYPE — throwaway.
 *
 * B — Grouped by player. The hierarchy is inverted: the player the link is
 * about comes first and the name you gave it comes second, because a saved
 * list is mostly re-read as "what have I got on Luka?". A filter field narrows
 * across names, players, and decoded filters at once, and management hides
 * behind an explicit Manage toggle so the resting state is only the list.
 */
import { useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { describeSavedFilterSet } from './describe';

const UNKNOWN_PLAYER = 'No player in this link';

const VariantB = ({ show, onHide, items, isLoading, error, onOpen, onRename, onDelete }) => {
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const described = items.map((item) => ({
      item,
      described: describeSavedFilterSet(item.queryString),
    }));
    const matching = described.filter(({ item, described: d }) =>
      needle === ''
        ? true
        : `${item.name} ${d.player || ''} ${d.chips.map((chip) => chip.label).join(' ')}`
            .toLowerCase()
            .includes(needle),
    );
    const byPlayer = new Map();
    matching.forEach((entry) => {
      const key = entry.described.player || UNKNOWN_PLAYER;
      if (!byPlayer.has(key)) byPlayer.set(key, []);
      byPlayer.get(key).push(entry);
    });
    return [...byPlayer.entries()];
  }, [items, query]);

  const shown = groups.reduce((total, [, entries]) => total + entries.length, 0);

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="proto-modal">
      <Modal.Header closeButton closeVariant="white">
        <Modal.Title as="h2" className="proto-title">
          Saved Filter Sets
          <span className="proto-count">{items.length}</span>
        </Modal.Title>
      </Modal.Header>
      <div className="pb-toolbar">
        <input
          className="pb-search"
          type="search"
          value={query}
          placeholder="Filter by player, name, or filter…"
          aria-label="Filter saved Filter Sets"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className={`pa-btn${managing ? ' pa-btn-primary' : ''}`}
          aria-pressed={managing}
          onClick={() => {
            setManaging((was) => !was);
            setRenamingId(null);
          }}
        >
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>
      <Modal.Body className="pb-body">
        {error && <p className="proto-error">{error}</p>}
        {isLoading && <p className="proto-muted">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <p className="proto-muted">
            Nothing saved yet. Build a Filter Set in the Workspace and save it to come back to it.
          </p>
        )}
        {!isLoading && items.length > 0 && shown === 0 && (
          <p className="proto-muted">Nothing matches “{query}”.</p>
        )}
        {groups.map(([player, entries]) => (
          <section key={player} className="pb-group">
            <h3 className="pb-group-head">
              <span>{player}</span>
              <span className="pb-group-count">{entries.length}</span>
            </h3>
            <ul className="pb-list">
              {entries.map(({ item, described }) => (
                <li key={item.id} className="pb-item">
                  {renamingId === item.id ? (
                    <form
                      className="pa-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onRename(item, draft.trim());
                        setRenamingId(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        maxLength={100}
                        aria-label={`New name for ${item.name}`}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                      <button
                        type="submit"
                        className="pa-btn pa-btn-primary"
                        disabled={!draft.trim()}
                      >
                        Save
                      </button>
                      <button type="button" className="pa-btn" onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button type="button" className="pb-open" onClick={() => onOpen(item)}>
                        <span className="pb-name">{item.name}</span>
                        <span className="proto-chips">
                          {described.refused ? (
                            <em className="pa-refused">unopenable link</em>
                          ) : (
                            described.chips.map((chip) => (
                              <span
                                key={chip.key}
                                className={`proto-chip${chip.tone ? ` proto-chip-${chip.tone}` : ''}`}
                              >
                                {chip.label}
                              </span>
                            ))
                          )}
                        </span>
                      </button>
                      {managing && (
                        <span className="pb-manage">
                          <button
                            type="button"
                            className="pa-icon"
                            aria-label={`Rename ${item.name}`}
                            onClick={() => {
                              setDraft(item.name);
                              setRenamingId(item.id);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="pa-icon pa-icon-danger"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => onDelete(item)}
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Modal.Body>
    </Modal>
  );
};

export default VariantB;
