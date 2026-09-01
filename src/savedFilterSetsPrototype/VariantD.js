/*
 * PROTOTYPE — throwaway.
 *
 * D — Filters first. The saved name is typed in a hurry and the natural
 * language query is never stored, so neither reliably says what a link is.
 * The parameters always do. So the player leads, the chips carry the row at
 * full size, and the name drops to a caption — still there to search by and
 * rename, no longer pretending to be the description.
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
      <li className="pd-row">
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
    <li className={`pd-row${mode === 'confirm' ? ' pa-row-danger' : ''}`}>
      <button
        type="button"
        className="pd-open"
        aria-label={`Open saved Filter Set ${item.name}`}
        onClick={() => onOpen(item)}
      >
        {/* A refused link decodes to no parameters at all, so its name is the
            only thing left to identify it by and has to lead. */}
        <span className="pd-lead">{described.player || item.name}</span>
        {described.refused ? (
          <span className="pa-refused">this link can no longer be opened</span>
        ) : (
          <span className="pd-chips">
            {described.chips.length === 0 && (
              <span className="proto-chip proto-chip-lg">every logged game</span>
            )}
            {described.chips.map((chip) => (
              <span
                key={chip.key}
                className={`proto-chip proto-chip-lg${chip.tone ? ` proto-chip-${chip.tone}` : ''}`}
              >
                {chip.label}
              </span>
            ))}
          </span>
        )}
        {described.player && <span className="pd-caption">{item.name}</span>}
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

const VariantD = ({ show, onHide, items, isLoading, error, onOpen, onRename, onDelete }) => (
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

export default VariantD;
