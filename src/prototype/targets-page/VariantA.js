/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * A — Ledger. The collection is the page: one dense row per Target, opponent
 * first, then the Qualifiers, the note, and what the day made of it. A row
 * opens in place to show the opponent's readings and the fits, so nothing has
 * to leave the page to be read. The composer is the empty row at the foot of
 * the ledger, the way a sheet grows: press it, fill the same columns, save.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCalendarDate } from '../../calendarDate';
import { TargetContext, TargetFitTable } from '../../targets/TargetFits';
import { deriveTargetTitle, formatQualifier } from '../../targets/targetCatalog';
import {
  GameLine,
  OpponentSelect,
  QualifierChips,
  QualifierFields,
  describeToday,
  fitCount,
  isLive,
  shortDate,
  useDraft,
} from './shared';

export const NAME = 'Ledger';

function LedgerRow({ item, slateDate, open, onToggle }) {
  const { target, entry } = item;
  const fits = fitCount(item);
  return (
    <li className={`pt-a-item${open ? ' is-open' : ''}${isLive(item) ? ' is-live' : ''}`}>
      <button type="button" className="pt-a-row" aria-expanded={open} onClick={onToggle}>
        <span className="pt-a-opp">
          {target.opponent}
          {isLive(item) && <i className="pt-a-dot" aria-hidden="true" />}
        </span>
        <span className="pt-a-quals">
          <QualifierChips target={target} />
        </span>
        <span className="pt-a-note">{target.note || <em>no note</em>}</span>
        <span className={`pt-a-today${fits ? ' has-fits' : ''}${isLive(item) ? '' : ' is-idle'}`}>
          {describeToday(item)}
        </span>
        <span className="pt-a-caret" aria-hidden="true">
          {open ? '–' : '+'}
        </span>
      </button>
      {open && (
        <div className="pt-a-body">
          {entry?.game ? (
            <>
              <div className="pt-a-readings">
                <span className="target-section-heading">
                  How {target.opponent} defends it · <GameLine game={entry.game} />
                </span>
                {target.qualifiers.map((qualifier, index) => (
                  <div className="pt-a-reading" key={index}>
                    <b>{formatQualifier(qualifier)}</b>
                    {entry.context[index] && <TargetContext context={entry.context[index]} />}
                  </div>
                ))}
              </div>
              <div className="pt-a-fits">
                <span className="target-section-heading">
                  Fits · {entry.game.opposingTeam.tricode} players who meet every Qualifier
                </span>
                <TargetFitTable entry={entry} dense />
              </div>
            </>
          ) : (
            <p className="target-empty">
              {target.local
                ? 'Kept for this session only. Nothing was sent to the backend.'
                : `${target.opponent} has no game on ${formatCalendarDate(slateDate)}. The Qualifiers stand; the fits arrive with the next game.`}
            </p>
          )}
          <p className="pt-a-actions">
            {!target.local && <Link to={`/targets/${target.id}`}>Open the Target →</Link>}
            <span>set {shortDate(target.createdAt.slice(0, 10))}</span>
          </p>
        </div>
      )}
    </li>
  );
}

function ComposeRow({ onSave, onCancel }) {
  const { draft, patch, patchQualifier, addQualifier, removeQualifier, valid, problem, request } =
    useDraft();
  return (
    <li className="pt-a-item is-composing">
      <form
        className="pt-a-compose"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSave(request);
        }}
      >
        <OpponentSelect value={draft.opponent} onChange={(opponent) => patch({ opponent })} />
        <div className="pt-a-compose-quals">
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
            + and
          </button>
        </div>
        <input
          className="pt-a-compose-note"
          aria-label="Note"
          placeholder="Why you set this (optional)"
          maxLength={280}
          value={draft.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
        <div className="pt-a-compose-actions">
          <button type="submit" className="target-primary" disabled={!valid}>
            Save
          </button>
          <button type="button" className="target-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p className="pt-a-compose-preview">
          {valid ? (
            <>
              <span>will be titled</span> <b>{deriveTargetTitle(request)}</b>
            </>
          ) : (
            problem
          )}
        </p>
      </form>
    </li>
  );
}

export default function VariantA({ data }) {
  const { list, resolved, items, saveLocally, slateDate } = data;
  /* The first live Target arrives open: the page lands on what the day is
     asking, not on a list of closed rows. */
  const [openId, setOpenId] = useState(undefined);
  const open = openId === undefined ? (items.find(isLive)?.target.id ?? null) : openId;
  const [composing, setComposing] = useState(false);
  const live = items.filter(isLive).length;

  return (
    <main className="slate-page targets-page pt-a">
      <header className="pt-a-head">
        <div>
          <p className="eyebrow">Targets</p>
          <h1>
            {list.status === 'ready'
              ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
              : 'Targets'}
          </h1>
        </div>
        <p className="pt-a-day">
          {slateDate ? (
            <>
              read against <b>{formatCalendarDate(slateDate)}</b>
              <span>
                {live} live · {items.length - live} idle
              </span>
            </>
          ) : resolved.status === 'error' ? (
            'the slate did not resolve'
          ) : (
            'reading the slate…'
          )}
        </p>
      </header>

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}

      <ul className="pt-a-ledger">
        <li className="pt-a-item is-head" aria-hidden="true">
          <span className="pt-a-row">
            <span>Opp</span>
            <span>A player must meet every one</span>
            <span>Why</span>
            <span className="pt-a-today">Today</span>
            <span />
          </span>
        </li>
        {items.map((item) => (
          <LedgerRow
            key={item.target.id}
            item={item}
            slateDate={slateDate}
            open={open === item.target.id}
            onToggle={() => setOpenId(open === item.target.id ? null : item.target.id)}
          />
        ))}
        {composing ? (
          <ComposeRow
            onSave={(request) => {
              saveLocally(request);
              setComposing(false);
            }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <li className="pt-a-item is-new">
            <button type="button" className="pt-a-row" onClick={() => setComposing(true)}>
              <span className="pt-a-opp">+</span>
              <span className="pt-a-new-label">New Target</span>
              <span className="pt-a-note">
                <em>an opponent, then the Qualifiers a player must meet</em>
              </span>
              <span />
              <span />
            </button>
          </li>
        )}
      </ul>
    </main>
  );
}
