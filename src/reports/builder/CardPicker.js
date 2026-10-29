import { useRef, useState } from 'react';
import ReportCard from '../ReportCard';
import { cardLabel } from '../reportText';
import { cardRefusal, previewCard } from './cardsApi';
import GameLogPicker from './GameLogPicker';
import { MatchupPicker, RotationPicker } from './GamePickers';
import { canInsert, hasRoom, LIMITS } from './reportDraft';
import { InjuriesPicker, OnOffPicker } from './TeamPickers';

/*
 * Add card (crf04/statsplus#382): the author picks one of the five card tools,
 * fills in its picker, and the MCP server draws the Card. Only a Card it drew
 * can be inserted; a refusal says why and inserts nothing.
 */

const PICKERS = {
  query_game_logs: { label: 'Game logs', Picker: GameLogPicker },
  get_matchup: { label: 'Matchup', Picker: MatchupPicker },
  get_rotation: { label: 'Rotation', Picker: RotationPicker },
  get_on_off: { label: 'On/off', Picker: OnOffPicker },
  get_injuries: { label: 'Injuries', Picker: InjuriesPicker },
};

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

/* Where a drawn Card goes: a block of its own, or beside a lone card or into a row with room. */
const Insert = ({ draft, dispatch, drawn, onDone }) => {
  const [into, setInto] = useState('');
  const places = draft.blocks
    .map((block, index) => ({ block, place: index + 1 }))
    .filter(({ block }) => hasRoom(block));
  const target = into || null;
  const allowed = canInsert(draft, target);
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
      {!allowed && (
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
  // idle | loading | drawn {call, preview} | refused {refusal}, for the latest request only.
  const [shown, setShown] = useState({ status: 'idle' });
  const latest = useRef(0);

  const preview = async (request) => {
    latest.current += 1;
    const ticket = latest.current;
    setShown({ status: 'loading', request });
    try {
      const drawn = await previewCard(request);
      if (ticket === latest.current) setShown({ status: 'drawn', request, drawn });
    } catch (failure) {
      if (ticket === latest.current) {
        setShown({ status: 'refused', request, refusal: cardRefusal(failure, request.tool) });
      }
    }
  };

  const chooseTool = (next) => {
    latest.current += 1;
    setShown({ status: 'idle' });
    setTool(next);
  };

  const { Picker } = PICKERS[tool];
  const drawn = shown.status === 'drawn' ? shown.drawn : null;
  return (
    <section className="report-edit-item report-pick" aria-label="Add a card">
      <div className="report-edit-item-head">
        <h3>Add a card</h3>
        <button type="button" className="report-build-small" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="report-pick-field">
        <label htmlFor="report-pick-tool">Card</label>
        <select id="report-pick-tool" value={tool} onChange={(e) => chooseTool(e.target.value)}>
          {Object.entries(PICKERS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Picker key={tool} busy={shown.status === 'loading'} onPreview={preview} />
      {shown.status === 'loading' && (
        <p className="report-edit-help" role="status">
          Drawing the card…
        </p>
      )}
      {shown.status === 'refused' && (
        <Refusal
          refusal={shown.refusal}
          onChoose={(choice) => preview(withChoice(shown.request, choice))}
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
          <Insert draft={draft} dispatch={dispatch} drawn={drawn} onDone={onClose} />
        </>
      )}
    </section>
  );
};

export default CardPicker;
