import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useFilterPanel from './useFilterPanel';
import FilterPanelView from './FilterPanelView';
import FilterPanelContext from './FilterPanelContext';
import SavedTab from './SavedTab';
import SaveFilterSet from './SaveFilterSet';
import useSavedFilterSets, { findSavedFilterSet } from './useSavedFilterSets';
import './filterPanel.css';

const Tabs = ({ tab, onChange, count }) => (
  <div className="fpt-tabs" role="tablist" aria-label="Filter panel">
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'filters'}
      className={tab === 'filters' ? 'is-on' : ''}
      onClick={() => onChange('filters')}
    >
      Filters
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'saved'}
      className={tab === 'saved' ? 'is-on' : ''}
      onClick={() => onChange('saved')}
    >
      Saved{count !== null && ' '}
      {count !== null && <span className="fpt-count">{count}</span>}
    </button>
  </div>
);

export default function FilterPanel(props) {
  const panel = useFilterPanel(props);
  const { isAuthenticated, waitlist } = useAuth();
  const location = useLocation();
  const saved = useSavedFilterSets();
  const [tab, setTab] = useState('filters');
  // Saved Filter Sets belong to an admitted account.
  const canSave = isAuthenticated && !waitlist;
  const current = findSavedFilterSet(saved.sets, location.search);
  // `/?browse=1` carries no Filter Set yet, so there is nothing to save.
  const hasFilterSet = [...new URLSearchParams(location.search).keys()].some(
    (key) => key !== 'browse',
  );

  // Another player is another panel; it opens on its filters.
  useEffect(() => setTab('filters'), [panel.selectedPlayer]);

  return (
    <FilterPanelView
      panel={panel}
      pinned
      compactTiles
      tabs={
        canSave && (
          <Tabs tab={tab} onChange={setTab} count={saved.sets ? saved.sets.length : null} />
        )
      }
      body={
        canSave &&
        tab === 'saved' && (
          <SavedTab
            player={panel.selectedPlayer}
            saved={saved}
            current={current}
            onOpened={() => setTab('filters')}
          />
        )
      }
      savedName={canSave && current?.name}
      save={
        canSave &&
        hasFilterSet && (
          <SaveFilterSet
            current={current}
            dirty={panel.dirtyCount > 0}
            defaultName={props.defaultSaveName}
          />
        )
      }
      filler={<FilterPanelContext panel={panel} extra={props} saved={canSave ? saved : null} />}
    />
  );
}
