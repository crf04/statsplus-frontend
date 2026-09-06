/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * H — Bench. One set of criteria on the bench at a time. The rail lists every
 * Target by its criteria; the bench reads the chosen one as a sentence, fixed,
 * with its Backtest beneath. "New" puts an empty sentence on the bench with
 * the blanks live, and that is the Lab: the season re-reads as they are filled.
 * Editing a saved Target happens on its own page.
 */
import { useState } from 'react';
import {
  NBA_TEAM_TRICODES,
  TARGET_BASES,
  TARGET_COMPARATORS,
  TARGET_SLICES,
  comparatorSymbol,
  deriveTargetTitle,
  findTargetBase,
  formatQualifierParts,
  nudgeThresholdPercent,
} from '../../targets/targetCatalog';
import { LabEvidence, savedLab, useLab } from './lab';
import { ProtoLink, useDraft } from './shared';
import { percent, summarise } from './history';

export const NAME = 'Bench';

function Sentence({ editor }) {
  const { draft, patch, patchQualifier, addQualifier, removeQualifier } = editor;
  const flip = (qualifier) =>
    qualifier.comparator === TARGET_COMPARATORS[0].key
      ? TARGET_COMPARATORS[1].key
      : TARGET_COMPARATORS[0].key;
  return (
    <div className="pt-h-sentence">
      <p className="pt-c-line">
        <span className="pt-c-word">Against</span>
        <select
          className="pt-c-blank is-opp"
          aria-label="Opponent"
          value={draft.opponent}
          onChange={(event) => patch({ opponent: event.target.value })}
        >
          {NBA_TEAM_TRICODES.map((tricode) => (
            <option key={tricode} value={tricode}>
              {tricode}
            </option>
          ))}
        </select>
        <span className="pt-c-word">, a player fits when</span>
        {draft.qualifiers.map((qualifier, index) => (
          <span className="pt-c-clause" key={index}>
            {index > 0 && <span className="pt-c-word is-and">and</span>}
            <select
              className="pt-c-blank is-dim"
              aria-label={`Qualifier ${index + 1} diet base`}
              value={qualifier.base}
              onChange={(event) =>
                patchQualifier(index, {
                  base: event.target.value,
                  sliceKey: TARGET_SLICES[event.target.value][0][0],
                })
              }
            >
              {TARGET_BASES.map((base) => (
                <option key={base.key} value={base.key}>
                  {base.label}
                </option>
              ))}
            </select>
            <select
              className="pt-c-blank"
              aria-label={`Qualifier ${index + 1} slice`}
              value={qualifier.sliceKey}
              onChange={(event) => patchQualifier(index, { sliceKey: event.target.value })}
            >
              {TARGET_SLICES[qualifier.base].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <span className="pt-c-word">is</span>
            <button
              type="button"
              className="pt-c-blank is-cmp"
              aria-label={`Qualifier ${index + 1} comparator, press to flip`}
              onClick={() => patchQualifier(index, { comparator: flip(qualifier) })}
            >
              {comparatorSymbol(qualifier.comparator)}
            </button>
            <span className="pt-h-num">
              <button
                type="button"
                aria-label={`Qualifier ${index + 1} threshold down 1%`}
                onClick={() =>
                  patchQualifier(index, {
                    thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, -1),
                  })
                }
              >
                −
              </button>
              <input
                className="pt-c-blank is-num"
                type="number"
                min="0"
                max="100"
                step="any"
                placeholder="__"
                aria-label={`Qualifier ${index + 1} threshold percent`}
                value={qualifier.thresholdPercent}
                onChange={(event) =>
                  patchQualifier(index, { thresholdPercent: event.target.value })
                }
                onKeyDown={(event) => {
                  const delta = { ArrowUp: 1, ArrowDown: -1 }[event.key];
                  if (!delta) return;
                  event.preventDefault();
                  patchQualifier(index, {
                    thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, delta),
                  });
                }}
              />
              <button
                type="button"
                aria-label={`Qualifier ${index + 1} threshold up 1%`}
                onClick={() =>
                  patchQualifier(index, {
                    thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, 1),
                  })
                }
              >
                +
              </button>
            </span>
            <span className="pt-c-word">% {findTargetBase(qualifier.base)?.unit}</span>
            {draft.qualifiers.length > 1 && (
              <button
                type="button"
                className="pt-c-strike"
                aria-label={`Remove Qualifier ${index + 1}`}
                onClick={() => removeQualifier(index)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <button type="button" className="pt-c-and" onClick={addQualifier}>
          + and
        </button>
      </p>
      <p className="pt-c-line is-note">
        <span className="pt-c-word">because</span>
        <input
          className="pt-c-blank is-note"
          aria-label="Note"
          placeholder="the read behind it, optional"
          maxLength={280}
          value={draft.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </p>
    </div>
  );
}

function ReadSentence({ target }) {
  return (
    <div className="pt-h-sentence is-read">
      <p className="pt-c-line">
        <span className="pt-c-word">Against</span>
        <b className="pt-h-read is-opp">{target.opponent}</b>
        <span className="pt-c-word">, a player fits when</span>
        {target.qualifiers.map((qualifier, index) => {
          const { label, value } = formatQualifierParts(qualifier);
          return (
            <span className="pt-c-clause" key={index}>
              {index > 0 && <span className="pt-c-word is-and">and</span>}
              <b className="pt-h-read">{label}</b>
              <span className="pt-c-word">is</span>
              <b className="pt-h-read">{value}</b>
              <span className="pt-c-word">{findTargetBase(qualifier.base)?.unit}</span>
            </span>
          );
        })}
      </p>
      {target.note && (
        <p className="pt-c-line is-note">
          <span className="pt-c-word">because</span>
          <span className="pt-h-read is-note">{target.note}</span>
        </p>
      )}
    </div>
  );
}

function SavedBench({ item, read }) {
  const { target } = item;
  return (
    <section className="pt-h-bench">
      <p className="eyebrow">Target · on the bench</p>
      <ReadSentence target={target} />
      <div className="pt-h-actions">
        <span className="pt-h-title">{target.title}</span>
        {target.local ? (
          <small>unsaved · this session only</small>
        ) : (
          <ProtoLink to={`/targets/${target.id}`}>Open · edit there →</ProtoLink>
        )}
      </div>
      <LabEvidence lab={savedLab(read)} />
    </section>
  );
}

function DraftBench({ onSaveNew }) {
  const editor = useDraft();
  const lab = useLab(editor.draft, null, null);
  return (
    <section className="pt-h-bench">
      <p className="eyebrow">Draft Target · the Lab</p>
      <Sentence editor={editor} />
      <div className="pt-h-actions">
        {editor.valid ? (
          <span className="pt-h-title">{deriveTargetTitle(editor.request)}</span>
        ) : (
          <span className="pt-h-title is-pending">{editor.problem}</span>
        )}
        <button
          type="button"
          className="target-primary"
          disabled={!editor.valid}
          onClick={() => onSaveNew(editor.request)}
        >
          Save Target
        </button>
      </div>
      {editor.valid ? <LabEvidence lab={lab} /> : null}
    </section>
  );
}

export default function VariantH({ data }) {
  const { list, items, backtests, saveLocally } = data;
  const [selected, setSelected] = useState(null);
  const current = selected ?? items[0]?.target.id ?? 'new';
  const item = items.find((entry) => entry.target.id === current) || null;

  return (
    <main className="slate-page targets-page pt-h">
      <aside className="pt-h-rail">
        <div className="pt-h-rail-head">
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
        <ul>
          {items.map((entry) => {
            const read = backtests[String(entry.target.id)];
            const record = read?.status === 'ready' ? summarise(read.backtest) : null;
            const lead = record?.columns[0];
            return (
              <li key={entry.target.id}>
                <button
                  type="button"
                  className={`pt-h-item${current === entry.target.id ? ' is-active' : ''}`}
                  aria-current={current === entry.target.id ? 'true' : undefined}
                  onClick={() => setSelected(entry.target.id)}
                >
                  <span className="pt-h-item-opp">{entry.target.opponent}</span>
                  <span className="pt-h-item-quals">
                    {entry.target.qualifiers.map((qualifier, index) => {
                      const { label, value } = formatQualifierParts(qualifier);
                      return (
                        <span key={index}>
                          {label} <b>{value}</b>
                        </span>
                      );
                    })}
                  </span>
                  <span className="pt-h-item-rate">
                    {lead ? (
                      <>
                        <b className={lead.rate >= 0.5 ? 'is-hit' : 'is-miss'}>
                          {percent(lead.rate)}
                        </b>
                        <small>
                          {record.games.length} games · {lead.column}
                        </small>
                      </>
                    ) : (
                      <small>{entry.target.local ? 'unsaved' : 'reading…'}</small>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      {item ? (
        <SavedBench key={current} item={item} read={backtests[String(item.target.id)]} />
      ) : (
        <DraftBench
          key="new"
          onSaveNew={(request) => {
            saveLocally(request);
            setSelected(null);
          }}
        />
      )}
    </main>
  );
}
