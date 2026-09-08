/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * G — Sheet. The page is the criteria. Every Target is a section whose header
 * is its Qualifiers, read-only; the Backtest is the evidence beneath each.
 * Only a new Target is composed here, and that is where the Lab is: the same
 * section, empty, at the top, re-reading as the draft moves. Editing a saved
 * Target happens on its own page. Nothing about today is on this page.
 */
import { useState } from 'react';
import { LabEvidence, savedLab, useLab } from './lab';
import { formatObservedShare } from '../../targets/targetCatalog';
import { ConditionsEditor } from './conditions';
import { isLive } from './shared';
import {
  AddMenu,
  OpponentSelect,
  ProtoLink,
  QualifierChips,
  QualifierFields,
  TodayIndicator,
  useDraft,
} from './shared';

export const NAME = 'Sheet';

function Criteria({ editor }) {
  const { draft, patch, patchQualifier, addQualifier, removeQualifier } = editor;
  return (
    <div className="pt-g-criteria">
      <OpponentSelect big value={draft.opponent} onChange={(opponent) => patch({ opponent })} />
      <div className="pt-g-quals">
        {draft.qualifiers.map((qualifier, index) => (
          <QualifierFields
            key={index}
            qualifier={qualifier}
            index={index}
            onPatch={(fields) => patchQualifier(index, fields)}
            onRemove={draft.qualifiers.length > 1 ? () => removeQualifier(index) : null}
          />
        ))}
      </div>
      <ConditionsEditor
        opponent={draft.opponent}
        conditions={draft.conditions}
        onChange={editor.patchConditions}
        addSlot={(adders) => <AddMenu onQualifier={addQualifier} conditions={adders} />}
      />
      <label className="pt-g-note">
        <span className="target-label">Why</span>
        <input
          value={draft.note}
          placeholder="optional, never the title"
          maxLength={280}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </label>
    </div>
  );
}

function ReadCriteria({ target }) {
  return (
    <div className="pt-g-criteria is-read">
      <span className="pt-g-opp">{target.opponent}</span>
      <div className="pt-g-quals">
        <QualifierChips target={target} />
        {target.note && <p className="pt-g-why">{target.note}</p>}
      </div>
    </div>
  );
}

/* Who fits tonight: the opposing players meeting every Qualifier, with the
   share that got them in. One line on the card; the Matchup has the rest. */
function FitsTonight({ entry }) {
  if (!entry?.game) return null;
  const { availability, players, game } = entry;
  return (
    <div className="pt-g-fits">
      <span className="target-label">
        Playing tonight · {game.opposingTeam.tricode}
        {availability.status === 'available' && (
          <b className={players.length ? ' has-fits' : ''}> {players.length} fit</b>
        )}
      </span>
      {availability.status !== 'available' ? (
        <span className="pt-g-fits-empty">pool unavailable</span>
      ) : players.length === 0 ? (
        <span className="pt-g-fits-empty">nobody meets every Qualifier</span>
      ) : (
        <ul>
          {players.map((player) => (
            <li key={player.canonicalId} className={player.thin ? 'is-thin' : undefined}>
              <b>{player.name}</b>
              <small>
                {player.shares.map((share) => formatObservedShare(share.share)).join(' · ')}
                {player.seasonScoring !== null && ` · ${player.seasonScoring.toFixed(1)} ppg`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TargetSection({ item, read }) {
  const { target } = item;
  return (
    <section className="pt-g-section">
      <header className="pt-g-head">
        <ReadCriteria target={target} />
        <div className="pt-g-actions">
          <TodayIndicator entry={item.entry} />
          {target.local ? (
            <small>unsaved · this session only</small>
          ) : (
            <ProtoLink to={`/targets/${target.id}`}>View Details / Edit</ProtoLink>
          )}
        </div>
      </header>
      <FitsTonight entry={item.entry} />
      <LabEvidence lab={savedLab(read)} games={false} boxId={target.id} />
    </section>
  );
}

function DraftSection({ onSave, onClose }) {
  const editor = useDraft();
  const lab = useLab(editor.draft, null, null);
  return (
    <section className="pt-g-section is-draft">
      <p className="eyebrow">Draft Target</p>
      <header className="pt-g-head">
        <Criteria editor={editor} />
        <div className="pt-g-actions">
          <button
            type="button"
            className="target-primary"
            disabled={!editor.valid}
            onClick={() => {
              onSave({ ...editor.request, conditions: editor.draft.conditions });
              editor.reset();
              onClose();
            }}
          >
            Save Target
          </button>
          <button type="button" className="target-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </header>
      {editor.valid ? <LabEvidence lab={lab} /> : <p className="pt-lab-line">{editor.problem}</p>}
    </section>
  );
}

export default function VariantG({ data }) {
  const { list, items, backtests, saveLocally } = data;
  const [composing, setComposing] = useState(false);
  const live = items.filter(isLive).length;
  return (
    <main className="slate-page targets-page pt-g">
      <header className="pt-g-page-head">
        <div>
          <p className="eyebrow">Targets</p>
          <p className="pt-g-active">
            {list.status !== 'ready'
              ? 'Loading…'
              : data.resolved.status !== 'ready'
                ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
                : live === 0
                  ? 'No Targets active today'
                  : `${live} ${live === 1 ? 'Target' : 'Targets'} active today`}
          </p>
        </div>
        <button
          type="button"
          className={`pt-b-new${composing ? ' is-active' : ''}`}
          aria-expanded={composing}
          onClick={() => setComposing(!composing)}
        >
          + New Target
        </button>
      </header>

      {composing && <DraftSection onSave={saveLocally} onClose={() => setComposing(false)} />}

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}
      <div className="pt-g-grid">
        {items.map((item) => (
          <TargetSection
            key={item.target.id}
            item={item}
            read={backtests[String(item.target.id)]}
          />
        ))}
      </div>
    </main>
  );
}
