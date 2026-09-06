/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * J — Workbench. Two columns. The left one stays put: the criteria as form
 * controls (Chris's pick over the sentence), the actions, the summary and the
 * graded grid.
 * The right one is the games, newest first, as long as they run. Tune on the
 * left, watch the right answer.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GameList, GradeKey, GradedGrid, SummaryLine } from './lab';
import { summarise } from './history';
import { useShownStats } from './box';
import { CriteriaForm, DetailHead, EditorActions, useTargetEditor } from './detailShared';

export const NAME = 'Workbench';

export default function VariantJ({ item, read, listPath }) {
  const { target, entry } = item;
  const state = useTargetEditor(target, read, listPath);
  const { lab } = state;
  const stats = useShownStats(lab.backtest, target.id);
  const { backtest, column } = stats;
  const record = useMemo(() => (backtest ? summarise(backtest) : null), [backtest]);

  return (
    <main className="slate-page targets-page pt-j">
      <aside className="pt-j-bench">
        <p className="target-back">
          <Link to={listPath}>← All Targets</Link>
        </p>
        <DetailHead target={target} entry={entry} />
        {/* The card is the criteria and its actions; the title it derives is
            the card's own reading, so it is not repeated beneath it. */}
        <section className="pt-i-criteria pt-j-criteria">
          <CriteriaForm editor={state.editor} />
          <EditorActions state={state} compact title={false} />
        </section>
        <div
          className={`pt-lab${lab.stale ? ' is-stale' : ''}`}
          aria-busy={lab.status === 'loading'}
        >
          <p className="pt-lab-line">{lab.line}</p>
          {backtest && record && (
            <>
              <SummaryLine
                backtest={backtest}
                column={column}
                onColumn={stats.setColumn}
                stats={stats}
              />
              {record.games.length > 0 && (
                <>
                  <GradedGrid record={record} column={column} />
                  <GradeKey column={column} />
                </>
              )}
            </>
          )}
        </div>
      </aside>
      <section className={`pt-j-games${lab.stale ? ' is-stale' : ''}`}>
        <h2 className="pt-e-section-head">
          <span>Games</span>
          <small>
            {record ? `${record.games.length} · newest first · graded on ${column}` : '…'}
          </small>
        </h2>
        {record && record.games.length > 0 ? (
          <GameList record={record} column={column} />
        ) : (
          <p className="target-empty">
            {record ? `Nobody qualifying has faced ${target.opponent} yet.` : lab.line}
          </p>
        )}
      </section>
    </main>
  );
}
