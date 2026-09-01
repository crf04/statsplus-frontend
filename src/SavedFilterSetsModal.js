import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getRequestErrorMessage } from './gameLogsApi';
import { describeSavedFilterSet } from './savedFilterSetDescription';
import {
  deleteSavedFilterSet,
  fetchSavedFilterSets,
  renameSavedFilterSet,
} from './savedFilterSetsApi';
import './SavedFilterSetsModal.css';

/*
 * The saved list is the same list wherever it is opened from: the Query Prompt,
 * the Log Workspace, or the account menu. Opening an item navigates to its
 * query string and stops there — the effect watching the URL is what applies
 * the Filter Set, so a saved link and a pasted link travel the same path, down
 * to the error a link we can no longer honour produces.
 *
 * A row says what its Filter Set asks for rather than only what it was called.
 * The name is typed in a hurry and the prose of a Parsed Query is never stored,
 * so the parameters are the only description that can be relied on.
 */

const Parameters = ({ described }) => (
  <span className="saved-filter-set-parameters">
    {/* A refused link decodes to no Filter Set at all, so it has no parameters
        to show. Its player is still read off the raw URL, because a row has to
        stay identifiable enough to delete. */}
    {described.player && (
      <span className="saved-filter-set-parameter saved-filter-set-player">{described.player}</span>
    )}
    {described.refused ? (
      <span className="saved-filter-set-refusal">this link can no longer be opened</span>
    ) : (
      <>
        {described.parameters.length === 0 && (
          <span className="saved-filter-set-parameter">every logged game</span>
        )}
        {described.parameters.map((parameter) => (
          <span
            key={parameter.key}
            className={`saved-filter-set-parameter${
              parameter.tone ? ` saved-filter-set-parameter-${parameter.tone}` : ''
            }`}
          >
            {parameter.label}
          </span>
        ))}
      </>
    )}
  </span>
);

/*
 * A row owns only the state of its own interaction. Renaming and deleting go
 * back through the list's single mutation path, so what a rejection does is the
 * same wherever it came from.
 */
const SavedFilterSetRow = ({ savedFilterSet, isMutating, onOpen, onRename, onDelete }) => {
  const [interaction, setInteraction] = useState(null);
  const [draftName, setDraftName] = useState(savedFilterSet.name);

  if (interaction === 'rename') {
    return (
      <li className="saved-filter-set-row">
        <Form
          className="saved-filter-set-rename"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(draftName.trim());
            setInteraction(null);
          }}
        >
          <Form.Control
            autoFocus
            size="sm"
            value={draftName}
            maxLength={100}
            aria-label={`New name for ${savedFilterSet.name}`}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={isMutating || !draftName.trim()}>
            Save name
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isMutating}
            onClick={() => setInteraction(null)}
          >
            Cancel
          </Button>
        </Form>
      </li>
    );
  }

  const isConfirming = interaction === 'confirm-delete';

  return (
    <li className={`saved-filter-set-row${isConfirming ? ' saved-filter-set-row-confirming' : ''}`}>
      <button
        type="button"
        className="saved-filter-set-open"
        aria-label={`Open saved Filter Set ${savedFilterSet.name}`}
        onClick={() => onOpen()}
      >
        <span className="saved-filter-set-name">{savedFilterSet.name}</span>
        <Parameters described={describeSavedFilterSet(savedFilterSet.queryString)} />
      </button>
      {isConfirming ? (
        // Deleting is not undoable, so it asks on the row rather than removing
        // an item on the press that reached for it.
        <div className="saved-filter-set-actions saved-filter-set-actions-shown">
          <span className="saved-filter-set-confirm">Delete?</span>
          <button
            type="button"
            className="saved-filter-set-action saved-filter-set-action-danger"
            aria-label={`Confirm deleting ${savedFilterSet.name}`}
            disabled={isMutating}
            onClick={() => {
              setInteraction(null);
              onDelete();
            }}
          >
            Yes
          </button>
          <button
            type="button"
            className="saved-filter-set-action"
            aria-label={`Keep ${savedFilterSet.name}`}
            disabled={isMutating}
            onClick={() => setInteraction(null)}
          >
            No
          </button>
        </div>
      ) : (
        <div className="saved-filter-set-actions">
          <button
            type="button"
            className="saved-filter-set-action"
            aria-label={`Rename ${savedFilterSet.name}`}
            disabled={isMutating}
            onClick={() => {
              setDraftName(savedFilterSet.name);
              setInteraction('rename');
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="saved-filter-set-action saved-filter-set-action-danger"
            aria-label={`Delete ${savedFilterSet.name}`}
            disabled={isMutating}
            onClick={() => setInteraction('confirm-delete')}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
};

const SavedFilterSetsModal = ({ show, onHide }) => {
  const navigate = useNavigate();
  const [savedFilterSets, setSavedFilterSets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMutating, setIsMutating] = useState(false);

  const loadSavedFilterSets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSavedFilterSets(await fetchSavedFilterSets());
    } catch (loadError) {
      setError(
        getRequestErrorMessage(
          loadError,
          'Unable to load your saved Filter Sets. Please try again.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    loadSavedFilterSets();
  }, [show, loadSavedFilterSets]);

  // A rejected mutation leaves the list exactly as it was and says why, so a
  // duplicate name or a full account is a message rather than a lost item.
  const runMutation = async (mutate, fallbackMessage) => {
    setIsMutating(true);
    setError(null);
    try {
      await mutate();
      await loadSavedFilterSets();
    } catch (mutationError) {
      setError(getRequestErrorMessage(mutationError, fallbackMessage));
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpen = (savedFilterSet) => {
    navigate(`/?${savedFilterSet.queryString}`);
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      contentClassName="dark-card"
      aria-labelledby="saved-filter-sets-title"
    >
      <Modal.Header closeButton closeVariant="white">
        <Modal.Title as="h2" className="h5 mb-0" id="saved-filter-sets-title">
          Saved Filter Sets
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {isLoading && (
          <div className="text-center py-2" role="status" aria-live="polite">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading saved Filter Sets…
          </div>
        )}
        {!isLoading && savedFilterSets.length === 0 && !error && (
          <p className="mb-0">
            You have not saved any Filter Sets yet. Save one from the Log Workspace to come back to
            it later.
          </p>
        )}
        {savedFilterSets.length > 0 && (
          <ul className="saved-filter-sets-list">
            {savedFilterSets.map((savedFilterSet) => (
              <SavedFilterSetRow
                // Keyed by id so a row's own interaction state cannot survive
                // onto a different item when the list reloads.
                key={savedFilterSet.id}
                savedFilterSet={savedFilterSet}
                isMutating={isMutating}
                onOpen={() => handleOpen(savedFilterSet)}
                onRename={(name) =>
                  runMutation(
                    () => renameSavedFilterSet({ id: savedFilterSet.id, name }),
                    'Unable to rename this saved Filter Set. Please try again.',
                  )
                }
                onDelete={() =>
                  runMutation(
                    () => deleteSavedFilterSet({ id: savedFilterSet.id }),
                    'Unable to delete this saved Filter Set. Please try again.',
                  )
                }
              />
            ))}
          </ul>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default SavedFilterSetsModal;
