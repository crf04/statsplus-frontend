import useFilterPanel from './useFilterPanel';
import FilterPanelView from './FilterPanelView';
import FilterPanelContext from './FilterPanelContext';
import './filterPanel.css';

export default function FilterPanel(props) {
  const panel = useFilterPanel(props);
  return (
    <FilterPanelView
      panel={panel}
      pinned
      compactTiles
      filler={<FilterPanelContext panel={panel} extra={props} />}
    />
  );
}
