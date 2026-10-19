import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRequestErrorMessage, withRequestReference } from '../gameLogsApi';
import { deleteSavedFilterSet, renameSavedFilterSet } from '../savedFilterSetsApi';
import { describeSavedFilterSet } from '../savedFilterSetDescription';
import { SavedFilterSetRow } from '../SavedFilterSetsModal';

const samePlayer = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

/*
 * The panel's Saved tab: every Saved Filter Set on the account, the player on
 * screen's first. A row is the same row the Saved Filter Sets modal lists, so
 * opening, renaming and deleting behave alike wherever the list is reached.
 * Mutations notify the shared list, which reloads in the backend's order.
 */
const SavedTab = ({ player, saved, current, onOpened }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isMutating, setIsMutating] = useState(false);

  if (saved.error)
    return (
      <div className="fpt-saved">
        <p role="status" className="fp-note">
          {withRequestReference('Could not load Saved Filter Sets.', saved.error)}
        </p>
        <button type="button" className="fp-link" onClick={saved.retry}>
          Retry saved sets
        </button>
      </div>
    );
  if (!saved.sets)
    return (
      <p role="status" className="fp-note">
        Loading saved Filter Sets…
      </p>
    );

  const runMutation = async (mutate, fallbackMessage) => {
    setIsMutating(true);
    setError(null);
    try {
      await mutate();
      return true;
    } catch (mutationError) {
      setError(getRequestErrorMessage(mutationError, fallbackMessage));
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const isMine = (set) =>
    samePlayer(describeSavedFilterSet(set.queryString).player) === samePlayer(player);
  const mine = saved.sets.filter(isMine);
  const others = saved.sets.filter((set) => !isMine(set));
  const row = (set, hidePlayer) => (
    <SavedFilterSetRow
      key={set.id}
      savedFilterSet={set}
      isMutating={isMutating}
      isCurrent={current?.id === set.id}
      hidePlayer={hidePlayer}
      onOpen={() => {
        navigate(`/?${set.queryString}`);
        onOpened();
      }}
      onRename={(name) =>
        runMutation(
          () => renameSavedFilterSet({ id: set.id, name }),
          'Unable to rename this saved Filter Set. Please try again.',
        )
      }
      onDelete={() =>
        runMutation(
          () => deleteSavedFilterSet({ id: set.id }),
          'Unable to delete this saved Filter Set. Please try again.',
        )
      }
    />
  );

  return (
    <div className="fpt-saved">
      {error && (
        <p role="alert" className="fpt-error">
          {error}
        </p>
      )}
      <h3 className="fpt-group">For {player}</h3>
      {mine.length === 0 ? (
        <p className="fp-note">
          No saved sets for {player} yet. Apply the filters you want, then Save.
        </p>
      ) : (
        <ul className="saved-filter-sets-list">{mine.map((set) => row(set, true))}</ul>
      )}
      {others.length > 0 && (
        <>
          <h3 className="fpt-group">Other players</h3>
          <ul className="saved-filter-sets-list">{others.map((set) => row(set, false))}</ul>
        </>
      )}
    </div>
  );
};

export default SavedTab;
