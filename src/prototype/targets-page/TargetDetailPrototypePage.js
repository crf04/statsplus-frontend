/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The switch for one Target's own page: the same reads as the list, the
 * Target picked out by the route, and the variant keyed by `dv`.
 */
import { useParams } from 'react-router-dom';
import TargetsSignedOut from '../../targets/TargetsSignedOut';
import PrototypeSwitcher from './PrototypeSwitcher';
import VariantI from './VariantI';
import VariantJ from './VariantJ';
import VariantK from './VariantK';
import { DETAIL_NAMES, PROTO_STANDALONE } from './prototypeMode';
import { useTargetsPrototypeData } from './shared';
import './prototype.css';

const VARIANTS = { I: VariantI, J: VariantJ, K: VariantK };

export default function TargetDetailPrototypePage({ proto }) {
  const { targetId } = useParams();
  const data = useTargetsPrototypeData(proto.date);
  const Variant = VARIANTS[proto.variant];
  if (!data.list.authLoading && !data.list.isAuthenticated) {
    return <TargetsSignedOut />;
  }
  const item = data.items.find((entry) => String(entry.target.id) === targetId) || null;
  return (
    <>
      {data.list.status === 'loading' && (
        <main className="slate-page targets-page">
          <p role="status">Loading this Target…</p>
        </main>
      )}
      {data.list.status === 'ready' &&
        (item ? (
          <Variant
            key={`${proto.variant}-${targetId}`}
            item={item}
            read={data.backtests[String(item.target.id)]}
            listPath={proto.listPath}
          />
        ) : (
          <main className="slate-page targets-page">
            <div className="empty-slate">
              <h2>That Target is gone.</h2>
              <p>It was deleted, or it belongs to another account.</p>
            </div>
          </main>
        ))}
      <PrototypeSwitcher
        variant={proto.variant}
        names={DETAIL_NAMES}
        date={proto.date}
        onStep={proto.step}
        onDate={PROTO_STANDALONE ? null : proto.setDate}
      />
    </>
  );
}
