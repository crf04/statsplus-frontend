/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * B — Desk. One Target is read in full at a time. A rail on the left lists
 * them, live ones first, and the pane on the right is the whole of the chosen
 * one: the opponent, the Qualifiers with how the opponent defends each slice
 * today, the fits, the note. "New" swaps the pane for the composer, whose
 * title preview is the pane's own headline, growing as the draft does.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TargetContext, TargetFitTable } from '../../targets/TargetFits';
import {
  deriveTargetTitle,
  findTargetBase,
  formatQualifierParts,
  targetBaseLabel,
} from '../../targets/targetCatalog';
import {
  GameLine,
  OpponentSelect,
  QualifierFields,
  describeToday,
  fitCount,
  formatCreated,
  isLive,
  shortDate,
  useDraft,
} from './shared';

export const NAME = 'Desk';

function RailItem({ item, active, onSelect }) {
  const { target } = item;
  const fits = fitCount(item);
  return (
    <li>
      <button
        type="button"
        className={`pt-b-item${active ? ' is-active' : ''}${isLive(item) ? ' is-live' : ''}`}
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
      >
        <span className="pt-b-item-opp">{target.opponent}</span>
        <span className="pt-b-item-quals">
          {target.qualifiers.map((qualifier, index) => {
            const { label, value } = formatQualifierParts(qualifier);
            return (
              <span key={index}>
                {label} <b>{value}</b>
              </span>
            );
          })}
        </span>
        <span className={`pt-b-item-today${fits ? ' has-fits' : ''}`}>{describeToday(item)}</span>
      </button>
    </li>
  );
}

function RailGroup({ label, items, current, onSelect }) {
  if (items.length === 0) return null;
  return (
    <section className="pt-b-group">
      <h2 className="target-section-heading">{label}</h2>
      <ul>
        {items.map((item) => (
          <RailItem
            key={item.target.id}
            item={item}
            active={current === item.target.id}
            onSelect={() => onSelect(item.target.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function Reading({ item, slateDate, resolved }) {
  const { target, entry } = item;
  return (
    <article className="pt-b-reading">
      <p className="eyebrow">
        Target · set {formatCreated(target.createdAt)}
        {target.local && ' · unsaved, this session only'}
      </p>
      <h1 className="pt-b-title">
        <span className="pt-b-title-opp">{target.opponent}</span>
        <span className="pt-b-title-vs">vs</span>
      </h1>
      <ul className="pt-b-quals">
        {target.qualifiers.map((qualifier, index) => {
          const { label, value } = formatQualifierParts(qualifier);
          return (
            <li key={index}>
              <span className="pt-b-qual-base">{targetBaseLabel(qualifier.base)}</span>
              <span className="pt-b-qual">
                {label} <b>{value}</b> <em>{findTargetBase(qualifier.base)?.unit}</em>
              </span>
              {entry?.context[index] && <TargetContext context={entry.context[index]} />}
            </li>
          );
        })}
      </ul>
      {target.note && <blockquote className="pt-b-note">{target.note}</blockquote>}

      <section className="pt-b-today">
        <h2 className="target-section-heading">
          {slateDate ? shortDate(slateDate) : 'Today'}
          {entry?.game && (
            <>
              {' · '}
              <GameLine game={entry.game} />
            </>
          )}
        </h2>
        {resolved.status === 'loading' && <p role="status">Reading the slate…</p>}
        {entry?.game ? (
          <TargetFitTable entry={entry} />
        ) : (
          resolved.status === 'ready' && (
            <p className="target-empty">
              {target.local
                ? 'Nothing was sent to the backend, so the day has nothing to say about it.'
                : `${target.opponent} has no game on this date.`}
            </p>
          )
        )}
      </section>

      {!target.local && (
        <p className="pt-b-actions">
          <Link to={`/targets/${target.id}`}>Open the full page →</Link>
          <span>edit · delete · season backtest live there</span>
        </p>
      )}
    </article>
  );
}

function Composer({ onSave, onCancel }) {
  const { draft, patch, patchQualifier, addQualifier, removeQualifier, valid, problem, request } =
    useDraft();
  return (
    <form
      className="pt-b-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave(request);
      }}
    >
      <p className="eyebrow">New Target</p>
      <h1 className={`pt-b-preview${valid ? '' : ' is-pending'}`}>
        {valid ? deriveTargetTitle(request) : `${draft.opponent} vs …`}
      </h1>
      <p className="pt-b-composer-hint">
        {valid ? 'The title is derived from the Qualifiers; the note never is.' : problem}
      </p>

      <label className="pt-b-field">
        <span className="target-label">Opponent</span>
        <OpponentSelect big value={draft.opponent} onChange={(opponent) => patch({ opponent })} />
      </label>

      <div className="pt-b-field">
        <span className="target-label">Qualifiers · a player must meet every one</span>
        {draft.qualifiers.map((qualifier, index) => (
          <QualifierFields
            key={index}
            qualifier={qualifier}
            index={index}
            onPatch={(fields) => patchQualifier(index, fields)}
            onRemove={draft.qualifiers.length > 1 ? () => removeQualifier(index) : null}
          />
        ))}
        <button type="button" className="pt-add" onClick={addQualifier}>
          + and another
        </button>
      </div>

      <label className="pt-b-field">
        <span className="target-label">Note · optional</span>
        <textarea
          rows={2}
          maxLength={280}
          placeholder="Why you set this"
          value={draft.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </label>

      <div className="pt-b-composer-actions">
        <button type="submit" className="target-primary" disabled={!valid}>
          Save Target
        </button>
        <button type="button" className="target-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function VariantB({ data }) {
  const { list, resolved, items, saveLocally, slateDate } = data;
  const [selected, setSelected] = useState(null);
  const current = selected ?? items[0]?.target.id ?? null;
  const currentItem = items.find((item) => item.target.id === current) || null;
  const live = items.filter(isLive);
  const idle = items.filter((item) => !isLive(item));

  return (
    <main className="slate-page targets-page pt-b">
      <aside className="pt-b-rail">
        <div className="pt-b-rail-head">
          <div>
            <p className="eyebrow">Targets</p>
            <h1>{list.status === 'ready' ? items.length : '·'}</h1>
          </div>
          <button
            type="button"
            className={`pt-b-new${current === 'new' ? ' is-active' : ''}`}
            onClick={() => setSelected('new')}
          >
            + New
          </button>
        </div>
        {list.status === 'loading' && <p role="status">Loading…</p>}
        {list.status === 'error' && <p role="alert">{list.error}</p>}
        <RailGroup
          label={slateDate ? `Live · ${shortDate(slateDate)}` : 'Live'}
          items={live}
          current={current}
          onSelect={setSelected}
        />
        <RailGroup label="Idle" items={idle} current={current} onSelect={setSelected} />
      </aside>

      <section className="pt-b-pane">
        {current === 'new' ? (
          <Composer
            onSave={(request) => {
              saveLocally(request);
              setSelected(null);
            }}
            onCancel={() => setSelected(null)}
          />
        ) : currentItem ? (
          <Reading item={currentItem} slateDate={slateDate} resolved={resolved} />
        ) : (
          list.status === 'ready' && (
            <div className="empty-slate">
              <h2>No Targets yet.</h2>
              <p>Press New to turn a read on a defense into a reusable player filter.</p>
            </div>
          )
        )}
      </section>
    </main>
  );
}
