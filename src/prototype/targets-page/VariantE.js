/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * E — Season. Time is the page. One shared axis from the first game of the
 * season to the day the page is read, one lane per Target, and every game a
 * qualifying player has played against the opponent is a tick on that lane,
 * coloured by whether it beat the player's own season average. Under the
 * lanes, the receipts: the latest of those games across every Target, newest
 * first. Composing is a small form at the foot.
 */
import { useState } from 'react';
import { QualifierChips, OpponentSelect, QualifierFields, useDraft } from './shared';
import { DEMO_DATE } from './prototypeMode';
import { monthDay, percent, seasonAxis, signedDelta, summarise, toneOf } from './history';
import { deriveTargetTitle } from '../../targets/targetCatalog';

export const NAME = 'Season';

const RECEIPTS = 14;

function Lane({ item, record, axis }) {
  const { target } = item;
  const lead = record?.columns[0];
  // Games on the same date stack, so four players in one game read as four.
  const seen = {};
  return (
    <div className="pt-e-lane">
      <div className="pt-e-lane-label">
        <b>{target.opponent}</b>
        <QualifierChips target={target} />
      </div>
      <div className="pt-e-track">
        {axis.ticks.map((tick) => (
          <i key={tick.date} className="pt-e-gridline" style={{ left: `${tick.at * 100}%` }} />
        ))}
        {record &&
          record.games.map((game, index) => {
            const stack = seen[game.date] || 0;
            seen[game.date] = stack + 1;
            return (
              <i
                key={`${game.player.canonicalId}-${game.date}-${index}`}
                className={`pt-e-tick is-${toneOf(game.delta[lead.column])}`}
                style={{ left: `${axis.position(game.date) * 100}%`, '--stack': stack }}
                title={`${monthDay(game.date)} · ${game.player.name} ${game.stats[lead.column]} ${lead.column} (${signedDelta(game.delta[lead.column])} vs season)`}
              />
            );
          })}
      </div>
      <div className="pt-e-lane-sum">
        {record && lead ? (
          <>
            <b className={lead.rate !== null && lead.rate >= 0.5 ? 'is-hit' : 'is-miss'}>
              {percent(lead.rate)}
            </b>
            <small>
              {lead.hits}/{record.games.length} · {signedDelta(lead.mean)} {lead.column}
            </small>
          </>
        ) : (
          <small>{target.local ? 'unsaved' : 'reading…'}</small>
        )}
      </div>
    </div>
  );
}

function Receipts({ items, backtests }) {
  const rows = items
    .flatMap((item) => {
      const read = backtests[String(item.target.id)];
      if (read?.status !== 'ready') return [];
      const record = summarise(read.backtest);
      return record.games.map((game) => ({ item, record, game }));
    })
    .sort((a, b) => (a.game.date < b.game.date ? 1 : a.game.date > b.game.date ? -1 : 0))
    .slice(0, RECEIPTS);
  if (rows.length === 0) return null;
  return (
    <section className="pt-e-receipts">
      <h2 className="pt-e-section-head">
        <span>Receipts</span>
        <small>the latest {rows.length} games your Targets have produced</small>
      </h2>
      <ol>
        {rows.map(({ item, record, game }, index) => {
          const column = record.primary;
          const delta = game.delta[column];
          return (
            <li key={index} className={`is-${toneOf(delta)}`}>
              <span className="pt-e-r-date">{monthDay(game.date)}</span>
              <span className="pt-e-r-who">
                <b>{game.player.name}</b> <small>{game.player.tricode}</small>
              </span>
              <span className="pt-e-r-line">
                <b>{game.stats[column]}</b> {column}
                <small> vs {game.player.seasonAverages[column].toFixed(1)} season</small>
              </span>
              <span className="pt-e-r-delta">{signedDelta(delta)}</span>
              <span className="pt-e-r-target">
                {item.target.opponent} ·{' '}
                {item.target.title.replace(`${item.target.opponent} vs `, '')}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function FootComposer({ onSave }) {
  const {
    draft,
    patch,
    patchQualifier,
    addQualifier,
    removeQualifier,
    reset,
    valid,
    problem,
    request,
  } = useDraft();
  return (
    <form
      className="pt-e-compose"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onSave(request);
          reset();
        }
      }}
    >
      <span className="target-section-heading">
        New Target · it joins the lanes above once saved
      </span>
      <div className="pt-e-compose-row">
        <OpponentSelect value={draft.opponent} onChange={(opponent) => patch({ opponent })} />
        <div className="pt-e-compose-quals">
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
          placeholder="Why (optional)"
          maxLength={280}
          value={draft.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
        <button type="submit" className="target-primary" disabled={!valid}>
          Save
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
  );
}

export default function VariantE({ data }) {
  const { list, items, backtests, saveLocally, slateDate } = data;
  const [column] = useState(0);
  const end = slateDate || DEMO_DATE;
  const records = Object.fromEntries(
    items.map((item) => {
      const read = backtests[String(item.target.id)];
      return [String(item.target.id), read?.status === 'ready' ? summarise(read.backtest) : null];
    }),
  );
  const dates = Object.values(records)
    .filter(Boolean)
    .flatMap((record) => record.games.map((game) => game.date));
  const axis = seasonAxis(dates, end);
  void column;

  return (
    <main className="slate-page targets-page pt-e">
      <header className="pt-e-head">
        <div>
          <p className="eyebrow">Targets · the season so far</p>
          <h1>
            {list.status === 'ready'
              ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
              : 'Targets'}
          </h1>
        </div>
        <p className="pt-e-key">
          <i className="is-hit" /> beat their season average
          <i className="is-miss" /> fell short
          <i className="is-push" /> landed on it
        </p>
      </header>

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}

      <section className="pt-e-lanes" aria-label="Season timeline">
        <div className="pt-e-lane is-axis" aria-hidden="true">
          <div className="pt-e-lane-label" />
          <div className="pt-e-track">
            {axis.ticks
              .filter((tick) => tick.at < 0.92)
              .map((tick) => (
                <span key={tick.date} className="pt-e-month" style={{ left: `${tick.at * 100}%` }}>
                  {tick.label}
                </span>
              ))}
            <span className="pt-e-now" style={{ left: '100%' }}>
              {monthDay(end)}
            </span>
          </div>
          <div className="pt-e-lane-sum" />
        </div>
        {items.map((item) => (
          <Lane
            key={item.target.id}
            item={item}
            record={records[String(item.target.id)]}
            axis={axis}
          />
        ))}
      </section>

      <Receipts items={items} backtests={backtests} />

      <FootComposer onSave={saveLocally} />
    </main>
  );
}
