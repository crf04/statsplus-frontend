/* PROTOTYPE — throwaway. The three placements. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ManageLink,
  Plus,
  SaveInline,
  SetList,
  usePopover,
} from './parts';
import { useSets } from './useSets';

/* A — the panel header carries a Saved menu; Save sits beside Apply. */
export const HeaderMenu = ({ player }) => {
  const sets = useSets(player);
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="sp-menu" ref={ref}>
      <button
        type="button"
        className={`sp-menu-btn${open ? ' is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bookmark size={14} />
        Saved
        <span className="sp-count">{sets.all.length}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="sp-pop">
          <SetList player={player} onOpened={() => setOpen(false)} />
          <div className="sp-pop-foot">
            <ManageLink />
          </div>
        </div>
      )}
    </div>
  );
};

/* When the applied filters are a saved set, the header says which. */
export const CurrentName = ({ player }) => {
  const sets = useSets(player);
  if (!sets.current) return null;
  return (
    <div className="sp-current">
      <BookmarkCheck size={13} /> {sets.current.name}
    </div>
  );
};

/* B — two tabs at the top of the panel. */
export const Tabs = ({ tab, setTab, player }) => {
  const sets = useSets(player);
  return (
    <div className="sp-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'filters'}
        className={tab === 'filters' ? 'is-on' : ''}
        onClick={() => setTab('filters')}
      >
        Filters
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'saved'}
        className={tab === 'saved' ? 'is-on' : ''}
        onClick={() => setTab('saved')}
      >
        Saved <span className="sp-count">{sets.all.length}</span>
      </button>
    </div>
  );
};

export const SavedTabBody = ({ player, onOpened }) => (
  <div className="sp-tabbody">
    <SetList player={player} onOpened={onOpened} />
    <ManageLink />
  </div>
);

export const useTab = () => useState('filters');

/* C — a rail of saved sets across the top of the Workspace. */
export const Rail = ({ player }) => {
  const sets = useSets(player);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  if (!sets.loaded) return <div className="sp-rail" />;
  const ordered = [...sets.mine, ...sets.others];
  return (
    <div className="sp-rail" aria-label="Saved Filter Sets">
      <span className="sp-rail-label">
        <Bookmark size={13} /> Saved
      </span>
      <div className="sp-rail-track">
        {saving ? (
          <SaveInline player={player} className="sp-rail-saveform" />
        ) : (
          !sets.current && (
            <button type="button" className="sp-pill is-add" onClick={() => setSaving(true)}>
              <Plus size={13} /> Save current
            </button>
          )
        )}
        {ordered.map((set, index) => {
          const current = sets.current?.id === set.id;
          const other = index >= sets.mine.length;
          return (
            <button
              key={set.id}
              type="button"
              className={`sp-pill${current ? ' is-current' : ''}${other ? ' is-other' : ''}`}
              title={[set.described.player, ...set.described.parameters.map((p) => p.label)].join(
                ' · ',
              )}
              onClick={() => navigate(`/?${set.queryString}`)}
            >
              {current && <BookmarkCheck size={13} />}
              {other && <span className="sp-pill-player">{initials(set.described.player)}</span>}
              {set.name}
              {set.sample && <i className="sp-sample">s</i>}
            </button>
          );
        })}
      </div>
      <ManageLink label="Manage" />
    </div>
  );
};

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
