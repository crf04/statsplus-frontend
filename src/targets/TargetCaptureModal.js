import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import TargetForm from './TargetForm';
import { shareToThresholdPercent, targetSliceLabel } from './targetCatalog';
import { createTarget } from './targetsApi';
import './TargetsPage.css';

/*
 * A Defense Sheet row is already an observation about one team and one slice,
 * so capture starts the Target from it: the team whose sheet is open is the
 * opponent, the row is the Qualifier's slice, and the league average the row is
 * being read against is the threshold to argue with. `at_or_above` is the
 * comparator because a sheet row is read for what a defense gives up.
 *
 * The prefill is a starting point, not the Target. The threshold is editable
 * and more Qualifiers can be added before saving, which is why the form here is
 * the same one the Targets page uses.
 */
export const captureDraft = ({ opponent, base, sliceKey, leagueAverageShare }) => ({
  opponent,
  qualifiers: [
    {
      base,
      sliceKey,
      comparator: 'at_or_above',
      /* A slice with no published league average has no line to start from.
         Guessing one would put a threshold nobody chose into a saved filter, so
         the field stays empty and the form keeps the save disabled until a
         share is typed. */
      thresholdPercent:
        typeof leagueAverageShare === 'number'
          ? shareToThresholdPercent(leagueAverageShare, { whole: true })
          : '',
    },
  ],
  note: '',
});

/*
 * The modal stays mounted so that closing it hands focus back to the row action
 * that opened it. Each capture is a fresh object, so a new one resets the draft
 * and clears whatever the last save said.
 */
export default function TargetCaptureModal({ capture, onHide }) {
  const [state, setState] = useState({
    capture: null,
    draft: null,
    saving: false,
    error: null,
    saved: null,
  });

  if (capture && capture !== state.capture) {
    setState({
      capture,
      draft: captureDraft(capture),
      saving: false,
      error: null,
      saved: null,
    });
  }

  const { draft, saving, error, saved } = state;

  /*
   * A refused save keeps the draft exactly as it was composed: a duplicate is
   * one edit away from a Target worth keeping, not a retype.
   */
  const save = async (request) => {
    setState((current) => ({ ...current, saving: true, error: null }));
    try {
      const target = await createTarget(request);
      setState((current) => ({ ...current, saving: false, saved: target }));
    } catch (requestError) {
      setState((current) => ({
        ...current,
        saving: false,
        error: getRequestErrorMessage(
          requestError,
          'Unable to save this Target. Please try again.',
        ),
      }));
    }
  };

  return (
    <Modal
      show={Boolean(capture)}
      onHide={onHide}
      centered
      size="lg"
      contentClassName="target-capture"
      aria-labelledby="target-capture-title"
    >
      <Modal.Header closeButton closeVariant="white">
        <Modal.Title as="h2" className="h5 mb-0" id="target-capture-title">
          Save as Target
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {saved ? (
          <div className="target-capture-saved">
            <p className="target-label">Target saved · title derived from the Qualifiers</p>
            <p className="target-title">{saved.title}</p>
            <div className="target-form-actions">
              <Link className="target-primary" to="/targets">
                Go to Targets
              </Link>
              <button type="button" className="target-ghost" onClick={onHide}>
                Back to the Defense Sheet
              </button>
            </div>
          </div>
        ) : (
          draft && (
            <>
              <p className="target-capture-source">
                From the {state.capture.opponent} Defense Sheet ·{' '}
                {targetSliceLabel(state.capture.base, state.capture.sliceKey)}
                {typeof state.capture.leagueAverageShare === 'number'
                  ? ' · threshold starts at the league average'
                  : ' · no league average published for this slice'}
              </p>
              <TargetForm
                draft={draft}
                busy={saving}
                lockOpponent
                onChange={(patch) =>
                  setState((current) => ({ ...current, draft: { ...current.draft, ...patch } }))
                }
                onSubmit={save}
                onCancel={onHide}
              />
              {error && (
                <p className="target-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )
        )}
      </Modal.Body>
    </Modal>
  );
}
