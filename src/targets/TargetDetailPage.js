import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatCalendarDate } from '../calendarDate';
import { getRequestErrorMessage } from '../gameLogsApi';
import TargetForm, { targetToDraft } from './TargetForm';
import { TargetContext, TargetFitTable } from './TargetFits';
import { findTargetBase, formatQualifier, targetBaseLabel } from './targetCatalog';
import { deleteTarget, updateTarget } from './targetsApi';
import TargetsSignedOut from './TargetsSignedOut';
import { useResolvedTargets } from './useResolvedTargets';
import '../SlatePage.css';
import './TargetsPage.css';

/*
 * A Target records the day an idea was had, so the date it was created is the
 * calendar date of that instant rather than a clock reading.
 */
const formatCreated = (createdAt) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(createdAt));

const formatTip = (scheduledAt) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(scheduledAt));

function FitsSection({ entry, slateDate }) {
  const { game, target } = entry;
  return (
    <section className="target-detail-section" aria-labelledby="fits-heading">
      <h2 id="fits-heading" className="target-section-heading">
        Fits · the opposing players who meet every Qualifier
      </h2>
      {game ? (
        <>
          <p className="target-game-chip">
            <Link to={`/matchups/${game.gameId}`}>
              {game.opposingTeam.tricode} vs {game.opponent.tricode}
            </Link>
            <small>{formatTip(game.scheduledAt)}</small>
            {game.status.state !== 'scheduled' && <em>{game.status.label}</em>}
          </p>
          <TargetFitTable entry={entry} />
        </>
      ) : (
        <p className="target-empty">
          {target.opponent} has no game on {formatCalendarDate(slateDate)}.
        </p>
      )}
    </section>
  );
}

function TargetDetail({ entry, slateDate, reload }) {
  const { target } = entry;
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async (request) => {
    setBusy(true);
    setError(null);
    try {
      await updateTarget({ id: target.id, qualifiers: request.qualifiers, note: request.note });
      setDraft(null);
      reload();
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, 'Unable to save this Target. Please try again.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTarget({ id: target.id });
      navigate('/targets');
    } catch (requestError) {
      setBusy(false);
      setConfirmingDelete(false);
      setError(
        getRequestErrorMessage(requestError, 'Unable to delete this Target. Please try again.'),
      );
    }
  };

  return (
    <>
      <header className="target-detail-head">
        <div className="target-detail-title">
          <p className="eyebrow">Target · set {formatCreated(target.createdAt)}</p>
          <h1>{target.title}</h1>
          {target.note && <p className="target-detail-note">{target.note}</p>}
        </div>
        {/* Deleting is not undoable, so it asks before it acts rather than
            removing a Target on the press that reached for it. */}
        <div className="target-detail-actions">
          {confirmingDelete ? (
            <>
              <span className="target-confirm">Delete this Target?</span>
              <button type="button" disabled={busy} onClick={remove}>
                Yes, delete
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Keep it
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => setDraft(targetToDraft(target))}>
                Edit
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <p className="target-error" role="alert">
          {error}
        </p>
      )}

      {draft ? (
        <TargetForm
          draft={draft}
          busy={busy}
          lockOpponent
          submitLabel="Save changes"
          onChange={(patch) => setDraft({ ...draft, ...patch })}
          onSubmit={save}
          onCancel={() => setDraft(null)}
        />
      ) : (
        <>
          <section className="target-detail-section" aria-labelledby="qualifiers-heading">
            <h2 id="qualifiers-heading" className="target-section-heading">
              Qualifiers · a player must meet every one
            </h2>
            <ul className="target-detail-qualifiers">
              {target.qualifiers.map((qualifier, index) => (
                <li key={index}>
                  <div className="target-detail-qualifier-head">
                    <span className="target-detail-base">{targetBaseLabel(qualifier.base)}</span>
                    <b>{formatQualifier(qualifier)}</b>
                    <em>{findTargetBase(qualifier.base)?.unit}</em>
                  </div>
                  {/* Context is index-parallel with the Qualifiers, and empty
                      when the opponent is idle: there is no game-scoped window
                      to read a defense from on a day with no game. */}
                  {entry.context[index] && <TargetContext context={entry.context[index]} />}
                </li>
              ))}
            </ul>
          </section>
          <FitsSection entry={entry} slateDate={slateDate} />
        </>
      )}
    </>
  );
}

export default function TargetDetailPage() {
  const { targetId } = useParams();
  /*
   * One read serves the whole page: a Target and the day it is being read
   * against arrive together, so the Qualifiers on screen and the readings
   * beside them can never describe different Targets.
   */
  const { authLoading, isAuthenticated, status, entries, slateDate, error, reload } =
    useResolvedTargets();

  if (!authLoading && !isAuthenticated) {
    return <TargetsSignedOut />;
  }

  const entry = entries.find((item) => String(item.target.id) === targetId);

  return (
    <main className="slate-page targets-page">
      <p className="target-back">
        <Link to="/targets">← All Targets</Link>
      </p>
      {status === 'loading' && <p role="status">Loading this Target…</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {status === 'ready' &&
        (entry ? (
          <TargetDetail entry={entry} slateDate={slateDate} reload={reload} />
        ) : (
          <div className="empty-slate">
            <h2>That Target is gone.</h2>
            <p>It was deleted, or it belongs to another account.</p>
          </div>
        ))}
    </main>
  );
}
