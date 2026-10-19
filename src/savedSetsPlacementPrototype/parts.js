/* PROTOTYPE — throwaway. Pieces every placement variant shares. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ChevronDown, Plus, Settings2 } from 'lucide-react';
import { createSavedFilterSet } from '../savedFilterSetsApi';
import { describeSavedFilterSet } from '../savedFilterSetDescription';
import { getRequestErrorMessage } from '../gameLogsApi';
import SavedFilterSetsModal from '../SavedFilterSetsModal';
import { VARIANT_KEYS, VARIANT_NAMES, useVariant } from './mode';
import { useSets } from './useSets';
import './proto.css';

export { Bookmark, BookmarkCheck, ChevronDown, Plus };

const currentQuery = () => window.location.search.replace(/^\?/, '');

const suggestedName = () => {
  const described = describeSavedFilterSet(currentQuery());
  const first = described.player ? described.player.split(' ').slice(-1)[0] : 'Set';
  const bits = described.parameters.slice(0, 2).map((parameter) => parameter.label);
  return [first, ...bits].join(' · ').slice(0, 100);
};

export const Chips = ({ set, withPlayer }) => (
  <span className="sp-chips">
    {withPlayer && set.described.player && (
      <span className="sp-chip is-player">{set.described.player}</span>
    )}
    {set.described.parameters.length === 0 && <span className="sp-chip">every game</span>}
    {set.described.parameters.map((parameter) => (
      <span
        key={parameter.key}
        className={`sp-chip${parameter.tone ? ` is-${parameter.tone}` : ''}`}
      >
        {parameter.label}
      </span>
    ))}
  </span>
);

export const SetRow = ({ set, current, withPlayer, onOpened }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`sp-row${current ? ' is-current' : ''}`}
      onClick={() => {
        navigate(`/?${set.queryString}`);
        onOpened?.();
      }}
    >
      <span className="sp-row-name">
        {current ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
        <b>{set.name}</b>
        {set.sample && <i className="sp-sample">sample</i>}
      </span>
      <Chips set={set} withPlayer={withPlayer} />
    </button>
  );
};

export const SetList = ({ player, onOpened, emptyMine = true }) => {
  const sets = useSets(player);
  if (!sets.loaded) return <p className="sp-note">Loading saved sets…</p>;
  return (
    <div className="sp-list">
      <div className="sp-group">For {player}</div>
      {sets.mine.length === 0 && emptyMine && (
        <p className="sp-note">None yet. Save the filters you have on to come back to them.</p>
      )}
      {sets.mine.map((set) => (
        <SetRow key={set.id} set={set} current={sets.current?.id === set.id} onOpened={onOpened} />
      ))}
      {sets.others.length > 0 && <div className="sp-group">Other players</div>}
      {sets.others.map((set) => (
        <SetRow key={set.id} set={set} withPlayer onOpened={onOpened} />
      ))}
    </div>
  );
};

export const ManageLink = ({ label = 'Rename or delete' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="sp-manage" onClick={() => setOpen(true)}>
        <Settings2 size={12} /> {label}
      </button>
      <SavedFilterSetsModal show={open} onHide={() => setOpen(false)} />
    </>
  );
};

/*
 * Save without a modal: the button becomes a name field in place. It saves
 * what the URL says, which is the applied Filter Set, so it waits for Apply.
 */
export const SaveInline = ({ dirty, player, className = '', compact }) => {
  const sets = useSets(player);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return undefined;
    const timer = setTimeout(() => setJustSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [justSaved]);

  if (sets.current && !editing)
    return (
      <span className={`sp-saved-state ${className}`} title={`Saved as “${sets.current.name}”`}>
        <BookmarkCheck size={14} /> {compact ? 'Saved' : justSaved ? 'Saved' : sets.current.name}
      </span>
    );
  if (!editing)
    return (
      <button
        type="button"
        className={`sp-save ${className}`}
        disabled={dirty}
        title={dirty ? 'Apply your changes first' : 'Save these filters'}
        onClick={() => {
          setName(suggestedName());
          setError(null);
          setEditing(true);
        }}
      >
        <Bookmark size={14} /> Save
      </button>
    );
  return (
    <form
      className={`sp-save-form ${className}`}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await createSavedFilterSet({ name: name.trim(), queryString: currentQuery() });
          setEditing(false);
          setJustSaved(true);
        } catch (saveError) {
          setError(getRequestErrorMessage(saveError, 'Could not save. Try another name.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        autoFocus
        className="fp-input"
        value={name}
        maxLength={100}
        aria-label="Name this Filter Set"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
      />
      <button type="submit" className="fp-btn-primary sp-save-go" disabled={busy || !name.trim()}>
        Save
      </button>
      <button type="button" className="fp-link" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error && <p className="sp-note is-error">{error}</p>}
    </form>
  );
};

/** A popover that closes on outside click and Escape. */
export const usePopover = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
};

export const Switcher = () => {
  const { variant, goTo, step } = useVariant();
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select')) return;
      if (event.key === '[') step(-1);
      if (event.key === ']') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="sp-switcher" role="navigation" aria-label="Prototype variants">
      <span className="sp-switcher-tag">Prototype</span>
      {VARIANT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={key === variant ? 'is-on' : ''}
          onClick={() => goTo(key)}
          title={VARIANT_NAMES[key]}
        >
          {key}
        </button>
      ))}
      <span className="sp-switcher-name">{VARIANT_NAMES[variant]}</span>
    </div>
  );
};
