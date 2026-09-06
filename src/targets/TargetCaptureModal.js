import { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import TargetForm from './TargetForm';
import TargetLab from './TargetLab';
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
 * that opened it. Every opening is counted, so each one — a fresh capture or
 * the same row again — starts from its prefill with nothing left over from the
 * last, and a save that started under an earlier opening can tell.
 */
export default function TargetCaptureModal({ capture, onHide }) {
  const navigate = useNavigate();
  const [state, setState] = useState({
    opening: 0,
    capture: null,
    draft: null,
    saving: false,
    error: null,
  });
  const shown = useRef(undefined);
  const opening = useRef(0);
  if (capture !== shown.current) {
    shown.current = capture;
    opening.current += 1;
  }
  // Going away is one more opening nobody will save under.
  useEffect(
    () => () => {
      opening.current += 1;
    },
    [],
  );

  // The opened capture is kept for the dialog's own use: the body is still
  // drawn while the dialog fades out after the prop has gone.
  if (capture && state.opening !== opening.current) {
    setState({
      opening: opening.current,
      capture,
      draft: captureDraft(capture),
      saving: false,
      error: null,
    });
  }

  const { draft, saving, error } = state;

  /*
   * The saved draft is the record, and opens on its own page, where the
   * evidence the Lab showed reads the same. A refused save keeps the draft
   * exactly as it was composed: a duplicate is one edit away from a Target
   * worth keeping, not a retype.
   */
  const save = async (request) => {
    // A save answered after this opening was dismissed, or after the row was
    // opened again, is nobody's any more and acts on no one's behalf.
    const started = opening.current;
    setState((current) => ({ ...current, saving: true, error: null }));
    try {
      const target = await createTarget(request);
      if (opening.current !== started) return;
      navigate(`/targets/${target.id}`);
    } catch (requestError) {
      if (opening.current !== started) return;
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
      // Wide enough for the Lab's table beneath the form.
      size="xl"
      contentClassName="target-capture"
      aria-labelledby="target-capture-title"
    >
      <Modal.Header closeButton closeVariant="white">
        <Modal.Title as="h2" className="h5 mb-0" id="target-capture-title">
          Save as Target
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {draft && (
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
            {/* A Target born from a Defense Sheet row is tuned right here,
                against the season the row prompted a look at. */}
            <TargetLab draft={draft} />
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
