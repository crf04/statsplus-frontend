import { useState } from 'react';
import {
  BacktestSampleProvider,
  countAppearances,
  describeBacktestSeason,
  describeFallback,
  previousSeason,
  publishedSeasonOf,
} from './backtestSample';
import TargetRecord, { TargetGameRows } from './TargetRecord';
import { describeDraft } from './TargetForm';
import StatPicker from './StatPicker';
import { useTargetPreview } from './useTargets';
import './TargetFits.css';

/*
 * One line that always says where the Lab stands, so a reader who cannot see
 * the results dim hears the draft change, the read begin, and the answer land.
 * A half-typed draft is not a Target to evaluate, so it is not sent, and the
 * line says what would make it one.
 */
const describeLab = ({ valid, status, pending }) => {
  if (!valid) return 'Complete the Qualifiers to see the Backtest.';
  if (status === 'loading') return 'Reading the season…';
  // A refusal is the answer to the draft in hand, so it outranks the draft
  // having moved on; the next read replaces both.
  if (status === 'error') return 'Backtest not updated.';
  if (pending) return 'Draft changed · reading shortly…';
  if (status === 'ready') return 'Backtest up to date.';
  return '';
};

/*
 * The two seasons a Backtest can read. Which one is published is only known
 * once the backend has answered a read that named no season, so until then
 * there is nothing to choose between.
 */
function SeasonToggle({ published, shown, onChange }) {
  return (
    <div className="target-season-toggle" role="group" aria-label="Backtest season">
      {[published, previousSeason(published)].map((season) => (
        <button
          key={season}
          type="button"
          aria-pressed={season === shown}
          onClick={() => season !== shown && onChange(season)}
        >
          {season}
        </button>
      ))}
    </div>
  );
}

/*
 * The Lab: the season-to-date Backtest of the Draft Target above it, read
 * live as the draft is composed. It is not a destination; wherever a draft is
 * edited, this is the evidence alongside the form. Nothing is stored until Save,
 * and Save is the form's own — the Lab never touches it, so a slow or refused
 * read never blocks saving.
 */
export default function TargetLab({
  draft,
  workbench = false,
  immediateInitialPreview = false,
  children,
  preferences,
  onPreferencesChange,
}) {
  const [localPreferences, setLocalPreferences] = useState(null);
  // Null until the reader picks one: the backend's default, fallback included.
  const [season, setSeason] = useState(null);
  const [published, setPublished] = useState(null);
  const { valid, request } = describeDraft(draft);
  const { status, preview, error, pending, retry } = useTargetPreview(
    valid ? (season ? { ...request, season } : request) : null,
    { immediateInitial: immediateInitialPreview },
  );
  const answeredPublished = publishedSeasonOf(preview);
  if (answeredPublished && answeredPublished !== published) setPublished(answeredPublished);
  const fallback = describeFallback(preview);
  // The result on screen describes the draft it was read for; the moment the
  // draft moves on, the result is stale, whether or not the read has begun.
  const stale = pending || status !== 'ready';
  const chosen = preferences ?? localPreferences;
  const columns = chosen?.columns ?? preview?.statColumns ?? [];
  const gradedBy = chosen?.gradedBy ?? columns[0];
  const changePreferences = onPreferencesChange ?? setLocalPreferences;

  const evidence = (
    <>
      <h2 id="target-lab-heading" className="target-section-heading visually-hidden">
        Lab · Backtest · {preview ? describeBacktestSeason(preview, published) : 'season to date'} ·
        vs {draft.opponent}
      </h2>
      <div className="target-lab-header">
        <p role="status" className="target-lab-status">
          {describeLab({ valid, status, pending })}
        </p>
        {published && (
          <SeasonToggle
            published={published}
            shown={season ?? preview?.season}
            onChange={setSeason}
          />
        )}
        {workbench && preview && (
          <StatPicker columns={columns} gradedBy={gradedBy} onChange={changePreferences} />
        )}
      </div>
      {fallback && <p className="target-lab-season-note">{fallback}</p>}
      {status === 'error' && (
        <p className="target-error" role="alert">
          {error}
          <button type="button" onClick={retry}>
            Retry backtest
          </button>
        </p>
      )}
      {preview && (
        /* What was last read stays on screen, dimmed, while the next answer is
           on its way: a keystroke never blanks the screen. */
        <div
          className={`target-lab-result${stale ? ' is-stale' : ''}`}
          aria-busy={status === 'loading'}
        >
          <TargetRecord
            backtest={preview}
            columns={columns}
            gradedBy={gradedBy}
            onGrade={(column) => changePreferences({ columns, gradedBy: column })}
            onPreferencesChange={workbench ? undefined : changePreferences}
          >
            {/* Season to date is the evidence; whether the idea is actionable
                tonight is one line, present only when the opponent plays. */}
            {preview.today && (
              <p className={`target-lab-tonight${preview.today.fitCount ? ' has-fits' : ''}`}>
                <b>{preview.today.fitCount}</b> fit tonight vs {preview.target.opponent}
              </p>
            )}
          </TargetRecord>
        </div>
      )}
    </>
  );
  const games = (
    <>
      {workbench && preview && (
        <div
          className={`target-lab-games${stale ? ' is-stale' : ''}`}
          aria-busy={status === 'loading'}
        >
          <TargetGameRows backtest={preview} columns={columns} gradedBy={gradedBy} />
        </div>
      )}
    </>
  );

  return (
    <section className="target-lab" aria-labelledby="target-lab-heading">
      {workbench && <div className="target-lab-overview">{evidence}</div>}
      <div className="target-lab-left">
        <BacktestSampleProvider value={{ appearances: countAppearances(preview), stale }}>
          {children}
        </BacktestSampleProvider>
        {!workbench && evidence}
      </div>
      {games}
    </section>
  );
}
