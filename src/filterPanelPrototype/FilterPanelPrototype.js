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
import './prototype.css';

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC };

const FilterPanelPrototype = (props) => {
  const { active, variant, step } = useVariant();
  const panel = useFilterPanel(props);
  if (!active) return <FilterOptions {...props} />;
  const Variant = VARIANTS[variant];
  return (
    <>
      {Variant ? <Variant panel={panel} /> : <FilterOptions {...props} />}
      <PrototypeSwitcher variant={variant} onStep={step} />
    </>
  );
};

export default FilterPanelPrototype;
