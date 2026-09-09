import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import TargetForm, { targetToDraft, targetDraftToRequest } from './TargetForm';
import TargetLab from './TargetLab';
import useStatPreferences from './useStatPreferences';
import { StatSaveStatus } from './StatPicker';
import { deleteTarget, updateTarget } from './targetsApi';
import TargetsSignedOut from './TargetsSignedOut';
import {
  contextPrototypeVariantFor,
  TargetContextEditor,
  TargetContextPageSwitcher,
} from './TargetContextPrototype';
import { SeasonMinutesProvider, useTargets } from './useTargets';
import '../SlatePage.css';
import './TargetsPage.css';
import './TargetWorkbench.css';

function TargetDetail({ target, reload, prototypeVariant }) {
  const navigate = useNavigate();
  const stats = useStatPreferences(target);
  const [draft, setDraft] = useState(() => targetToDraft(target));
  const [saved, setSaved] = useState(() => targetToDraft(target));
  const [prototypePreferences, setPrototypePreferences] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const dirty =
    JSON.stringify(targetDraftToRequest(draft)) !== JSON.stringify(targetDraftToRequest(saved));
  const save = async (request) => {
    if (prototypeVariant) {
      const nextDraft = targetToDraft({
        ...target,
        qualifiers: request.qualifiers,
        note: request.note,
        ...(request.conditions !== undefined ? { conditions: request.conditions } : {}),
      });
      setDraft(nextDraft);
      setSaved(nextDraft);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateTarget({
        id: target.id,
        qualifiers: request.qualifiers,
        note: request.note,
        ...(request.conditions !== undefined ? { conditions: request.conditions } : {}),
      });
      setSaved(draft);
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
      <div className="target-workbench-top">
        <Link to="/targets">← All Targets</Link>
        <div className="target-detail-actions">
          {prototypeVariant ? (
            <span className="target-context-read-only-badge">
              Read-only prototype · saves stay in this session
            </span>
          ) : confirmingDelete ? (
            <>
              <span>Delete this Target?</span>
              <button type="button" disabled={busy} onClick={remove}>
                Yes, delete
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="target-error" role="alert">
          {error}
        </p>
      )}
      {prototypeVariant ? (
        <TargetContextEditor
          variant={prototypeVariant}
          draft={draft}
          title={prototypeVariant ? undefined : dirty ? undefined : target.title}
          busy={busy}
          submitLabel="Save changes"
          showActions={dirty}
          cancelLabel="Revert"
          lockOpponent
          preferences={prototypePreferences ?? stats.preferences}
          onPreferencesChange={setPrototypePreferences}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onSubmit={save}
          onCancel={() => setDraft(saved)}
        />
      ) : (
        <div className="target-workbench">
          <TargetLab
            draft={draft}
            workbench
            immediateInitialPreview
            preferences={stats.preferences}
            onPreferencesChange={stats.onChange}
          >
            <StatSaveStatus state={stats} />
            <TargetForm
              draft={draft}
              title={dirty ? undefined : target.title}
              busy={busy}
              lockOpponent
              submitLabel="Save changes"
              showActions={dirty}
              cancelLabel="Revert"
              onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              onSubmit={save}
              onCancel={() => setDraft(saved)}
            />
          </TargetLab>
        </div>
      )}
    </>
  );
}
function TargetDetailContent() {
  const { targetId } = useParams();
  const [searchParams] = useSearchParams();
  const prototypeVariant = contextPrototypeVariantFor(searchParams);
  const { authLoading, isAuthenticated, status, targets, error, reload } = useTargets({
    keepPrevious: true,
  });
  if (!authLoading && !isAuthenticated) return <TargetsSignedOut />;
  const target = targets.find((item) => String(item.id) === targetId);
  return (
    <main className="slate-page targets-page">
      {status === 'loading' && <p role="status">Loading this Target…</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {(target || status === 'ready') &&
        (target ? (
          <TargetDetail
            key={target.id}
            target={target}
            reload={reload}
            prototypeVariant={prototypeVariant}
          />
        ) : (
          <div className="empty-slate">
            <Link to="/targets">← All Targets</Link>
            <h2>That Target is gone.</h2>
            <p>It was deleted, or it belongs to another account.</p>
          </div>
        ))}
      {prototypeVariant && target && <TargetContextPageSwitcher current={prototypeVariant} />}
    </main>
  );
}

export default function TargetDetailPage() {
  const { targetId } = useParams();
  return (
    <SeasonMinutesProvider resetKey={targetId}>
      <TargetDetailContent />
    </SeasonMinutesProvider>
  );
}
