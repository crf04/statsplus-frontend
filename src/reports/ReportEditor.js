import { useEffect, useRef, useState } from 'react';
import { allBlocks, errorCode, saveReportEdits } from '../reportsApi';
import { blockLabel, editableCards } from './blocks/blockEdits';
import { cardLabel, TAG_LABEL } from './reportText';

/*
 * The author's Edit mode (crf04/statsplus#377): rename the report, write
 * notes, hide or restore items, and remove, restore and reorder the cards
 * within an item. A block document (crf04/statsplus#380) does the same per
 * block, addressed by the block's id. It works from the report as published, so anything taken
 * out stays here, greyed, to be put back. Cards never rerun.
 */

export const TITLE_LIMIT = 120;
export const NOTES_LIMIT = 2000;

// Characters as the server counts them (code points, not UTF-16 units).
const length = (text) => [...text].length;
const clip = (text, limit) => (length(text) > limit ? [...text].slice(0, limit).join('') : text);

const sameOrder = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

/* The draft the editor opens on: the report as its author last saved it. */
const startDraft = (report) => {
  const { original, edits } = report;
  const base = { title: report.document.title, notes: report.notes ?? '' };
  if (original.document.blocks) {
    const saved = new Map((edits?.blocks ?? []).map((o) => [o.id, o]));
    return {
      ...base,
      blocks: Object.fromEntries(
        allBlocks(original.document.blocks).map((block) => {
          const published = editableCards(block);
          const override = saved.get(block.id);
          return [
            block.id,
            {
              hidden: override?.hidden ?? false,
              cards: override?.cards
                ? override.cards.filter((id) => published.includes(id))
                : published,
            },
          ];
        }),
      ),
    };
  }
  const saved = new Map((edits?.items ?? []).map((o) => [`${o.tab}:${o.item}`, o]));
  return {
    ...base,
    items: original.document.tabs.map((tab, t) =>
      tab.items.map((item, i) => {
        const override = saved.get(`${t}:${i}`);
        return override
          ? {
              hidden: override.hidden,
              cards: override.cards.filter((id) => item.cards.includes(id)),
            }
          : { hidden: false, cards: item.cards };
      }),
    ),
  };
};

/*
 * The PUT body: the whole edit, replacing every earlier one. Only items or
 * blocks that differ from how they were published are listed; a block sends
 * its cards only when their order or number changed.
 */
export const editsBody = (draft, original) => {
  const base = { title: draft.title.trim(), notes: draft.notes.trim() ? draft.notes : null };
  if (original.document.blocks) {
    return {
      ...base,
      blocks: allBlocks(original.document.blocks).flatMap((block) => {
        const { hidden, cards } = draft.blocks[block.id];
        const reordered = !sameOrder(cards, editableCards(block));
        return hidden || reordered ? [{ id: block.id, hidden, ...(reordered && { cards }) }] : [];
      }),
    };
  }
  return {
    ...base,
    items: original.document.tabs.flatMap((tab, t) =>
      tab.items.flatMap((item, i) => {
        const { hidden, cards } = draft.items[t][i];
        return hidden || !sameOrder(cards, item.cards) ? [{ tab: t, item: i, hidden, cards }] : [];
      }),
    ),
  };
};

const ERRORS = {
  notes_links: {
    field: 'notes',
    text: 'Notes can’t contain links. Take out anything starting http://, https:// or www.',
  },
  notes_too_long: {
    field: 'notes',
    text: `Notes can be at most ${NOTES_LIMIT.toLocaleString('en-US')} characters.`,
  },
  invalid_edits: {
    field: 'form',
    text: 'Those card changes no longer match the report. Cancel, reload and try again.',
  },
};
const FAILED = { field: 'form', text: 'Your edits didn’t save. Try again.' };

export const Count = ({ id, used, limit }) => (
  <span id={id} className={`report-edit-count${used > limit ? ' is-over' : ''}`}>
    {used.toLocaleString('en-US')}/{limit.toLocaleString('en-US')}
  </span>
);

const CardRow = ({ id, label, place, total, removed, onMove, onRemove, onRestore }) => (
  <li className={`report-edit-card${removed ? ' is-removed' : ''}`} data-card={id}>
    <span className="report-edit-card-place" aria-hidden="true">
      {removed ? '–' : place + 1}
    </span>
    <span className="report-edit-card-label">
      {label}
      {removed && <span className="report-edit-flag">Removed</span>}
    </span>
    <span className="report-edit-card-actions">
      {removed ? (
        <button type="button" data-action="restore" onClick={onRestore}>
          Restore <span className="visually-hidden">{label}</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            className="report-edit-move"
            data-action="up"
            aria-label={`Move ${label} up`}
            title="Move up"
            disabled={place === 0}
            onClick={() => onMove(-1)}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="report-edit-move"
            data-action="down"
            aria-label={`Move ${label} down`}
            title="Move down"
            disabled={place === total - 1}
            onClick={() => onMove(1)}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button type="button" data-action="remove" onClick={onRemove}>
            Remove <span className="visually-hidden">{label}</span>
          </button>
        </>
      )}
    </span>
  </li>
);

const hiddenNote = (noun, item) => {
  if (noun === 'tabs') return 'Hidden from readers, with every block in it.';
  if (noun === 'block' && !item.cards.length) return 'Hidden from readers.';
  return 'Hidden from readers, with its cards.';
};

const ItemEditor = ({
  item,
  itemKey,
  state,
  calls,
  onChange,
  focusLater,
  announce,
  noun = 'item',
  children,
}) => {
  const label = (id) => cardLabel(calls[id]);
  const removed = item.cards.filter((id) => !state.cards.includes(id));
  const move = (id, step) => {
    const from = state.cards.indexOf(id);
    const to = from + step;
    const cards = [...state.cards];
    [cards[from], cards[to]] = [cards[to], cards[from]];
    onChange({ ...state, cards });
    // At the top or bottom that button goes inert, so the keyboard lands on its twin.
    focusLater(id, step < 0 ? 'up' : 'down');
    announce(`${label(id)} moved to ${to + 1} of ${cards.length}.`);
  };
  const remove = (id) => {
    onChange({ ...state, cards: state.cards.filter((card) => card !== id) });
    focusLater(id, 'restore');
    announce(`${label(id)} removed.`);
  };
  const restore = (id) => {
    onChange({ ...state, cards: [...state.cards, id] });
    focusLater(id, 'remove');
    announce(`${label(id)} restored, last of ${state.cards.length + 1}.`);
  };
  return (
    <section
      data-item={itemKey}
      className={`report-edit-item${state.hidden ? ' is-hidden' : ''}`}
      aria-label={item.title}
    >
      <div className="report-edit-item-head">
        <h3>
          {item.tag && <span className={`report-tag ${item.tag}`}>{TAG_LABEL[item.tag]}</span>}{' '}
          {item.title}
          {state.hidden && <span className="report-edit-flag">Hidden</span>}
        </h3>
        <button
          type="button"
          className="report-edit-item-toggle"
          onClick={() => {
            onChange({ ...state, hidden: !state.hidden });
            announce(`${item.title} ${state.hidden ? 'restored' : 'hidden'}.`);
          }}
        >
          {state.hidden ? `Restore ${noun}` : `Hide ${noun}`}
          <span className="visually-hidden"> {item.title}</span>
        </button>
      </div>
      {state.hidden ? (
        <p className="report-edit-note">{hiddenNote(noun, item)}</p>
      ) : item.cards.length ? (
        <ol className="report-edit-cards" aria-label={`Cards in ${item.title}`}>
          {state.cards.map((id, place) => (
            <CardRow
              key={id}
              id={id}
              label={label(id)}
              place={place}
              total={state.cards.length}
              onMove={(step) => move(id, step)}
              onRemove={() => remove(id)}
            />
          ))}
          {removed.map((id) => (
            <CardRow key={id} id={id} label={label(id)} removed onRestore={() => restore(id)} />
          ))}
        </ol>
      ) : // A block that never carries cards shows only what it holds, if anything.
      children !== undefined ? (
        children
      ) : (
        <p className="report-edit-note">No cards.</p>
      )}
    </section>
  );
};

/*
 * A block document's blocks in document order, each hidden or restored by its
 * id; a tab group lists its tabs' blocks under it, and hiding the group hides
 * them all.
 */
const BlockEditors = ({ blocks, draft, calls, setBlock, focusLater, announce }) =>
  blocks.map((block) => {
    const state = draft.blocks[block.id];
    return (
      <ItemEditor
        key={block.id}
        item={{ title: blockLabel(block, calls), tag: block.tag, cards: editableCards(block) }}
        itemKey={block.id}
        state={state}
        calls={calls}
        onChange={setBlock(block.id)}
        focusLater={(id, action) => focusLater(block.id, id, action)}
        announce={announce}
        noun={block.type === 'tabs' ? 'tabs' : 'block'}
      >
        {block.type === 'tabs'
          ? block.tabs.map((tab, t) => (
              <fieldset key={t} className="report-edit-tab">
                <legend>{tab.title}</legend>
                <BlockEditors
                  blocks={tab.blocks}
                  draft={draft}
                  calls={calls}
                  setBlock={setBlock}
                  focusLater={focusLater}
                  announce={announce}
                />
              </fieldset>
            ))
          : null}
      </ItemEditor>
    );
  });

const ReportEditor = ({ report, notesLabel, onSaved, onCancel }) => {
  const { original } = report;
  const [draft, setDraft] = useState(() => startDraft(report));
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [status, setStatus] = useState('');
  const formRef = useRef(null);
  const focusNext = useRef(null);

  // A save that lands after the editor closed (the account changed, say) is dropped.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    formRef.current?.querySelector('#report-edit-title')?.focus();
    return () => {
      open.current = false;
    };
  }, []);

  // A moved, removed or restored card keeps the keyboard on it.
  useEffect(() => {
    const next = focusNext.current;
    if (!next || !formRef.current) return;
    focusNext.current = null;
    // The same card can sit in several items; look only in the one that changed.
    const row = [...formRef.current.querySelectorAll('[data-item] [data-card]')].find(
      (node) =>
        node.closest('[data-item]').dataset.item === next.item && node.dataset.card === next.id,
    );
    const buttons = row ? [...row.querySelectorAll('button')] : [];
    const target =
      buttons.find((button) => button.dataset.action === next.action && !button.disabled) ??
      buttons.find((button) => !button.disabled);
    target?.focus();
  });

  const setItem = (t, i) => (state) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((items, ti) =>
        ti === t ? items.map((old, ii) => (ii === i ? state : old)) : items,
      ),
    }));

  const setBlock = (id) => (state) =>
    setDraft((current) => ({ ...current, blocks: { ...current.blocks, [id]: state } }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setRefusal(null);
    try {
      const saved = await saveReportEdits(report.id, editsBody(draft, original));
      if (open.current) onSaved(saved);
    } catch (failure) {
      if (!open.current) return;
      setRefusal(ERRORS[errorCode(failure)] ?? FAILED);
      setSaving(false);
    }
  };

  const notesRefusal = refusal?.field === 'notes' ? refusal.text : null;
  const formRefusal = refusal?.field === 'form' ? refusal.text : null;
  const titleLength = length(draft.title);
  const notesLength = length(draft.notes);

  return (
    <form className="report-editor" ref={formRef} onSubmit={save} aria-label="Edit report">
      <div className="report-edit-intro">
        <h1 className="report-eyebrow">Editing your report</h1>
        <p>
          Readers see only what you keep. Cards stay exactly as published, with the same data;
          anything you hide or remove can be restored here.
        </p>
      </div>

      {/* While a save is in flight the draft is frozen, so nothing typed then is lost. */}
      <fieldset className="report-edit-draft" disabled={saving}>
        <div className="report-edit-field">
          <div className="report-edit-label-row">
            <label htmlFor="report-edit-title">Title</label>
            <Count id="report-edit-title-count" used={titleLength} limit={TITLE_LIMIT} />
          </div>
          <input
            id="report-edit-title"
            type="text"
            required
            value={draft.title}
            aria-describedby="report-edit-title-count"
            onChange={(event) =>
              setDraft({ ...draft, title: clip(event.target.value, TITLE_LIMIT) })
            }
          />
        </div>

        <div className="report-edit-field">
          <div className="report-edit-label-row">
            <label htmlFor="report-edit-notes">Notes</label>
            <Count id="report-edit-notes-count" used={notesLength} limit={NOTES_LIMIT} />
          </div>
          <p className="report-edit-help" id="report-edit-notes-help">
            Your own words, shown under the opening as “{notesLabel}”. Plain text; leave a blank
            line between paragraphs. Links aren’t allowed.
          </p>
          <textarea
            id="report-edit-notes"
            rows={6}
            value={draft.notes}
            aria-invalid={Boolean(notesRefusal) || notesLength > NOTES_LIMIT}
            aria-describedby={[
              'report-edit-notes-help',
              'report-edit-notes-count',
              notesRefusal && 'report-edit-notes-error',
            ]
              .filter(Boolean)
              .join(' ')}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
          {notesRefusal && (
            <p className="report-edit-error" id="report-edit-notes-error" role="alert">
              {notesRefusal}
            </p>
          )}
        </div>

        {original.document.blocks ? (
          <BlockEditors
            blocks={original.document.blocks}
            draft={draft}
            calls={original.calls}
            setBlock={setBlock}
            focusLater={(item, id, action) => {
              focusNext.current = { item, id, action };
            }}
            announce={setStatus}
          />
        ) : (
          original.document.tabs.map((tab, t) => (
            <fieldset key={t} className="report-edit-tab">
              <legend>
                {tab.title} <span className="report-tab-count">{tab.items.length}</span>
              </legend>
              {tab.items.map((item, i) => (
                <ItemEditor
                  key={i}
                  item={item}
                  state={draft.items[t][i]}
                  calls={original.calls}
                  onChange={setItem(t, i)}
                  itemKey={`${t}:${i}`}
                  focusLater={(id, action) => {
                    focusNext.current = { item: `${t}:${i}`, id, action };
                  }}
                  announce={setStatus}
                />
              ))}
            </fieldset>
          ))
        )}
      </fieldset>

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>

      <div className="report-edit-actions">
        {formRefusal && (
          <p className="report-edit-error" role="alert">
            {formRefusal}
          </p>
        )}
        <div className="report-edit-buttons">
          <button
            type="button"
            className="report-handle-cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="report-listing-button"
            disabled={saving || !draft.title.trim()}
          >
            {saving ? 'Saving…' : 'Save edits'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReportEditor;
