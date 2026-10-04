import { useEffect, useMemo, useState } from 'react';
import {
  BacktestSampleProvider,
  LabSeasonValueProvider,
  countAppearances,
  describeBacktestSeason,
  describeFallback,
  describeSeasonGames,
  isPastSeason,
  previousSeason,
  publishedSeasonOf,
  useReportLabSeason,
} from './backtestSample';
import TargetRecord, { TargetGameRows } from './TargetRecord';
import { describeDraft } from './TargetForm';
import StatPicker from './StatPicker';
import { useSeasonMinutes, useTargetPreview } from './useTargets';
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
  const { status, preview, error, unavailable, pending, retry } = useTargetPreview(
    valid ? (season ? { ...request, season } : request) : null,
    { immediateInitial: immediateInitialPreview },
  );
  // The published season comes from the latest answer as it lands: a
  // refusal's details, a preview, or the opponent's roster. Starting the next
  // read answers nothing, so the evidence still on screen never takes it back.
  // A first read refused without details leaves the roster read, whose answer
  // or refusal names it too, so the reader can still pick a season.
  const roster = useSeasonMinutes(
    valid && !published && status === 'error' && !unavailable ? draft.opponent : null,
  );
  const rosterPublished = roster.unavailable?.publishedSeason ?? publishedSeasonOf(roster);
  useEffect(() => {
    const answered = publishedSeasonOf(preview);
    if (answered) setPublished(answered);
  }, [preview]);
  useEffect(() => {
    if (unavailable?.publishedSeason) setPublished(unavailable.publishedSeason);
  }, [unavailable]);
  useEffect(() => {
    if (rosterPublished) setPublished(rosterPublished);
  }, [rosterPublished]);
  const fallback = describeFallback(preview);
  const seasonGames = describeSeasonGames(preview, published);
  // The season the evidence is for, or is about to be for: what the form's
  // season-bound controls follow.
  const shownSeason = season ?? preview?.season ?? null;
  const pastSeason = isPastSeason(shownSeason, published);
  const labSeason = useMemo(
    () => ({ season: shownSeason, requested: season, pastSeason }),
    [shownSeason, season, pastSeason],
  );
  const reportLabSeason = useReportLabSeason();
  useEffect(() => {
    if (!reportLabSeason) return undefined;
    reportLabSeason(labSeason);
    return () => reportLabSeason(null);
  }, [reportLabSeason, labSeason]);
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
          <SeasonToggle published={published} shown={shownSeason} onChange={setSeason} />
        )}
        {workbench && preview && (
          <StatPicker columns={columns} gradedBy={gradedBy} onChange={changePreferences} />
        )}
      </div>
      {fallback && <p className="target-lab-season-note">{fallback}</p>}
      {seasonGames && <p className="target-lab-season-games">{seasonGames}</p>}
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
          <LabSeasonValueProvider value={labSeason}>{children}</LabSeasonValueProvider>
        </BacktestSampleProvider>
        {!workbench && evidence}
      </div>
      {games}
    </section>
  );
}
