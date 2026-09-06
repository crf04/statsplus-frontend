/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * C — Board. The day comes first: every Target with a game is a scoreboard
 * tile — opponent, fit count, the fits by name — and the Targets with no game
 * wait underneath as one quiet line each. The composer is a sentence with
 * blanks in it, so writing a Target reads the way its title will.
 */
import { formatCalendarDate } from '../../calendarDate';
import {
  TARGET_BASES,
  TARGET_COMPARATORS,
  TARGET_SLICES,
  comparatorSymbol,
  deriveTargetTitle,
  findTargetBase,
  formatObservedShare,
  formatQualifierParts,
} from '../../targets/targetCatalog';
import { GameLine, ProtoLink, QualifierChips, isLive, useDraft } from './shared';
import { NBA_TEAM_TRICODES } from '../../targets/targetCatalog';

export const NAME = 'Board';

const SHOWN_FITS = 6;

function SentenceComposer({ onSave }) {
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
  const flip = (qualifier) =>
    qualifier.comparator === TARGET_COMPARATORS[0].key
      ? TARGET_COMPARATORS[1].key
      : TARGET_COMPARATORS[0].key;
  return (
    <form
      className="pt-c-sentence"
      aria-label="New Target"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onSave(request);
          reset();
        }
      }}
    >
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
            <input
              className="pt-c-blank is-num"
              type="number"
              min="0"
              max="100"
              step="any"
              placeholder="__"
              aria-label={`Qualifier ${index + 1} threshold percent`}
              value={qualifier.thresholdPercent}
              onChange={(event) => patchQualifier(index, { thresholdPercent: event.target.value })}
            />
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
      <div className="pt-c-foot">
        <span className={`pt-c-preview${valid ? '' : ' is-pending'}`}>
          {valid ? deriveTargetTitle(request) : problem}
        </span>
        <button type="submit" className="target-primary" disabled={!valid}>
          Set Target
        </button>
      </div>
    </form>
  );
}

function Tile({ item }) {
  const { target, entry } = item;
  const { game, availability, players } = entry;
  const shown = players.slice(0, SHOWN_FITS);
  return (
    <li className="pt-c-tile">
      <div className="pt-c-tile-head">
        <span className="pt-c-tile-opp">{target.opponent}</span>
        {availability.status === 'available' ? (
          <span className={`pt-c-tile-count${players.length ? '' : ' is-zero'}`}>
            <b>{players.length}</b>
            <small>fit</small>
          </span>
        ) : (
          <span className="pt-c-tile-count is-zero">
            <small>pool unavailable</small>
          </span>
        )}
      </div>
      <GameLine game={game} />
      <div className="pt-c-tile-quals">
        <QualifierChips target={target} />
      </div>
      {shown.length > 0 && (
        <ol className="pt-c-fits">
          {shown.map((player) => (
            <li key={player.canonicalId} className={player.thin ? 'is-thin' : undefined}>
              <span className="pt-c-fit-name">{player.name}</span>
              <span className="pt-c-fit-shares">
                {player.shares.map((share, index) => (
                  <b key={index} title={formatQualifierParts(target.qualifiers[index]).label}>
                    {formatObservedShare(share.share)}
                  </b>
                ))}
              </span>
              <small>{player.seasonScoring === null ? '—' : player.seasonScoring.toFixed(1)}</small>
            </li>
          ))}
          {players.length > SHOWN_FITS && (
            <li className="pt-c-fit-more">+{players.length - SHOWN_FITS} more</li>
          )}
        </ol>
      )}
      {availability.status === 'available' && players.length === 0 && (
        <p className="target-empty">No {game.opposingTeam.tricode} player meets every Qualifier.</p>
      )}
      {target.note && <p className="pt-c-tile-note">{target.note}</p>}
      <ProtoLink className="pt-c-tile-go" to={`/targets/${target.id}`}>
        Open →
      </ProtoLink>
    </li>
  );
}

export default function VariantC({ data }) {
  const { list, resolved, items, saveLocally, slateDate } = data;
  const live = items.filter(isLive);
  const idle = items.filter((item) => !isLive(item));

  return (
    <main className="slate-page targets-page pt-c">
      <header className="pt-c-head">
        <p className="eyebrow">Targets</p>
        <h1>
          {list.status === 'ready'
            ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
            : 'Targets'}
        </h1>
      </header>

      <SentenceComposer onSave={saveLocally} />

      <section className="pt-c-section">
        <h2 className="pt-c-section-head">
          <span>Today</span>
          <small>{slateDate ? formatCalendarDate(slateDate) : '…'}</small>
        </h2>
        {resolved.status === 'loading' && <p role="status">Reading the slate…</p>}
        {resolved.status === 'error' && <p role="alert">{resolved.error}</p>}
        {resolved.status === 'ready' &&
          (live.length === 0 ? (
            <p className="target-empty">None of your Targets has a game on this date.</p>
          ) : (
            <ul className="pt-c-tiles">
              {live.map((item) => (
                <Tile key={item.target.id} item={item} />
              ))}
            </ul>
          ))}
      </section>

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}
      {idle.length > 0 && (
        <section className="pt-c-section">
          <h2 className="pt-c-section-head">
            <span>Waiting</span>
            <small>
              {idle.length} with no game {slateDate ? 'on this date' : 'today'}
            </small>
          </h2>
          <ul className="pt-c-idle">
            {idle.map(({ target }) => (
              <li key={target.id}>
                {target.local ? (
                  <span className="pt-c-idle-row">
                    <b>{target.opponent}</b>
                    <QualifierChips target={target} />
                    <em>{target.note || 'unsaved · this session only'}</em>
                  </span>
                ) : (
                  <ProtoLink className="pt-c-idle-row" to={`/targets/${target.id}`}>
                    <b>{target.opponent}</b>
                    <QualifierChips target={target} />
                    <em>{target.note}</em>
                    <span aria-hidden="true">→</span>
                  </ProtoLink>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
