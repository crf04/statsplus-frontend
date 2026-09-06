/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * K — Players. The criteria at the top as on the worksheet; beneath, the
 * evidence grouped by player rather than by date. One row per qualifying
 * player who has faced the opponent, ranked by margin, each with a graded
 * strip of their own games; a row opens to list those games.
 */
import { useMemo, useState } from 'react';
import { useShownStats } from './box';
import { Link } from 'react-router-dom';
import { SummaryLine, gradeOf, gradeScale } from './lab';
import { monthDay, percent, signedDelta, summarise, toneOf } from './history';
import { CriteriaForm, DetailHead, EditorActions, useTargetEditor } from './detailShared';

export const NAME = 'Players';

function PlayerRow({ row, column, scale, open, onToggle }) {
  const { player } = row;
  return (
    <li className={`pt-k-row${open ? ' is-open' : ''}`}>
      <button type="button" className="pt-k-player" aria-expanded={open} onClick={onToggle}>
        <span className="pt-k-who">
          <b>{player.name}</b>
          <small>
            {player.tricode} · season {player.seasonAverages[column].toFixed(1)} {column}
          </small>
        </span>
        <span className="pt-k-strip">
          {row.lines.map((line) => (
            <i
              key={line.date}
              className={gradeOf(line.delta, scale)}
              title={`${monthDay(line.date)} · ${line.value} ${column} (${signedDelta(line.delta)})`}
            />
          ))}
        </span>
        <span className="pt-k-rec">
          {row.hits}/{row.games}
        </span>
        <span className={`pt-k-mean is-${toneOf(row.mean)}`}>{signedDelta(row.mean)}</span>
        <span className="pt-k-caret" aria-hidden="true">
          {open ? '–' : '+'}
        </span>
      </button>
      {open && (
        <ol className="pt-k-games">
          {[...row.lines].reverse().map((line) => (
            <li key={line.date}>
              <i className={gradeOf(line.delta, scale)} aria-hidden="true" />
              <span className="pt-lab-g-date">{monthDay(line.date)}</span>
              <span className="pt-lab-g-line">
                <b>{line.value}</b> {column}
              </span>
              <span className={`pt-lab-g-delta is-${toneOf(line.delta)}`}>
                {signedDelta(line.delta)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export default function VariantK({ item, read, listPath }) {
  const { target, entry } = item;
  const state = useTargetEditor(target, read, listPath);
  const { lab } = state;
  const stats = useShownStats(lab.backtest, target.id);
  const { backtest, column } = stats;
  const [openId, setOpenId] = useState(null);
  const record = useMemo(
    () =>
      backtest
        ? summarise({
            ...backtest,
            statColumns: [column, ...backtest.statColumns.filter((name) => name !== column)],
          })
        : null,
    [backtest, column],
  );
  const scale = record ? gradeScale(record.games, column) : 1;

  return (
    <main className="slate-page targets-page pt-k">
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
      <section
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
            {record.leaderboard.length === 0 ? (
              <p className="target-empty">Nobody qualifying has faced {target.opponent} yet.</p>
            ) : (
              <>
                <div className="pt-k-head" aria-hidden="true">
                  <span>Player · by margin on {column}</span>
                  <span>Games, oldest → newest</span>
                  <span>Hit</span>
                  <span>Margin</span>
                  <span />
                </div>
                <ul className="pt-k-list">
                  {record.leaderboard.map((row) => (
                    <PlayerRow
                      key={row.player.canonicalId}
                      row={row}
                      column={column}
                      scale={scale}
                      open={openId === row.player.canonicalId}
                      onToggle={() =>
                        setOpenId(openId === row.player.canonicalId ? null : row.player.canonicalId)
                      }
                    />
                  ))}
                </ul>
                <p className="pt-lab-line">
                  {record.leaderboard.length} players · {percent(record.columns[0].rate)} of games
                  over their own {column}
                </p>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
