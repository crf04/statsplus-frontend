import useFilterPanel from './useFilterPanel';
import FilterPanelView from './FilterPanelView';
import FilterPanelContext from './FilterPanelContext';
import './filterPanel.css';
// PROTOTYPE (throwaway): saved-set placement variants.
import { usePlacement } from '../savedSetsPlacementPrototype/mode';
import { SaveInline } from '../savedSetsPlacementPrototype/parts';
import {
  CurrentName,
  HeaderMenu,
  SavedTabBody,
  Tabs,
  useTab,
} from '../savedSetsPlacementPrototype/variants';

export default function FilterPanel(props) {
  const panel = useFilterPanel(props);
  const placement = usePlacement();
  const [tab, setTab] = useTab();
  const player = panel.selectedPlayer;
  const save = <SaveInline dirty={panel.dirtyCount > 0} player={player} />;
  let proto = {};
  if (placement === 'A')
    proto = {
      headAside: <HeaderMenu player={player} />,
      underHead: <CurrentName player={player} />,
      footStart: save,
    };
  if (placement === 'B')
    proto = {
      top: <Tabs tab={tab} setTab={setTab} player={player} />,
      body:
        tab === 'saved' ? (
          <SavedTabBody player={player} onOpened={() => setTab('filters')} />
        ) : null,
      underHead: <CurrentName player={player} />,
      footStart: save,
    };
  // C saves from the rail, so the footer stays as it is today.
  if (placement === 'C') proto = {};
  return (
    <FilterPanelView
      panel={panel}
      pinned
      compactTiles
      proto={proto}
      filler={
        <FilterPanelContext
          panel={panel}
          extra={props}
          hideSaved={Boolean(placement && placement !== 'O')}
        />
      }
    />
  );
}
