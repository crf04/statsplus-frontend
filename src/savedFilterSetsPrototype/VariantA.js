/*
 * PROTOTYPE — throwaway.
 *
 * A — Roster rows. A modal of dense two-line rows: the name in the display
 * face, and underneath it the player and one chip per parameter the link
 * carries. The whole row is the open target; managing a row is a secondary
 * column that only appears on hover or focus, and deleting confirms in place
 * rather than in a second dialog.
 */
import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { describeSavedFilterSet } from './describe';

const Row = ({ item, onOpen, onRename, onDelete }) => {
  const described = describeSavedFilterSet(item.queryString);
  const [mode, setMode] = useState(null);
  const [draft, setDraft] = useState(item.name);

  if (mode === 'rename') {
    return (
      <li className="pa-row pa-row-editing">
        <form
          className="pa-rename"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(item, draft.trim());
            setMode(null);
          }}
        >
          <input
            autoFocus
            value={draft}
            maxLength={100}
            aria-label={`New name for ${item.name}`}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="pa-btn pa-btn-primary" disabled={!draft.trim()}>
            Save
          </button>
          <button type="button" className="pa-btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className={`pa-row${mode === 'confirm' ? ' pa-row-danger' : ''}`}>
      <button type="button" className="pa-open" onClick={() => onOpen(item)}>
        <span className="pa-name">{item.name}</span>
        <span className="pa-line">
          {described.player ? <span className="pa-player">{described.player}</span> : null}
          {described.refused ? (
            <span className="pa-refused">this link can no longer be opened</span>
          ) : (
            <span className="proto-chips">
              {described.chips.length === 0 && (
                <span className="proto-chip">every logged game</span>
              )}
              {described.chips.map((chip) => (
                <span
                  key={chip.key}
                  className={`proto-chip${chip.tone ? ` proto-chip-${chip.tone}` : ''}`}
                >
                  {chip.label}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
      {mode === 'confirm' ? (
        <div className="pa-actions pa-actions-open">
          <span className="pa-confirm-text">Delete?</span>
          <button
            type="button"
            className="pa-btn pa-btn-danger"
            onClick={() => {
              onDelete(item);
              setMode(null);
            }}
          >
            Yes
          </button>
          <button type="button" className="pa-btn" onClick={() => setMode(null)}>
            No
          </button>
        </div>
      ) : (
        <div className="pa-actions">
          <button
            type="button"
            className="pa-icon"
            aria-label={`Rename ${item.name}`}
            onClick={() => {
              setDraft(item.name);
              setMode('rename');
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="pa-icon pa-icon-danger"
            aria-label={`Delete ${item.name}`}
            onClick={() => setMode('confirm')}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
};

const VariantA = ({ show, onHide, items, isLoading, error, onOpen, onRename, onDelete }) => (
  <Modal show={show} onHide={onHide} centered size="lg" contentClassName="proto-modal">
    <Modal.Header closeButton closeVariant="white">
      <Modal.Title as="h2" className="proto-title">
        Saved Filter Sets
        <span className="proto-count">{items.length}</span>
      </Modal.Title>
    </Modal.Header>
    <Modal.Body className="pa-body">
      {error && <p className="proto-error">{error}</p>}
      {isLoading && <p className="proto-muted">Loading…</p>}
      {!isLoading && items.length === 0 && (
        <p className="proto-muted">
          Nothing saved yet. Build a Filter Set in the Workspace and save it to come back to it.
        </p>
      )}
      <ul className="pa-list">
        {items.map((item) => (
          <Row key={item.id} item={item} onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
        ))}
      </ul>
    </Modal.Body>
  </Modal>
);

export default VariantA;
