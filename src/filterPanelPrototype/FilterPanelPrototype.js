/*
 * PROTOTYPE — throwaway. See ./README.md. Stands in for <FilterOptions> in the
 * Log Workspace; when the prototype is off it is exactly <FilterOptions>.
 */
import FilterOptions from '../FilterOptions';
import PrototypeSwitcher from './PrototypeSwitcher';
import { useVariant } from './prototypeMode';
import useFilterPanel from './useFilterPanel';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';
import VariantF from './VariantF';
import Filler from './fillers';
import './prototype.css';

const VARIANTS = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: (props) => <VariantB {...props} pinned />,
  E: (props) => <VariantC {...props} pinned />,
  F: VariantF,
  G: (props) => (
    <VariantB
      {...props}
      pinned
      filler={<Filler kind="saved" panel={props.panel} extra={props.extra} />}
    />
  ),
  H: (props) => (
    <VariantC
      {...props}
      pinned
      filler={<Filler kind="next" panel={props.panel} extra={props.extra} />}
    />
  ),
};

const FilterPanelPrototype = (props) => {
  const { active, variant, step } = useVariant();
  const panel = useFilterPanel(props);
  if (!active) return <FilterOptions {...props} />;
  const Variant = VARIANTS[variant];
  return (
    <>
      {Variant ? <Variant panel={panel} extra={props} /> : <FilterOptions {...props} />}
      <PrototypeSwitcher variant={variant} onStep={step} />
    </>
  );
};

export default FilterPanelPrototype;
