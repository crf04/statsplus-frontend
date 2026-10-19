import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import { createSavedFilterSet } from '../savedFilterSetsApi';
import ErrorMessage from '../feedback/ErrorMessage';

/*
 * Save sits beside Apply and names the set in place. It stores the URL's
 * query string, which is the applied Filter Set, so it waits while the panel
 * holds changes Apply has not sent yet. A set that is already saved shows its
 * name instead.
 */
const SaveFilterSet = ({ current, dirty, defaultName = '' }) => {
  const location = useLocation();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  // Each naming form is its own attempt; a save that answers after the reader
  // has moved on or started another must not close or mark the newer one.
  const attempt = useRef(0);

  const stopNaming = () => {
    attempt.current += 1;
    setNaming(false);
    setError(null);
    setIsSaving(false);
  };

  // A different Filter Set is a different thing to save.
  useEffect(stopNaming, [location.search]);

  if (naming)
    return (
      <form
        className="fpt-save-form"
        onSubmit={async (event) => {
          event.preventDefault();
          // Unapplied changes mean the URL is not what the panel shows.
          if (dirty || isSaving || !name.trim()) return;
          const mine = attempt.current;
          setIsSaving(true);
          setError(null);
          try {
            await createSavedFilterSet({
              name: name.trim(),
              queryString: location.search.replace(/^\?/, ''),
            });
            if (attempt.current === mine) stopNaming();
          } catch (saveError) {
            if (attempt.current !== mine) return;
            setError(
              getRequestErrorMessage(
                saveError,
                'Unable to save this Filter Set. Please try again.',
              ),
            );
            setIsSaving(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="fpt-error">
            <ErrorMessage message={error} />
          </p>
        )}
        <input
          autoFocus
          className="fp-input"
          value={name}
          maxLength={100}
          placeholder="LeBron last 10 at home"
          aria-label="Name this Filter Set"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') stopNaming();
          }}
        />
        <button
          type="submit"
          className="fp-btn-primary"
          disabled={isSaving || dirty || !name.trim()}
          title={dirty ? 'Apply your changes first' : undefined}
        >
          Save
        </button>
        <button type="button" className="fp-link" onClick={stopNaming}>
          Cancel
        </button>
      </form>
    );

  if (current)
    return (
      <span className="fpt-saved-as" title={current.name}>
        Saved as <b>{current.name}</b>
      </span>
    );

  return (
    <button
      type="button"
      className="fp-btn-ghost fpt-save"
      disabled={dirty}
      title={dirty ? 'Apply your changes first' : undefined}
      onClick={() => {
        attempt.current += 1;
        // The query the user typed is the name they would most likely reach for.
        setName(defaultName.slice(0, 100));
        setError(null);
        setNaming(true);
      }}
    >
      Save
    </button>
  );
};

export default SaveFilterSet;
