import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, ListGroup, Modal, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getRequestErrorMessage } from './gameLogsApi';
import {
  deleteSavedFilterSet,
  fetchSavedFilterSets,
  renameSavedFilterSet,
} from './savedFilterSetsApi';

/*
 * The saved list is the same list wherever it is opened from: the Query Prompt,
 * the Log Workspace, or the account menu. Opening an item navigates to its
 * query string and stops there — the effect watching the URL is what applies
 * the Filter Set, so a saved link and a pasted link travel the same path, down
 * to the error a link we can no longer honour produces.
 */
const SavedFilterSetsModal = ({ show, onHide }) => {
  const navigate = useNavigate();
  const [savedFilterSets, setSavedFilterSets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draftName, setDraftName] = useState('');
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
    setRenamingId(null);
    loadSavedFilterSets();
  }, [show, loadSavedFilterSets]);

  // A rejected mutation leaves the list exactly as it was and says why, so a
  // duplicate name or a full account is a message rather than a lost item.
  const runMutation = async (mutate, fallbackMessage) => {
    setIsMutating(true);
    setError(null);
    try {
      await mutate();
      setRenamingId(null);
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

  const startRename = (savedFilterSet) => {
    setRenamingId(savedFilterSet.id);
    setDraftName(savedFilterSet.name);
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
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
          <ListGroup variant="flush">
            {savedFilterSets.map((savedFilterSet) => (
              <ListGroup.Item
                key={savedFilterSet.id}
                className="bg-transparent text-white px-0 border-secondary"
              >
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <Button
                    variant="link"
                    className="p-0 text-start text-decoration-none flex-grow-1"
                    aria-label={`Open saved Filter Set ${savedFilterSet.name}`}
                    onClick={() => handleOpen(savedFilterSet)}
                  >
                    {savedFilterSet.name}
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    aria-label={`Rename ${savedFilterSet.name}`}
                    disabled={isMutating}
                    onClick={() => startRename(savedFilterSet)}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    aria-label={`Delete ${savedFilterSet.name}`}
                    disabled={isMutating}
                    onClick={() =>
                      runMutation(
                        () => deleteSavedFilterSet({ id: savedFilterSet.id }),
                        'Unable to delete this saved Filter Set. Please try again.',
                      )
                    }
                  >
                    Delete
                  </Button>
                </div>
                {renamingId === savedFilterSet.id && (
                  <Form
                    className="d-flex align-items-center gap-2 mt-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      runMutation(
                        () =>
                          renameSavedFilterSet({ id: savedFilterSet.id, name: draftName.trim() }),
                        'Unable to rename this saved Filter Set. Please try again.',
                      );
                    }}
                  >
                    <Form.Control
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
                      onClick={() => setRenamingId(null)}
                    >
                      Cancel
                    </Button>
                  </Form>
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default SavedFilterSetsModal;
