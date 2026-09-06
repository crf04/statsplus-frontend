/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * What the three looks for one Target's own page share: the editor state
 * (draft, dirty, save, revert, delete, all stubs), the criteria form, and
 * the head with the date it was set and whether the opponent plays today.
 * Layout stays in the variants.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deriveTargetTitle } from '../../targets/targetCatalog';
import { useLab } from './lab';
import { AddMenu, OpponentSelect, QualifierFields, TodayIndicator, useDraft } from './shared';
import { ConditionsEditor } from './conditions';

export const formatSet = (createdAt) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(createdAt));

/*
 * The whole of editing one Target, as stubs: the draft starts as the saved
 * Target, the Lab reads it as it moves, Save keeps the edit for the session,
 * Revert puts the saved one back, Delete asks first and then leaves.
 */
export const useTargetEditor = (target, read, listPath) => {
  const navigate = useNavigate();
  const editor = useDraft(target);
  const [savedAs, setSavedAs] = useState(target);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState(null);
  const lab = useLab(editor.draft, savedAs, read);
  const save = () => {
    setSavedAs({
      ...savedAs,
      ...editor.request,
      conditions: editor.draft.conditions,
      title: deriveTargetTitle(editor.request),
    });
    setNote('Saved for this session only · nothing was sent to the backend');
  };
  const revert = () => editor.reset(savedAs);
  const remove = () => navigate(listPath);
  return {
    editor,
    lab,
    savedAs,
    dirty: lab.dirty,
    title: editor.valid ? deriveTargetTitle(editor.request) : savedAs.title,
    note,
    save,
    revert,
    confirming,
    askDelete: () => setConfirming(true),
    keep: () => setConfirming(false),
    remove,
  };
};

/* The criteria as form controls, the opponent fixed: a Target's opponent is
   what it is about, so changing it is a different Target. */
export function CriteriaForm({ editor, opponentLocked = true }) {
  const { draft, patch, patchQualifier, addQualifier, removeQualifier } = editor;
  return (
    <div className="pt-g-criteria">
      {opponentLocked ? (
        <span className="pt-g-opp">{draft.opponent}</span>
      ) : (
        <OpponentSelect big value={draft.opponent} onChange={(opponent) => patch({ opponent })} />
      )}
      <div className="pt-g-quals">
        {draft.qualifiers.map((qualifier, index) => (
          <QualifierFields
            key={index}
            qualifier={qualifier}
            index={index}
            onPatch={(fields) => patchQualifier(index, fields)}
            onRemove={draft.qualifiers.length > 1 ? () => removeQualifier(index) : null}
          />
        ))}
      </div>
      <ConditionsEditor
        opponent={draft.opponent}
        conditions={draft.conditions}
        onChange={editor.patchConditions}
        addSlot={(adders) => <AddMenu onQualifier={addQualifier} conditions={adders} />}
      />
      <label className="pt-g-note">
        <span className="target-label">Why</span>
        <input
          value={draft.note}
          placeholder="optional, never the title"
          maxLength={280}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </label>
    </div>
  );
}

/* Delete, asking first. Lives wherever the layout puts it. */
export function DeleteAction({ state }) {
  const { note, confirming, askDelete, keep, remove } = state;
  return (
    <span className="pt-d-delete">
      {confirming ? (
        <>
          <span className="target-confirm">Delete this Target?</span>
          <button type="button" className="target-ghost is-danger" onClick={remove}>
            Yes, delete
          </button>
          <button type="button" className="target-ghost" onClick={keep}>
            Keep it
          </button>
        </>
      ) : (
        <>
          {note && <small>{note}</small>}
          <button type="button" className="target-ghost" onClick={askDelete}>
            Delete
          </button>
        </>
      )}
    </span>
  );
}

/* Save and Revert, only while the draft has moved; Delete too unless the
   layout has put it elsewhere. */
export function EditorActions({ state, compact = false, title: showTitle = true, del = true }) {
  const { editor, dirty, title, save, revert } = state;
  if (!dirty && !del && editor.valid) return null;
  return (
    <div className={`pt-d-actions${compact ? ' is-compact' : ''}${dirty ? ' is-dirty' : ''}`}>
      {showTitle ? (
        <span className={`pt-d-actions-title${editor.valid ? '' : ' is-pending'}`}>
          {editor.valid ? title : editor.problem}
        </span>
      ) : (
        !editor.valid && <span className="pt-d-actions-title is-pending">{editor.problem}</span>
      )}
      <span className="pt-d-actions-buttons">
        {dirty && (
          <>
            <button
              type="button"
              className="target-primary"
              disabled={!editor.valid}
              onClick={save}
            >
              Save changes
            </button>
            <button type="button" className="target-ghost" onClick={revert}>
              Revert
            </button>
          </>
        )}
        {del && <DeleteAction state={state} />}
      </span>
    </div>
  );
}

export function DetailHead({ target, entry, eyebrow = 'Target' }) {
  return (
    <div className="pt-d-head">
      <p className="eyebrow">
        {eyebrow} · set {formatSet(target.createdAt)}
      </p>
      <TodayIndicator entry={entry} />
    </div>
  );
}
