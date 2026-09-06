/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * I — Worksheet. One column, top to bottom: the criteria, always editable
 * (there is no Edit button: this page is where editing happens), the actions
 * pinned while anything is unsaved, then the Lab in full — summary, graded
 * grid, and every game in date order.
 */
import { Link } from 'react-router-dom';
import { LabEvidence } from './lab';
import { CriteriaForm, DetailHead, EditorActions, useTargetEditor } from './detailShared';

export const NAME = 'Worksheet';

export default function VariantI({ item, read, listPath }) {
  const { target, entry } = item;
  const state = useTargetEditor(target, read, listPath);
  return (
    <main className="slate-page targets-page pt-i">
      <p className="target-back">
        <Link to={listPath}>← All Targets</Link>
      </p>
      <DetailHead target={target} entry={entry} />
      <section className="pt-i-criteria">
        <CriteriaForm editor={state.editor} />
      </section>
      <div className="pt-i-actions">
        <EditorActions state={state} />
      </div>
      <section className="pt-i-lab">
        <LabEvidence lab={state.lab} boxId={target.id} />
      </section>
    </main>
  );
}
