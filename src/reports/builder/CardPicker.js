import { useCallback, useEffect, useRef, useState } from 'react';
import ReportCard from '../ReportCard';
import { cardLabel } from '../reportText';
import { cardRefusal, previewCardRetrying } from './cardsApi';
import GameLogPicker from './GameLogPicker';
import { MatchupPicker, RotationPicker } from './GamePickers';
import { requestKey } from './pickerParts';
import { canInsert, hasRoom, LIMITS } from './reportDraft';
import { InjuriesPicker, OnOffPicker } from './TeamPickers';

/*
 * Add card (crf04/statsplus#382): the author picks one of the five card tools,
 * fills in its picker, and the MCP server draws the Card. Only a Card it drew
 * can be inserted; a refusal says why and inserts nothing.
 */

const PICKERS = {
  query_game_logs: {
    label: 'Game logs',
    Picker: GameLogPicker,
    needs: 'Choose a player to see the card.',
  },
  get_matchup: {
    label: 'Matchup',
    Picker: MatchupPicker,
    needs: 'Choose a game and a player to see the card.',
  },
  get_rotation: {
    label: 'Rotation',
    Picker: RotationPicker,
    needs: 'Choose a team and a finished game to see the card.',
  },
  get_on_off: {
    label: 'On/off',
    Picker: OnOffPicker,
    needs: 'Choose a team and a player on or off the floor to see the card.',
  },
  get_injuries: {
    label: 'Injuries',
    Picker: InjuriesPicker,
    needs: 'Choose a date to see the card.',
  },
};

/*
 * The Card draws itself once the choices have stayed put this long
 * (crf04/statsplus#406): previews count against the author's CourtAI limits,
 * so typing a line or stepping a slider sends one preview, not one per change.
 */
export const SETTLE_MS = 800;

// While a preview with part of its data unavailable waits to be drawn once more.
export const STILL_FETCHING = 'Still fetching part of this Card…';

/* What a refused preview or publish tells the author. */
export const refusalText = (refusal) =>
  refusal?.text ?? 'CourtAI couldn’t draw this Card. Try again.';

/* The request with a needs_choice answer in place of the player it asked about. */
const withChoice = (request, choice) => {
  if (request.filter_set) {
    return { ...request, filter_set: { ...request.filter_set, player_name: choice } };
  }
  const { args } = request;
  if (request.tool === 'get_on_off') {
    const asked = choice.replace(/\s*\([^)]*\)$/, '');
    const swap = (names) => names?.map((name) => (name === asked ? choice : name));
    return { ...request, args: { ...args, on: swap(args.on), off: swap(args.off) } };
  }
  return { ...request, args: { ...args, player: choice } };
};

const Refusal = ({ refusal, onChoose }) => (
  <div className="report-edit-error report-pick-refusal" role="alert">
    <p>{refusalText(refusal)}</p>
    {refusal?.choices.length > 0 && (
      <div className="report-build-row-actions" role="group" aria-label="Choose one">
        {refusal.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className="report-build-small"
            onClick={() => onChoose(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
    )}
  </div>
);

/* Why a drawn Card can't go in a Report yet, with a way to draw it again. */
export const Unpublishable = ({ refusal, onPreview, busy = false }) => (
  <div className="report-edit-error report-pick-refusal" role="alert">
    <p>{refusalText(refusal)}</p>
    <button type="button" className="report-build-small" disabled={busy} onClick={onPreview}>
      {busy ? 'Drawing…' : 'Preview again'}
    </button>
  </div>
);

/* Where a drawn Card goes: a block of its own, or beside a lone card or into a row with room. */
const Insert = ({ draft, dispatch, drawn, stale, onDone }) => {
  const [into, setInto] = useState('');
  const places = draft.blocks
    .map((block, index) => ({ block, place: index + 1 }))
    .filter(({ block }) => hasRoom(block));
  const target = into || null;
  const allowed = !stale && drawn.preview.publishable && canInsert(draft, target);
  return (
    <div className="report-pick-insert">
      <div className="report-pick-field">
        <label htmlFor="report-pick-place">Place</label>
        <select id="report-pick-place" value={into} onChange={(e) => setInto(e.target.value)}>
          <option value="">As its own block</option>
          {places.map(({ block, place }) => (
            <option key={block.id} value={block.id}>
              {block.type === 'card'
                ? `Beside the card in block ${place}`
                : `In the row in block ${place}`}
            </option>
          ))}
        </select>
      </div>
      {drawn.preview.publishable && !allowed && (
        <p className="report-edit-help">
          {draft.calls.length >= LIMITS.calls
            ? `A report holds at most ${LIMITS.calls} cards.`
            : `A report holds at most ${LIMITS.blocks} blocks.`}
        </p>
      )}
      <button
        type="button"
        className="report-listing-button"
        disabled={!allowed}
        onClick={() => {
          dispatch({ type: 'insertCard', call: drawn.call, preview: drawn.preview, into: target });
          onDone();
        }}
      >
        Insert card
      </button>
    </div>
  );
};

const CardPicker = ({ draft, dispatch, onClose }) => {
  const [tool, setTool] = useState('query_game_logs');
  // idle | loading | retrying | drawn {call, preview} | refused {refusal}, for the latest request
  // only; `from` is the key of the picker request it answers.
  const [shown, setShown] = useState({ status: 'idle' });
  // The picker's current request and its key, or null while its choices make none.
  const [wanted, setWanted] = useState(null);
  const latest = useRef(0);
  // The key of the request drawn or drawing, which is not sent again.
  const sent = useRef(null);
  // The latest preview's second try, cancelled by any edit to its choices.
  const retry = useRef(new AbortController());
  // Closing the picker abandons the latest request, and with it any retry.
  useEffect(
    () => () => {
      latest.current += 1;
      retry.current.abort();
    },
    [],
  );

  const preview = useCallback(async (request, from) => {
    latest.current += 1;
    const ticket = latest.current;
    const current = () => ticket === latest.current;
    retry.current.abort();
    retry.current = new AbortController();
    sent.current = from;
    setShown({ status: 'loading', request, from });
    try {
      const drawn = await previewCardRetrying(request, {
        signal: retry.current.signal,
        onRetry: () => setShown({ status: 'retrying', request, from }),
      });
      if (current()) setShown({ status: 'drawn', request, from, drawn });
    } catch (failure) {
      if (current()) {
        sent.current = null;
        setShown({ status: 'refused', request, from, refusal: cardRefusal(failure, request.tool) });
      }
    }
  }, []);

  const abandon = useCallback(() => {
    latest.current += 1;
    retry.current.abort();
    sent.current = null;
    setShown({ status: 'idle' });
  }, []);

  const onRequest = useCallback(
    (request) => setWanted(request && { request, key: requestKey(request) }),
    [],
  );
  useEffect(() => {
    if (!wanted) {
      abandon();
      return undefined;
    }
    if (wanted.key === sent.current) return undefined;
    const timer = setTimeout(() => preview(wanted.request, wanted.key), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [wanted, preview, abandon]);

  const chooseTool = (next) => {
    abandon();
    setTool(next);
  };

  const { Picker, needs } = PICKERS[tool];
  const drawn = shown.status === 'drawn' ? shown.drawn : null;
  const busy = shown.status === 'loading' || shown.status === 'retrying';
  // Choices changed since the Card shown, which redraws once they settle.
  const settling = Boolean(wanted) && wanted.key !== shown.from;
  return (
    <section
      className="report-edit-item report-pick"
      aria-label="Add a card"
      // Choices edited after a preview no longer match it, so it is not tried again.
      onChangeCapture={() => retry.current.abort()}
    >
      <div className="report-edit-item-head">
        <h3>Add a card</h3>
        <button type="button" className="report-build-small" onClick={onClose}>
          Cancel
        </button>
      </div>
      <fieldset className="report-pick-pills">
        <legend>Card</legend>
        {Object.entries(PICKERS).map(([value, { label }]) => (
          <label key={value} className={value === tool ? 'is-on' : undefined}>
            <input
              type="radio"
              name="report-pick-tool"
              checked={value === tool}
              onChange={() => chooseTool(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="report-pick-split">
        <div className="report-pick-form">
          <Picker key={tool} onRequest={onRequest} />
        </div>
        <div className="report-pick-pane">
          {!wanted && shown.status === 'idle' && <p className="report-edit-help">{needs}</p>}
          {(busy || settling) && (
            <p className="report-edit-help" role="status">
              {shown.status === 'retrying' ? STILL_FETCHING : 'Drawing the card…'}
            </p>
          )}
          {shown.status === 'refused' && (
            <Refusal
              refusal={shown.refusal}
              onChoose={(choice) => preview(withChoice(shown.request, choice), shown.from)}
            />
          )}
          {drawn && (
            <>
              <figure className="report-block-card report-pick-preview">
                <ReportCard
                  html={drawn.preview.html}
                  call={drawn.preview}
                  label={cardLabel({ tool: drawn.call.tool, structured: drawn.preview.structured })}
                />
              </figure>
              {drawn.preview.unpublishable && (
                <Unpublishable
                  refusal={drawn.preview.unpublishable}
                  onPreview={() => preview(shown.request, shown.from)}
                />
              )}
              <Insert
                draft={draft}
                dispatch={dispatch}
                drawn={drawn}
                stale={settling}
                onDone={onClose}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default CardPicker;
