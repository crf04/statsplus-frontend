/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Question: what should the saved player-matchup link list look like, given
 * each item is only { id, name, queryString } and arrives newest-first?
 *
 * Three variants on the existing `/` route, switchable via `#proto=saved&v=`.
 * Real saved Filter Sets are used when the API returns any; otherwise the
 * fixture list stands in, so the layouts are judgeable at real density. Rename
 * and delete are in-memory stubs — the question is what this looks like, not
 * whether the backend works — and nothing here is persisted.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FIXTURE_SAVED_FILTER_SETS } from './fixtures';
import { useVariant } from './prototypeMode';
import PrototypeSwitcher from './PrototypeSwitcher';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';
import './prototype.css';

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC };

const SavedFilterSetsPrototype = ({ show, onHide, savedFilterSets, isLoading, error }) => {
  const navigate = useNavigate();
  const { variant, step } = useVariant();
  const [items, setItems] = useState(
    savedFilterSets?.length ? savedFilterSets : FIXTURE_SAVED_FILTER_SETS,
  );

  useEffect(() => {
    if (savedFilterSets?.length) setItems(savedFilterSets);
  }, [savedFilterSets]);

  const handleOpen = (item) => {
    navigate(`/?${item.queryString}`);
    onHide();
  };

  // Stubs: the list state is the prototype's own, so flipping variants never
  // touches a real saved Filter Set.
  const handleRename = (item, name) =>
    setItems((current) => current.map((it) => (it.id === item.id ? { ...it, name } : it)));
  const handleDelete = (item) => setItems((current) => current.filter((it) => it.id !== item.id));

  const Variant = VARIANTS[variant];
  // On fixtures the real fetch's spinner and error belong to nothing the user
  // is looking at, so they are dropped and the switcher says so instead.
  const onFixtures = !savedFilterSets?.length;

  return (
    <>
      <Variant
        show={show}
        onHide={onHide}
        items={items}
        isLoading={onFixtures ? false : isLoading}
        error={onFixtures ? null : error}
        onOpen={handleOpen}
        onRename={handleRename}
        onDelete={handleDelete}
      />
      {show && <PrototypeSwitcher variant={variant} onStep={step} onFixtures={onFixtures} />}
    </>
  );
};

export default SavedFilterSetsPrototype;
