import { useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import TargetForm, { blankTargetDraft } from './TargetForm';
import TargetLab from './TargetLab';
import {
  codeForTeam,
  QualifierOpponentContext,
  qualifierFor,
  ReadControls,
  SourceNote,
  StatsSurface,
  useTeamContextRead,
} from './TeamContextPrototype';
import './TargetContextPrototype.css';

/* Two answers to the narrower question: how should context sit beside a Target draft? */
export const TARGET_CONTEXT_VARIANTS = {
  A: { label: 'Inline table', shortLabel: 'Inline table' },
  B: { label: 'Split context panel', shortLabel: 'Split panel' },
};

const TARGET_CONTEXT_KEYS = Object.keys(TARGET_CONTEXT_VARIANTS);

export const isTargetContextPrototypeRequested = (searchParams) =>
  process.env.NODE_ENV !== 'production' && searchParams.get('contextPrototype') === '1';

export const contextPrototypeVariantFor = (searchParams) => {
  if (!isTargetContextPrototypeRequested(searchParams)) return null;
  const requested = searchParams.get('variant');
  return Object.hasOwn(TARGET_CONTEXT_VARIANTS, requested) ? requested : 'A';
};

function useDraftOpponentContext(read, draft, onChange, lockOpponent) {
  const { selectedTeam, setSelectedTeam, teams } = read;
  useEffect(() => {
    const team = teams.find((name) => codeForTeam(name) === draft.opponent);
    if (team && teams.includes(team) && selectedTeam !== team) {
      setSelectedTeam(team);
    }
  }, [draft.opponent, selectedTeam, setSelectedTeam, teams]);

  const onTeamChange = useCallback(
    (team) => {
      setSelectedTeam(team);
      const tricode = codeForTeam(team);
      if (!lockOpponent && tricode && tricode !== draft.opponent) onChange({ opponent: tricode });
    },
    [draft.opponent, lockOpponent, onChange, setSelectedTeam],
  );

  return onTeamChange;
}

function focusQualifier(index) {
  const focus = () =>
    document.querySelector(`[aria-label="Qualifier ${index + 1} diet base"]`)?.focus();
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(focus);
  } else {
    setTimeout(focus, 0);
  }
}

function useQualifierFromContext(draft, onChange) {
  const [highlightedQualifierIndex, setHighlightedQualifierIndex] = useState(null);
  const onUse = useCallback(
    (row) => {
      const nextQualifier = qualifierFor('', row);
      if (!nextQualifier) return;
      const existingIndex = draft.qualifiers.findIndex(
        (qualifier) =>
          qualifier.base === nextQualifier.base && qualifier.sliceKey === nextQualifier.sliceKey,
      );
      if (existingIndex >= 0) {
        setHighlightedQualifierIndex(existingIndex);
        focusQualifier(existingIndex);
        return;
      }
      const nextIndex = draft.qualifiers.length;
      onChange({ qualifiers: [...draft.qualifiers, nextQualifier] });
      setHighlightedQualifierIndex(nextIndex);
      focusQualifier(nextIndex);
    },
    [draft.qualifiers, onChange],
  );
  return { highlightedQualifierIndex, onUse };
}

function ContextPanel({
  read,
  lockOpponent,
  onTeamChange,
  onUse,
  collapsible = false,
  embedded = false,
  open = true,
  onToggle,
}) {
  const panelBody = (
    <div className="target-context-panel-body">
      {!collapsible && !embedded && (
        <p className="target-context-opponent-line">
          <b>{codeForTeam(read.selectedTeam) || '—'}</b> opponent context · {read.config.label}
        </p>
      )}
      <ReadControls
        read={read}
        compact={collapsible || embedded}
        lockTeam={lockOpponent}
        hideTeam
        onTeamChange={onTeamChange}
      />
      <SourceNote read={read} compact />
      <StatsSurface read={read} mode="compact" onUse={onUse} />
    </div>
  );

  if (embedded) {
    return (
      <section className="target-context-panel target-context-panel-inline" aria-label="Team stats">
        <h2>{codeForTeam(read.selectedTeam) || '—'} team stats</h2>
        {panelBody}
      </section>
    );
  }

  if (collapsible) {
    return (
      <details
        className="target-context-panel target-context-panel-a"
        open={open}
        onToggle={(event) => onToggle(event.currentTarget.open)}
      >
        <summary>
          <b>{codeForTeam(read.selectedTeam) || '—'} opponent context</b>
          <span className="target-context-summary-meta">{read.config.label}</span>
        </summary>
        {panelBody}
      </details>
    );
  }

  return (
    <aside className="target-context-panel target-context-panel-b" aria-label="Opponent context">
      <div className="target-context-panel-head">
        <span className="target-context-eyebrow">Context panel</span>
        <span className="target-context-panel-dot" aria-hidden="true" />
      </div>
      {panelBody}
    </aside>
  );
}

function TargetContextLayouts({
  variant,
  draft,
  onChange,
  onSubmit,
  onCancel,
  busy = false,
  lockOpponent = false,
  title,
  submitLabel = 'Save Target',
  showActions = true,
  cancelLabel = 'Cancel',
  preferences,
  onPreferencesChange,
  immediateInitialPreview = false,
  workbench = false,
}) {
  const read = useTeamContextRead();
  const onTeamChange = useDraftOpponentContext(read, draft, onChange, lockOpponent);
  const { highlightedQualifierIndex, onUse } = useQualifierFromContext(draft, onChange);
  const [contextOpen, setContextOpen] = useState(!workbench);
  const form = (
    <TargetForm
      draft={draft}
      title={title}
      busy={busy}
      lockOpponent={lockOpponent}
      submitLabel={submitLabel}
      showActions={showActions}
      cancelLabel={cancelLabel}
      qualifierContext={(qualifier) => (
        <QualifierOpponentContext
          key={`${draft.opponent}:${qualifier.base}`}
          team={read.teams.find((team) => codeForTeam(team) === draft.opponent)}
          opponent={draft.opponent}
          teams={read.teams}
          teamsLoading={read.teamsState === 'loading'}
          qualifier={qualifier}
        />
      )}
      highlightedQualifierIndex={highlightedQualifierIndex}
      onChange={onChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
  const panel = (
    <ContextPanel
      read={read}
      lockOpponent={lockOpponent}
      onTeamChange={onTeamChange}
      onUse={onUse}
      embedded={workbench}
      collapsible={!workbench && variant === 'A'}
      open={contextOpen}
      onToggle={setContextOpen}
    />
  );
  const evidence = (
    <TargetLab
      draft={draft}
      workbench={workbench}
      sideBacktest={workbench}
      immediateInitialPreview={immediateInitialPreview}
      preferences={preferences}
      onPreferencesChange={onPreferencesChange}
    >
      {workbench ? (
        <>
          {form}
          {panel}
        </>
      ) : variant === 'A' ? (
        <div className="target-context-a-form-context">
          {panel}
          <div>{form}</div>
        </div>
      ) : (
        form
      )}
    </TargetLab>
  );

  if (workbench) {
    return <div className="target-workbench target-context-edit-workbench">{evidence}</div>;
  }

  return (
    <div className={`target-context-layout target-context-layout-${variant.toLowerCase()}`}>
      <div className="target-context-form-column">{evidence}</div>
      {variant === 'B' && panel}
    </div>
  );
}

export function TargetContextComposer({
  open,
  draft = blankTargetDraft(),
  variant,
  busy,
  onChange,
  onSubmit,
  onCancel,
  preferences,
  onPreferencesChange,
}) {
  return (
    <Modal
      show={open}
      onHide={onCancel}
      centered
      scrollable
      backdrop="static"
      className="target-new-layer target-context-modal-layer"
      dialogClassName={`target-new-dialog target-context-modal-dialog target-context-modal-dialog-${variant.toLowerCase()}`}
      contentClassName="target-new-modal target-context-modal"
      backdropClassName="target-new-backdrop"
      aria-labelledby="target-context-composer-heading"
    >
      <Modal.Header closeButton closeVariant="white">
        <Modal.Title as="h2" className="h5 mb-0" id="target-context-composer-heading">
          New Target <span className="target-context-modal-tag">prototype</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="target-context-prototype-note">
          Read-only exploration · saved drafts and stat choices stay in this session.
        </p>
        <TargetContextLayouts
          variant={variant}
          draft={draft}
          busy={busy}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
          preferences={preferences}
          onPreferencesChange={onPreferencesChange}
        />
      </Modal.Body>
      <Modal.Footer>
        <TargetContextSwitcher current={variant} placement="footer" />
      </Modal.Footer>
    </Modal>
  );
}

export function TargetContextEditor({
  variant,
  draft,
  busy,
  title,
  submitLabel = 'Save changes',
  showActions,
  cancelLabel = 'Revert',
  lockOpponent = true,
  onChange,
  onSubmit,
  onCancel,
  preferences,
  onPreferencesChange,
}) {
  return (
    <>
      <p className="target-context-prototype-note">
        Read-only exploration · saves, reverts, and stat choices stay in this session.
      </p>
      <TargetContextLayouts
        variant={variant}
        draft={draft}
        busy={busy}
        title={title}
        submitLabel={submitLabel}
        showActions={showActions}
        cancelLabel={cancelLabel}
        lockOpponent={lockOpponent}
        onChange={onChange}
        onSubmit={onSubmit}
        onCancel={onCancel}
        immediateInitialPreview
        workbench
        preferences={preferences}
        onPreferencesChange={onPreferencesChange}
      />
    </>
  );
}

export function TargetContextSwitcher({ current, placement = 'page' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const index = Math.max(0, TARGET_CONTEXT_KEYS.indexOf(current));
  const update = useCallback(
    (nextIndex) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('contextPrototype', '1');
      nextParams.set(
        'variant',
        TARGET_CONTEXT_KEYS[(nextIndex + TARGET_CONTEXT_KEYS.length) % TARGET_CONTEXT_KEYS.length],
      );
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, button, [contenteditable="true"]') ||
          target.closest('[role="dialog"]'))
      )
        return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        update(index - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        update(index + 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, update]);

  if (process.env.NODE_ENV === 'production') return null;
  return (
    <nav
      className={`target-context-switcher target-context-switcher-${placement}`}
      aria-label="Team context prototype variants"
    >
      <button
        type="button"
        aria-label="Previous team context prototype"
        onClick={() => update(index - 1)}
      >
        ←
      </button>
      <span>
        <b>{current}</b> · {TARGET_CONTEXT_VARIANTS[current]?.label}
      </span>
      <button
        type="button"
        aria-label="Next team context prototype"
        onClick={() => update(index + 1)}
      >
        →
      </button>
    </nav>
  );
}

export function TargetContextPageSwitcher({ current, visible = true }) {
  return visible ? <TargetContextSwitcher current={current} placement="page" /> : null;
}
