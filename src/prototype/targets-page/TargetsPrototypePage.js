/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The switch. Data is read once here, so flipping variants keeps the same
 * Targets and the same day; only the rendered subtree changes.
 */
import TargetsSignedOut from '../../targets/TargetsSignedOut';
import PrototypeSwitcher from './PrototypeSwitcher';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';
import { useTargetsPrototypeData } from './shared';
import './prototype.css';

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC };

export default function TargetsPrototypePage({ proto }) {
  const data = useTargetsPrototypeData(proto.date);
  const Variant = VARIANTS[proto.variant];
  if (!data.list.authLoading && !data.list.isAuthenticated) {
    return <TargetsSignedOut />;
  }
  return (
    <>
      <Variant data={data} />
      <PrototypeSwitcher
        variant={proto.variant}
        date={proto.date}
        onStep={proto.step}
        onDate={proto.setDate}
      />
    </>
  );
}
