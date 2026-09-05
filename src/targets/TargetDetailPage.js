import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import TargetForm, { targetToDraft } from './TargetForm';
import { findTargetBase, formatQualifier, targetBaseLabel } from './targetCatalog';
import { deleteTarget, updateTarget } from './targetsApi';
import TargetsSignedOut from './TargetsSignedOut';
import { useTargets } from './useTargets';
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

function TargetDetail({ target, reload }) {
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
        <section className="target-detail-section" aria-labelledby="qualifiers-heading">
          <h2 id="qualifiers-heading" className="target-section-heading">
            Qualifiers · a player must meet every one
          </h2>
          <ul className="target-detail-qualifiers">
            {target.qualifiers.map((qualifier, index) => (
              <li key={index}>
                <span className="target-detail-base">{targetBaseLabel(qualifier.base)}</span>
                <b>{formatQualifier(qualifier)}</b>
                <em>{findTargetBase(qualifier.base)?.unit}</em>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function TargetDetailPage() {
  const { targetId } = useParams();
  const { authLoading, isAuthenticated, status, targets, error, reload } = useTargets();

  if (!authLoading && !isAuthenticated) {
    return <TargetsSignedOut />;
  }

  const target = targets.find((item) => String(item.id) === targetId);

  return (
    <main className="slate-page targets-page">
      <p className="target-back">
        <Link to="/targets">← All Targets</Link>
      </p>
      {status === 'loading' && <p role="status">Loading this Target…</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {status === 'ready' &&
        (target ? (
          <TargetDetail target={target} reload={reload} />
        ) : (
          <div className="empty-slate">
            <h2>That Target is gone.</h2>
            <p>It was deleted, or it belongs to another account.</p>
          </div>
        ))}
    </main>
  );
}
