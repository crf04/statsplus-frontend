/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The Lab as evidence beneath criteria: the Backtest of whatever Draft Target
 * is in hand, laid out as a graded grid of every game (greener the more a
 * player beat their own average, redder the more they fell short) and the
 * same games in date order. Both variants of round three render this; they
 * differ in where the criteria sit around it.
 */
import { useMemo, useState } from 'react';
import { describeDraft, targetDraftToRequest } from '../../targets/TargetForm';
import { decodePreview } from '../../targets/targetsApi';
import { useTargetPreview } from '../../targets/useTargets';
import { PROTO_STANDALONE } from './prototypeMode';
import { monthDay, signedDelta, summarise, toneOf } from './history';
import previewSample from './mock/preview-sample.json';

/* What a Target is evaluated by. The note is never part of the evidence. */
export const criteriaKey = (request) =>
  request
    ? JSON.stringify({
        opponent: request.opponent,
        qualifiers: request.qualifiers.map((qualifier) => [
          qualifier.base,
          qualifier.sliceKey,
          qualifier.comparator,
          qualifier.threshold,
        ]),
      })
    : null;

export const savedKey = (target) => criteriaKey(targetDraftToRequest(targetToRequestDraft(target)));

const targetToRequestDraft = (target) => ({
  opponent: target.opponent,
  qualifiers: target.qualifiers.map((qualifier) => ({
    ...qualifier,
    thresholdPercent: String(Math.round(qualifier.threshold * 1000) / 10),
  })),
  note: target.note || '',
});

let sample = null;
const readSample = () => {
  if (!sample) sample = decodePreview(previewSample);
  return sample;
};

/*
 * Standalone: the deployed prototype cannot re-read the season, so an edited
 * draft is answered with one captured preview and says so.
 */
const useMockPreview = (request) => {
  const key = criteriaKey(request);
  return {
    status: key ? 'ready' : 'idle',
    preview: key ? readSample() : null,
    error: null,
    pending: false,
    sample: Boolean(key),
  };
};

const useLivePreview = (request) => ({ ...useTargetPreview(request), sample: false });

const usePreview = PROTO_STANDALONE ? useMockPreview : useLivePreview;

/*
 * The evidence for a draft. When the draft is exactly the saved Target, the
 * saved Backtest answers it and no preview is read; the moment the criteria
 * move, the preview does, and what was last shown stays dimmed until the
 * answer lands.
 */
export const useLab = (draft, saved, savedRead) => {
  const { valid, request, problem } = describeDraft(draft);
  const key = valid ? criteriaKey(request) : null;
  const unchanged = saved ? key === savedKey(saved) : false;
  const preview = usePreview(valid && !unchanged ? request : null);
  if (unchanged) {
    return {
      valid,
      problem,
      dirty: false,
      status: savedRead?.status || 'loading',
      backtest: savedRead?.status === 'ready' ? savedRead.backtest : null,
      stale: false,
      sample: false,
      line:
        savedRead?.status === 'ready'
          ? 'Backtest · season to date · as saved'
          : savedRead?.status === 'error'
            ? 'The season did not read.'
            : 'Reading the season…',
    };
  }
  const stale = preview.pending || preview.status !== 'ready';
  let line;
  if (!valid) line = problem;
  else if (preview.sample)
    line = 'Sample evidence · the deployed prototype cannot re-read the season';
  else if (preview.status === 'loading') line = 'Reading the season for this draft…';
  else if (preview.status === 'error') line = preview.error || 'Backtest not updated.';
  else if (preview.pending) line = 'Draft changed · reading shortly…';
  else line = 'Backtest · season to date · for this draft';
  return {
    valid,
    problem,
    dirty: Boolean(saved) && valid,
    status: preview.status,
    backtest: preview.preview || (savedRead?.status === 'ready' ? savedRead.backtest : null),
    stale,
    sample: preview.sample,
    line,
  };
};

/* --- grading --- */

/*
 * How far a game sits from the player's own average, graded on this record's
 * own scale: the 90th percentile of the absolute margins is "by a lot", and
 * everything grades against it in four steps either side of zero.
 */
export const gradeScale = (games, column) => {
  const margins = games.map((game) => Math.abs(game.delta[column])).sort((a, b) => a - b);
  if (margins.length === 0) return 1;
  return Math.max(1, margins[Math.min(margins.length - 1, Math.floor(margins.length * 0.9))]);
};

export const gradeOf = (delta, scale) => {
  if (delta === 0) return 'g-push';
  const level = Math.min(4, Math.max(1, Math.ceil((Math.abs(delta) / scale) * 4)));
  return `g-${toneOf(delta)}-${level}`;
};

export function GradeKey({ column }) {
  return (
    <p className="pt-grade-key" aria-hidden="true">
      <span>short by more</span>
      <i className="g-miss-4" />
      <i className="g-miss-3" />
      <i className="g-miss-2" />
      <i className="g-miss-1" />
      <i className="g-push" />
      <i className="g-hit-1" />
      <i className="g-hit-2" />
      <i className="g-hit-3" />
      <i className="g-hit-4" />
      <span>beat by more</span>
      <small>{column} vs the player&apos;s own season average</small>
    </p>
  );
}

export function GradedGrid({ record, column }) {
  const scale = gradeScale(record.games, column);
  return (
    <div
      className="pt-grid"
      aria-label={`${record.games.length} games, oldest to newest, graded by margin`}
    >
      {record.games.map((game, index) => (
        <i
          key={`${game.player.canonicalId}-${game.date}-${index}`}
          className={gradeOf(game.delta[column], scale)}
          title={`${monthDay(game.date)} · ${game.player.name} ${game.stats[column]} ${column} (${signedDelta(game.delta[column])} vs season)`}
        />
      ))}
    </div>
  );
}

export function SummaryLine({ backtest, column, onColumn }) {
  const { summary, statColumns } = backtest;
  return (
    <div className="pt-lab-summary">
      <span>
        <b>{summary.players}</b> <small>players</small>
      </span>
      <span>
        <b>{summary.games}</b> <small>games</small>
      </span>
      {statColumns.map((name) => {
        const { meanDifference, overAverageShare } = summary.columns[name];
        const mean = meanDifference === null ? null : Math.round(meanDifference * 10) / 10;
        const active = name === column;
        return (
          <button
            type="button"
            key={name}
            className={`pt-lab-col${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onColumn(name)}
          >
            <small>{name}</small>
            <b className={mean === null ? '' : `is-${toneOf(mean)}`}>
              {overAverageShare === null ? '—' : `${Math.round(overAverageShare * 100)}%`}
            </b>
            <small>{mean === null ? '' : `${signedDelta(mean)} avg`}</small>
          </button>
        );
      })}
    </div>
  );
}

const SHOWN = 12;

export function GameList({ record, column }) {
  const [all, setAll] = useState(false);
  const scale = gradeScale(record.games, column);
  const games = [...record.games].reverse();
  const shown = all ? games : games.slice(0, SHOWN);
  const others = record.columns.map((entry) => entry.column).filter((name) => name !== column);
  return (
    <div className="pt-lab-games">
      <ol>
        {shown.map((game, index) => (
          <li key={`${game.player.canonicalId}-${game.date}-${index}`}>
            <i className={gradeOf(game.delta[column], scale)} aria-hidden="true" />
            <span className="pt-lab-g-date">{monthDay(game.date)}</span>
            <span className="pt-lab-g-who">
              <b>{game.player.name}</b> <small>{game.player.tricode}</small>
            </span>
            <span className="pt-lab-g-line">
              <b>{game.stats[column]}</b> {column}
              <small> vs {game.player.seasonAverages[column].toFixed(1)}</small>
            </span>
            <span className={`pt-lab-g-delta is-${toneOf(game.delta[column])}`}>
              {signedDelta(game.delta[column])}
            </span>
            <span className="pt-lab-g-rest">
              {others.map((name) => (
                <span key={name}>
                  {name} {game.stats[name]}{' '}
                  <em className={`is-${toneOf(game.delta[name])}`}>
                    {signedDelta(game.delta[name])}
                  </em>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
      {games.length > SHOWN && (
        <button type="button" className="pt-lab-more" onClick={() => setAll(!all)}>
          {all ? `Latest ${SHOWN} only` : `All ${games.length} games`}
        </button>
      )}
    </div>
  );
}

/*
 * The whole of the Lab beneath one set of criteria: the status line, the
 * summary with the stat column to grade by, the graded grid, the games.
 */
export function LabEvidence({ lab }) {
  const [chosen, setChosen] = useState(null);
  const { backtest } = lab;
  const record = useMemo(() => (backtest ? summarise(backtest) : null), [backtest]);
  if (!backtest || !record) {
    return <p className="pt-lab-line">{lab.line}</p>;
  }
  const column = backtest.statColumns.includes(chosen) ? chosen : backtest.statColumns[0];
  return (
    <div className={`pt-lab${lab.stale ? ' is-stale' : ''}`} aria-busy={lab.status === 'loading'}>
      <p className="pt-lab-line">{lab.line}</p>
      <SummaryLine backtest={backtest} column={column} onColumn={setChosen} />
      {record.games.length === 0 ? (
        <p className="target-empty">Nobody qualifying has faced {backtest.target.opponent} yet.</p>
      ) : (
        <>
          <GradedGrid record={record} column={column} />
          <GradeKey column={column} />
          <GameList record={record} column={column} />
        </>
      )}
    </div>
  );
}
