import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import TargetForm, { blankTargetDraft } from './TargetForm';
import { comparatorSymbol, formatShare, targetSliceLabel } from './targetCatalog';
import { createTarget } from './targetsApi';
import { useTargets } from './useTargets';
import '../SlatePage.css';
import './TargetsPage.css';

/*
 * A card carries only what tells one Target from another: the opponent it is
 * about, the Qualifiers a player has to meet, and the note explaining why it
 * was set. Everything else lives on the Target's own route.
 */
function TargetCard({ target }) {
  return (
    <li>
      <Link
        className="target-card"
        to={`/targets/${target.id}`}
        aria-label={`Open ${target.title}`}
      >
        <span className="target-card-opponent">{target.opponent}</span>
        <span className="target-card-qualifiers">
          {target.qualifiers.map((qualifier, index) => (
            <span key={index}>
              {targetSliceLabel(qualifier.base, qualifier.sliceKey)}{' '}
              <b>
                {comparatorSymbol(qualifier.comparator)} {formatShare(qualifier.threshold)}
              </b>
            </span>
          ))}
        </span>
        <span className={`target-card-note${target.note ? '' : ' is-empty'}`}>
          {target.note || 'No note'}
        </span>
        <span className="target-card-go" aria-hidden="true">
          Open →
        </span>
      </Link>
    </li>
  );
}

export default function TargetsPage() {
  const { authLoading, isAuthenticated, status, targets, error, reload } = useTargets();
  const [draft, setDraft] = useState(blankTargetDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="slate-page signed-out-slate">
        <h1>Sign in to view your Targets</h1>
        <p>Use the sign-in control in the navigation to load the Targets saved to your account.</p>
      </main>
    );
  }

  /*
   * A refused save keeps the draft exactly as it was typed: a duplicate or a
   * full account is one edit away from a Target worth keeping, not a retype.
   */
  const save = async (request) => {
    setSaving(true);
    setSaveError(null);
    try {
      await createTarget(request);
      setDraft(blankTargetDraft());
      reload();
    } catch (requestError) {
      setSaveError(
        getRequestErrorMessage(requestError, 'Unable to save this Target. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="slate-page targets-page">
      <section className="slate-heading">
        <div className="slate-title">
          <p className="eyebrow">Targets</p>
          <h1>
            {status === 'ready'
              ? `${targets.length} ${targets.length === 1 ? 'Target' : 'Targets'}`
              : 'Targets'}
          </h1>
        </div>
      </section>
      <div className="slate-status">
        <span className="slate-count">one opponent and the Qualifiers a player must meet</span>
      </div>

      <section className="target-new" aria-labelledby="new-target-heading">
        <h2 id="new-target-heading" className="target-section-heading">
          New Target
        </h2>
        <TargetForm
          draft={draft}
          busy={saving}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
          onSubmit={save}
        />
        {saveError && (
          <p className="target-error" role="alert">
            {saveError}
          </p>
        )}
      </section>

      {status === 'loading' && <p role="status">Loading your Targets…</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {status === 'ready' &&
        (targets.length === 0 ? (
          <div className="empty-slate">
            <h2>No Targets yet.</h2>
            <p>Save one above to turn a read on a defense into a reusable player filter.</p>
          </div>
        ) : (
          <ul className="target-grid">
            {targets.map((target) => (
              <TargetCard key={target.id} target={target} />
            ))}
          </ul>
        ))}
    </main>
  );
}
