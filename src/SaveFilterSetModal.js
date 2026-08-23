import { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { getRequestErrorMessage } from './gameLogsApi';
import { createSavedFilterSet } from './savedFilterSetsApi';

/*
 * Saving stores the Log Workspace's bare query string under a name and nothing
 * else, so what comes back later is the link the user was looking at rather
 * than a snapshot of the results it produced.
 */
const SaveFilterSetModal = ({ show, onHide, queryString }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setName('');
    setError(null);
  }, [show]);

  // A duplicate name or a full account is the backend's answer, and it is shown
  // here rather than swallowed, so the save is retryable under a new name.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await createSavedFilterSet({ name: name.trim(), queryString });
      onHide();
    } catch (saveError) {
      setError(
        getRequestErrorMessage(saveError, 'Unable to save this Filter Set. Please try again.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      contentClassName="dark-card"
      aria-labelledby="save-filter-set-title"
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton closeVariant="white">
          <Modal.Title as="h2" className="h5 mb-0" id="save-filter-set-title">
            Save this Filter Set
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <Form.Group controlId="saved-filter-set-name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              autoFocus
              value={name}
              maxLength={100}
              placeholder="LeBron last 10 at home"
              onChange={(event) => setName(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !name.trim()}>
            Save
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default SaveFilterSetModal;
