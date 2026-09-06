/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * G — Sheet. The page is the criteria. Every Target is a section whose header
 * is its Qualifiers, editable in place; the Lab is the evidence beneath each
 * one and re-reads the moment the criteria move. A new Target is the same
 * section, empty, at the top. Nothing about today is on this page.
 */
import { useState } from 'react';
import { deriveTargetTitle } from '../../targets/targetCatalog';
import { LabEvidence, useLab } from './lab';
import { OpponentSelect, ProtoLink, QualifierFields, useDraft } from './shared';

export const NAME = 'Sheet';

function Criteria({ editor, locked = false }) {
  const { draft, patch, patchQualifier, addQualifier, removeQualifier } = editor;
  return (
    <div className="pt-g-criteria">
      {locked ? (
        <span className="pt-g-opp">{draft.opponent}</span>
      ) : (
        <OpponentSelect big value={draft.opponent} onChange={(opponent) => patch({ opponent })} />
      )}
      <div className="pt-g-quals">
        <span className="target-label">A player must meet every one</span>
        {draft.qualifiers.map((qualifier, index) => (
          <QualifierFields
            key={index}
            qualifier={qualifier}
            index={index}
            onPatch={(fields) => patchQualifier(index, fields)}
            onRemove={draft.qualifiers.length > 1 ? () => removeQualifier(index) : null}
          />
        ))}
        <button type="button" className="pt-add" onClick={addQualifier}>
          + and
        </button>
      </div>
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

function TargetSection({ item, read }) {
  const { target } = item;
  const editor = useDraft(target);
  const [savedAs, setSavedAs] = useState(target);
  const lab = useLab(editor.draft, savedAs, read);
  const [note, setNote] = useState(null);
  const save = () => {
    // Stub: the edit is kept for this session only.
    setSavedAs({ ...savedAs, ...editor.request, title: deriveTargetTitle(editor.request) });
    setNote('Saved for this session only · nothing was sent to the backend');
  };
  return (
    <section className={`pt-g-section${lab.dirty ? ' is-dirty' : ''}`}>
      <header className="pt-g-head">
        <Criteria editor={editor} locked />
        <div className="pt-g-actions">
          {lab.dirty ? (
            <>
              <button type="button" className="target-primary" disabled={!lab.valid} onClick={save}>
                Save changes
              </button>
              <button type="button" className="target-ghost" onClick={() => editor.reset(savedAs)}>
                Revert
              </button>
            </>
          ) : (
            !target.local && <ProtoLink to={`/targets/${target.id}`}>Open →</ProtoLink>
          )}
          {note && !lab.dirty && <small>{note}</small>}
        </div>
      </header>
      <LabEvidence lab={lab} />
    </section>
  );
}

function DraftSection({ onSave }) {
  const [open, setOpen] = useState(false);
  const editor = useDraft();
  const lab = useLab(editor.draft, null, null);
  if (!open) {
    return (
      <button type="button" className="pt-g-new" onClick={() => setOpen(true)}>
        <b>+</b> New Target <small>the criteria first, the season beneath them as you type</small>
      </button>
    );
  }
  return (
    <section className="pt-g-section is-draft">
      <p className="eyebrow">Draft Target</p>
      <header className="pt-g-head">
        <Criteria editor={editor} />
        <div className="pt-g-actions">
          <button
            type="button"
            className="target-primary"
            disabled={!editor.valid}
            onClick={() => {
              onSave(editor.request);
              editor.reset();
              setOpen(false);
            }}
          >
            Save Target
          </button>
          <button type="button" className="target-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </header>
      {editor.valid ? <LabEvidence lab={lab} /> : <p className="pt-lab-line">{editor.problem}</p>}
    </section>
  );
}

export default function VariantG({ data }) {
  const { list, items, backtests, saveLocally } = data;
  return (
    <main className="slate-page targets-page pt-g">
      <header className="pt-g-page-head">
        <p className="eyebrow">Targets</p>
        <h1>
          {list.status === 'ready'
            ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
            : 'Targets'}
        </h1>
        <p className="pt-g-sub">
          The criteria, and what the season says about each. Edit a threshold and the season
          re-reads beneath it.
        </p>
      </header>

      <DraftSection onSave={saveLocally} />

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}
      {items.map((item) => (
        <TargetSection key={item.target.id} item={item} read={backtests[String(item.target.id)]} />
      ))}
    </main>
  );
}
