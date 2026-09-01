/*
 * PROTOTYPE — throwaway.
 *
 * C — Drawer + preview. Not a modal at all: a right-hand drawer that leaves
 * the Workspace visible behind it, so you can compare a saved link against
 * what is already on screen. Selecting is separated from opening — the left
 * rail is names, the right pane shows the whole decoded Filter Set as badges
 * plus the raw query string, and Open is one large deliberate affordance.
 * Rename and Delete live in the preview, never in the list.
 */
import { useEffect, useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { describeSavedFilterSet } from './describe';

const VariantC = ({ show, onHide, items, isLoading, error, onOpen, onRename, onDelete }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const selected = items.find((item) => item.id === selectedId) || items[0] || null;

  useEffect(() => {
    setIsRenaming(false);
  }, [selectedId]);

  const described = selected ? describeSavedFilterSet(selected.queryString) : null;

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="end"
      className="proto-drawer"
      aria-labelledby="pc-title"
    >
      <Offcanvas.Header closeButton closeVariant="white">
        <Offcanvas.Title as="h2" className="proto-title" id="pc-title">
          Saved Filter Sets
          <span className="proto-count">{items.length}</span>
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="pc-body">
        {error && <p className="proto-error">{error}</p>}
        {isLoading && <p className="proto-muted">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <p className="proto-muted">
            Nothing saved yet. Build a Filter Set in the Workspace and save it to come back to it.
          </p>
        )}
        {items.length > 0 && (
          <div className="pc-split">
            <ul className="pc-rail">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`pc-rail-item${item.id === selected?.id ? ' pc-rail-item-on' : ''}`}
                    aria-current={item.id === selected?.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
            {selected && described && (
              <div className="pc-preview">
                {isRenaming ? (
                  <form
                    className="pa-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onRename(selected, draft.trim());
                      setIsRenaming(false);
                    }}
                  >
                    <input
                      autoFocus
                      value={draft}
                      maxLength={100}
                      aria-label={`New name for ${selected.name}`}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <button
                      type="submit"
                      className="pa-btn pa-btn-primary"
                      disabled={!draft.trim()}
                    >
                      Save
                    </button>
                    <button type="button" className="pa-btn" onClick={() => setIsRenaming(false)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <h3 className="pc-preview-name">{selected.name}</h3>
                )}
                <p className="pc-preview-player">{described.player || 'No player in this link'}</p>
                {described.refused ? (
                  <p className="pa-refused">
                    This link carries something the app can no longer decode. Opening it will show a
                    refusal.
                  </p>
                ) : (
                  <div className="pc-badges">
                    {described.chips.length === 0 && (
                      <span className="proto-chip">no filters — every logged game</span>
                    )}
                    {described.chips.map((chip) => (
                      <span
                        key={chip.key}
                        className={`proto-chip${chip.tone ? ` proto-chip-${chip.tone}` : ''}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
                <code className="pc-query">?{selected.queryString}</code>
                <div className="pc-preview-actions">
                  <button
                    type="button"
                    className="pa-btn pa-btn-primary pc-open"
                    onClick={() => onOpen(selected)}
                  >
                    Open in the Workspace
                  </button>
                  <button
                    type="button"
                    className="pa-btn"
                    onClick={() => {
                      setDraft(selected.name);
                      setIsRenaming(true);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="pa-btn pa-btn-danger"
                    onClick={() => {
                      onDelete(selected);
                      setSelectedId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default VariantC;
