import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoginButton from '../../components/Auth/LoginButton';
import WaitlistBanner from '../../components/Auth/WaitlistBanner';
import { errorCode, publishReport, setPublicHandle } from '../../reportsApi';
import { Count } from '../ReportEditor';
import { FAILED, HANDLE_ERRORS, HandleChooser, LISTING_ERRORS } from '../ReportListing';
import {
  BLOCK_TYPES,
  blockProblem,
  clearDraft,
  draftReducer,
  length,
  LIMITS,
  loadDraft,
  publishBody,
  saveDraft,
  today,
} from './reportDraft';
import '../ReportPage.css';
import './ReportBuilder.css';

/*
 * The Report Builder (crf04/statsplus#382): an author writes a Report on the
 * web, block by block, in plain text with line breaks kept, and publishes it
 * under their own name or none.
 */

const TYPE_LABEL = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  list: 'List',
  callout: 'Callout',
  sources: 'Sources',
};

/* One labelled text field with its character count; the draft refuses text past the limit. */
const Field = ({ id, label, value, limit, onChange, multiline = false, help, type = 'text' }) => {
  const Input = multiline ? 'textarea' : 'input';
  return (
    <div className="report-edit-field report-build-field">
      <div className="report-edit-label-row">
        <label htmlFor={id}>{label}</label>
        <Count id={`${id}-count`} used={length(value)} limit={limit} />
      </div>
      {help && (
        <p className="report-edit-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      <Input
        id={id}
        {...(!multiline && { type })}
        {...(multiline && { rows: 4 })}
        value={value}
        aria-describedby={[help && `${id}-help`, `${id}-count`].filter(Boolean).join(' ')}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};

const Check = ({ id, label, checked, onChange }) => (
  <label className="report-build-check" htmlFor={id}>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    {label}
  </label>
);

const ListFields = ({ block, update }) => {
  const setItems = (items) => update({ items });
  return (
    <>
      <ol className="report-build-rows">
        {block.items.map((item, i) => (
          <li key={i}>
            <Field
              id={`${block.id}-item-${i}`}
              label={`Item ${i + 1}`}
              value={item}
              limit={LIMITS.listItem}
              onChange={(text) => setItems(block.items.map((old, j) => (j === i ? text : old)))}
            />
            <button
              type="button"
              className="report-build-small"
              disabled={block.items.length === 1}
              onClick={() => setItems(block.items.filter((_, j) => j !== i))}
            >
              Remove item {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className="report-build-row-actions">
        <button
          type="button"
          className="report-build-small"
          disabled={block.items.length >= LIMITS.listItems}
          onClick={() => setItems([...block.items, ''])}
        >
          Add item
        </button>
        <Check
          id={`${block.id}-ordered`}
          label="Numbered"
          checked={block.ordered}
          onChange={(ordered) => update({ ordered })}
        />
      </div>
    </>
  );
};

const SourceFields = ({ block, update }) => {
  const setSources = (sources) => update({ sources });
  const setPair = (i, pair) => setSources(block.sources.map((old, j) => (j === i ? pair : old)));
  return (
    <>
      <ol className="report-build-rows">
        {block.sources.map(([fact, url], i) => (
          <li key={i}>
            <Field
              id={`${block.id}-fact-${i}`}
              label={`Source ${i + 1} fact`}
              value={fact}
              limit={LIMITS.fact}
              onChange={(text) => setPair(i, [text, url])}
            />
            <Field
              id={`${block.id}-url-${i}`}
              label={`Source ${i + 1} link`}
              type="url"
              value={url}
              limit={LIMITS.url}
              onChange={(text) => setPair(i, [fact, text])}
            />
            <button
              type="button"
              className="report-build-small"
              disabled={block.sources.length === 1}
              onClick={() => setSources(block.sources.filter((_, j) => j !== i))}
            >
              Remove source {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className="report-build-row-actions">
        <button
          type="button"
          className="report-build-small"
          disabled={block.sources.length >= LIMITS.sources}
          onClick={() => setSources([...block.sources, ['', '']])}
        >
          Add source
        </button>
      </div>
    </>
  );
};

const BlockFields = ({ block, update }) => {
  switch (block.type) {
    case 'heading':
      return (
        <Field
          id={`${block.id}-text`}
          label="Heading"
          value={block.text}
          limit={LIMITS.heading}
          onChange={(text) => update({ text })}
        />
      );
    case 'paragraph':
      return (
        <>
          <Field
            id={`${block.id}-text`}
            label="Text"
            multiline
            value={block.text}
            limit={LIMITS.paragraph}
            onChange={(text) => update({ text })}
          />
          <Check
            id={`${block.id}-lede`}
            label="Lede: the opening that stands out"
            checked={block.lede}
            onChange={(lede) => update({ lede })}
          />
        </>
      );
    case 'list':
      return <ListFields block={block} update={update} />;
    case 'callout':
      return (
        <>
          <Field
            id={`${block.id}-title`}
            label="Title (optional)"
            value={block.title ?? ''}
            limit={LIMITS.calloutTitle}
            onChange={(title) => update({ title })}
          />
          <Field
            id={`${block.id}-text`}
            label="Text"
            multiline
            value={block.text}
            limit={LIMITS.callout}
            onChange={(text) => update({ text })}
          />
          <div className="report-build-tone">
            <label htmlFor={`${block.id}-tone`}>Tone</label>
            <select
              id={`${block.id}-tone`}
              value={block.tone}
              onChange={(event) => update({ tone: event.target.value })}
            >
              <option value="plain">Plain</option>
              <option value="warn">Warning</option>
            </select>
          </div>
        </>
      );
    case 'sources':
      return <SourceFields block={block} update={update} />;
    default:
      return null;
  }
};

const BlockEditor = ({ block, place, total, dispatch, showProblem }) => {
  const name = `Block ${place + 1}: ${TYPE_LABEL[block.type]}`;
  const problem = showProblem ? blockProblem(block) : null;
  return (
    <section
      className="report-edit-item report-build-block"
      aria-label={name}
      data-block={block.id}
    >
      <div className="report-edit-item-head">
        <h3>{TYPE_LABEL[block.type]}</h3>
        <span className="report-edit-card-actions">
          <button
            type="button"
            className="report-edit-move"
            data-action="up"
            aria-label={`Move ${name} up`}
            title="Move up"
            disabled={place === 0}
            onClick={() => dispatch({ type: 'move', id: block.id, step: -1 })}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="report-edit-move"
            data-action="down"
            aria-label={`Move ${name} down`}
            title="Move down"
            disabled={place === total - 1}
            onClick={() => dispatch({ type: 'move', id: block.id, step: 1 })}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button type="button" onClick={() => dispatch({ type: 'remove', id: block.id })}>
            Delete <span className="visually-hidden">{name}</span>
          </button>
        </span>
      </div>
      <BlockFields
        block={block}
        update={(patch) => dispatch({ type: 'update', id: block.id, patch })}
      />
      {problem && (
        <p className="report-edit-error" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
};

const PublishDialog = ({ draft, dispatch, onCancel, onPublished }) => {
  const [showAuthor, setShowAuthor] = useState(false);
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [handleRefusal, setHandleRefusal] = useState(null);
  const titleRef = useRef(null);
  const date = draft.date ?? today();

  useEffect(() => {
    titleRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const publish = async () => {
    try {
      const { id } = await publishReport(publishBody(draft, { date, showAuthor, listed }));
      onPublished(id);
    } catch (failure) {
      const code = errorCode(failure);
      if (listed && code === 'handle_required') setChoosing(true);
      else setRefusal(LISTING_ERRORS[code] ?? FAILED);
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setBusy(true);
    setRefusal(null);
    publish();
  };

  const chooseHandle = async (handle) => {
    setBusy(true);
    setHandleRefusal(null);
    try {
      await setPublicHandle(handle);
    } catch (failure) {
      const code = errorCode(failure);
      // Set meanwhile (another tab): publish under the handle the account has.
      if (code !== 'handle_already_set') {
        setHandleRefusal(HANDLE_ERRORS[code] ?? FAILED);
        setBusy(false);
        return;
      }
    }
    setChoosing(false);
    await publish();
  };

  return (
    <div className="report-build-backdrop">
      <div
        className="report-build-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-build-dialog-title"
      >
        <h2 id="report-build-dialog-title">Publish your report</h2>
        <p className="report-edit-help">
          Once published, its text is frozen. You can still rename it, hide blocks, or delete it.
        </p>
        {choosing ? (
          <HandleChooser
            busy={busy}
            refusal={handleRefusal}
            submitLabel="Save and publish"
            busyLabel="Publishing…"
            onSubmit={chooseHandle}
            onCancel={() => setChoosing(false)}
          />
        ) : (
          <form onSubmit={submit}>
            <fieldset className="report-edit-draft" disabled={busy}>
              <div className="report-edit-field">
                <div className="report-edit-label-row">
                  <label htmlFor="report-build-title">Title</label>
                  <Count
                    id="report-build-title-count"
                    used={length(draft.title)}
                    limit={LIMITS.title}
                  />
                </div>
                <input
                  id="report-build-title"
                  ref={titleRef}
                  type="text"
                  required
                  value={draft.title}
                  aria-describedby="report-build-title-count"
                  onChange={(event) => dispatch({ type: 'meta', title: event.target.value })}
                />
              </div>
              <div className="report-edit-field report-build-date">
                <label htmlFor="report-build-date">Date</label>
                <input
                  id="report-build-date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => dispatch({ type: 'meta', date: event.target.value })}
                />
              </div>
              <Check
                id="report-build-show-author"
                label="Show my name"
                checked={showAuthor}
                onChange={setShowAuthor}
              />
              <Check
                id="report-build-listed"
                label="List in Research"
                checked={listed}
                onChange={(on) => {
                  setListed(on);
                  setRefusal(null);
                }}
              />
              <p className="report-edit-help">
                {listed
                  ? 'Listed: anyone can find it in Research, under your public handle.'
                  : 'Unlisted: only people with the link can open it.'}
              </p>
            </fieldset>
            {refusal && (
              <p className="report-edit-error" role="alert">
                {refusal}
              </p>
            )}
            <div className="report-edit-buttons">
              <button
                type="button"
                className="report-handle-cancel"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="report-listing-button"
                disabled={busy || !draft.title.trim() || !date}
              >
                {busy ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Builder = () => {
  const navigate = useNavigate();
  const [draft, dispatch] = useReducer(draftReducer, undefined, loadDraft);
  const [publishing, setPublishing] = useState(false);
  const [tried, setTried] = useState(false);
  const published = useRef(false);
  const closeDialog = useCallback(() => setPublishing(false), []);

  useEffect(() => {
    if (!published.current) saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    document.title = 'Write a report | CourtAI';
  }, []);

  const ready = draft.blocks.length > 0 && draft.blocks.every((block) => !blockProblem(block));
  const full = draft.blocks.length >= LIMITS.blocks;

  const discard = () => {
    if (!window.confirm('Discard this draft? Everything in it will be deleted.')) return;
    setTried(false);
    dispatch({ type: 'discard' });
  };

  const onPublished = (id) => {
    published.current = true;
    clearDraft();
    navigate(`/reports/${encodeURIComponent(id)}`);
  };

  return (
    <div className="report-editor report-builder">
      <div className="report-edit-intro">
        <p className="report-eyebrow">Report Builder</p>
        <h1>Write a report</h1>
        <p>
          Plain text, with your line breaks kept. Your draft stays in this browser until you publish
          or discard it.
        </p>
      </div>

      {draft.blocks.map((block, place) => (
        <BlockEditor
          key={block.id}
          block={block}
          place={place}
          total={draft.blocks.length}
          dispatch={dispatch}
          showProblem={tried}
        />
      ))}

      <div className="report-build-add" role="group" aria-label="Add a block">
        {BLOCK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="report-build-small"
            disabled={full}
            onClick={() => dispatch({ type: 'add', block: type })}
          >
            Add {TYPE_LABEL[type].toLowerCase()}
          </button>
        ))}
        {full && <p className="report-edit-help">A report holds at most {LIMITS.blocks} blocks.</p>}
      </div>

      <div className="report-edit-actions">
        {tried && !ready && (
          <p className="report-edit-error" role="alert">
            {draft.blocks.length
              ? 'Finish or delete the blocks marked above, then publish.'
              : 'Add at least one block, then publish.'}
          </p>
        )}
        <div className="report-edit-buttons">
          <button type="button" className="report-handle-cancel" onClick={discard}>
            Discard draft
          </button>
          <button
            type="button"
            className="report-listing-button"
            onClick={() => (ready ? setPublishing(true) : setTried(true))}
          >
            Publish…
          </button>
        </div>
      </div>

      {publishing && (
        <PublishDialog
          draft={draft}
          dispatch={dispatch}
          onCancel={closeDialog}
          onPublished={onPublished}
        />
      )}
    </div>
  );
};

/* `/reports/new`: active accounts write; a waitlisted one hears why not; a visitor signs in. */
const ReportBuilderPage = () => {
  const { isAuthenticated, waitlist } = useAuth();
  return (
    <main className="report-page">
      {!isAuthenticated ? (
        <div className="report-status">
          <p className="report-eyebrow">Report Builder</p>
          <h1>Sign in to write a report</h1>
          <p>Publishing a report needs a CourtAI account.</p>
          <LoginButton size="sm" />
        </div>
      ) : waitlist ? (
        <WaitlistBanner />
      ) : (
        <Builder />
      )}
    </main>
  );
};

export default ReportBuilderPage;
