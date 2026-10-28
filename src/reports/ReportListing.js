import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSignUpThen } from '../components/Auth/useSignUpThen';
import { useFeedback } from '../feedback/useFeedback';
import { errorCode, setPublicHandle, setReportListed } from '../reportsApi';
import { authorPath, editedDate, publishedLine, staleDays } from '../research/researchFormat';

/*
 * "Published …, data as of …", "Edited <date>" once its author has edited it,
 * and a badge once the report is more than three days old. An edit never
 * changes the data, so the age still runs from publication.
 */
export const Published = ({ createdAt, editedAt = null }) => {
  const days = staleDays(createdAt);
  return (
    <p className="report-published">
      <time dateTime={createdAt}>{publishedLine(createdAt)}</time>
      {editedAt && (
        <span className="report-edited">
          Edited <time dateTime={editedAt}>{editedDate(editedAt)}</time>
        </span>
      )}
      {days !== null && <span className="report-stale">{days} days old</span>}
    </p>
  );
};

/* Who shared a listed report, and whose view it is. */
export const SharedBy = ({ handle }) => (
  <p className="report-shared">
    Shared by <Link to={authorPath(handle)}>@{handle}</Link>. CourtAI reports facts; this is the
    author&apos;s view.
  </p>
);

/*
 * "Report this" opens the Feedback popover about this report; the page's
 * address it sends names the report. A signed-out visitor signs in first and
 * lands back here with the popover open.
 */
export const ReportThis = ({ reportId }) => {
  const feedback = useFeedback();
  const open = useSignUpThen('report-this', (id) => feedback?.openFeedback({ report: id }));
  return (
    <button
      type="button"
      className="feedback-report-link report-flag"
      onClick={(event) =>
        feedback
          ? feedback.openFeedback({ report: reportId, opener: event.currentTarget })
          : open(reportId)
      }
    >
      Report this
    </button>
  );
};

const LISTING_ERRORS = {
  listed_limit: 'You have listed 5 reports in the last 24 hours. Try again later.',
};
const HANDLE_ERRORS = {
  invalid_handle: 'Use 3–20 lowercase letters, numbers or underscores.',
  handle_taken: 'That handle is taken. Try another.',
};
const FAILED = 'That didn’t go through. Try again.';

/* The handle chooser a first listing opens: one field, set once. */
const HandleChooser = ({ busy, refusal, onSubmit, onCancel }) => {
  const [value, setValue] = useState('');
  const handle = value.trim().replace(/^@+/, '').toLowerCase();
  return (
    <form
      className="report-handle"
      onSubmit={(event) => {
        event.preventDefault();
        if (handle) onSubmit(handle);
      }}
    >
      <label htmlFor="report-handle-input">Choose your public handle</label>
      <p className="report-handle-help">
        Listed reports show it, and your author page lives at courtai.app/research/@
        {handle || 'handle'}. 3–20 letters, numbers or underscores; it can&apos;t be changed here
        later.
      </p>
      <div className="report-handle-row">
        <span className={`report-handle-field${refusal ? ' is-bad' : ''}`}>
          <span aria-hidden="true">@</span>
          <input
            id="report-handle-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={21}
            value={value}
            aria-invalid={Boolean(refusal)}
            aria-describedby={refusal ? 'report-handle-error' : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
        </span>
        <button type="submit" className="report-listing-button" disabled={!handle || busy}>
          {busy ? 'Listing…' : 'Save and list'}
        </button>
        <button type="button" className="report-handle-cancel" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {refusal && (
        <p className="report-handle-error" id="report-handle-error" role="alert">
          {refusal}
        </p>
      )}
    </form>
  );
};

const LISTED_HELP = 'Listed in Research. Anyone can find it there, under your handle.';
const UNLISTED_HELP = 'Unlisted. Only people with the link can open it.';

const PATHS = {
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  globe:
    'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
};

const Icon = ({ name }) => (
  <svg className="report-tools-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === 'more' ? (
      [5, 12, 19].map((cy) => <circle key={cy} cx="12" cy={cy} r="1.6" fill="currentColor" />)
    ) : (
      <path
        d={PATHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

/*
 * The author's toolbar on the byline row: whether the report is listed, Edit,
 * List/Unlist, and a ⋮ menu holding Delete. List opens a short explanation
 * first; listing without a public handle then asks for one in place.
 * `onChanged` reloads the report so the page shows what is now public.
 */
export const AuthorTools = ({
  report,
  onChanged,
  canEdit,
  editRef,
  onEdit,
  onDelete,
  deleting,
}) => {
  const { waitlist } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // null | 'list' | 'more'
  const [choosing, setChoosing] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [handleRefusal, setHandleRefusal] = useState(null);
  const group = useRef(null);
  const listButton = useRef(null);
  const moreButton = useRef(null);
  const deleteItem = useRef(null);
  const dialog = useRef(null);
  // Where focus goes once a popup closes: its opener, as soon as it is enabled again.
  const pendingFocus = useRef(null);
  // A waitlisted account cannot list, but can always take a listed report down.
  const canList = report.listed || !waitlist;

  const close = useCallback((focus) => {
    setOpen(null);
    setChoosing(false);
    setHandleRefusal(null);
    pendingFocus.current = focus ?? null;
  }, []);

  useEffect(() => {
    const target = pendingFocus.current?.current;
    if (target && !target.disabled) {
      target.focus();
      pendingFocus.current = null;
    }
  });

  // Keyboard users land in the List popup, and on the handle field once it asks for one.
  useEffect(() => {
    if (open !== 'list') return;
    if (choosing) group.current?.querySelector('#report-handle-input')?.focus();
    else dialog.current?.focus();
  }, [open, choosing]);

  useEffect(() => {
    if (!open) return undefined;
    // A newer popup owns focus now; an older close must not pull it back.
    pendingFocus.current = null;
    if (open === 'more') deleteItem.current?.focus();
    const opener = open === 'more' ? moreButton : listButton;
    const onPointerDown = (event) => {
      if (!group.current?.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(opener);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const list = async (listed) => {
    try {
      await setReportListed(report.id, listed);
    } catch (failure) {
      const code = errorCode(failure);
      if (listed && code === 'handle_required') {
        setChoosing(true);
        return;
      }
      close(listButton);
      setRefusal(LISTING_ERRORS[code] ?? FAILED);
      return;
    }
    close(listButton);
    await onChanged();
  };

  const run = async (listed) => {
    setBusy(true);
    setRefusal(null);
    await list(listed);
    setBusy(false);
  };

  const chooseHandle = async (handle) => {
    setBusy(true);
    setHandleRefusal(null);
    setRefusal(null);
    try {
      await setPublicHandle(handle);
    } catch (failure) {
      const code = errorCode(failure);
      // Set meanwhile (another tab): list under the handle the account has.
      if (code !== 'handle_already_set') {
        setHandleRefusal(HANDLE_ERRORS[code] ?? FAILED);
        setBusy(false);
        return;
      }
    }
    await list(true);
    setBusy(false);
  };

  const listLabel = report.listed
    ? `Listed in Research${report.featured ? ' · Featured' : ''}`
    : 'Unlisted';

  return (
    <div className="report-tools" role="group" aria-label="Manage your report" ref={group}>
      <span
        className={`report-pill${report.listed ? ' is-listed' : ''}`}
        title={report.listed ? LISTED_HELP : UNLISTED_HELP}
      >
        <Icon name={report.listed ? 'globe' : 'link'} />
        {listLabel}
      </span>
      {canEdit && (
        <button
          type="button"
          className="report-tool"
          aria-label="Edit report"
          ref={editRef}
          onClick={onEdit}
        >
          <Icon name="pencil" />
          Edit
        </button>
      )}
      {canList && (
        <button
          type="button"
          className="report-tool"
          ref={listButton}
          disabled={busy}
          {...(report.listed
            ? { onClick: () => run(false) }
            : {
                'aria-haspopup': 'dialog',
                'aria-expanded': open === 'list',
                onClick: () => (open === 'list' ? close() : (setRefusal(null), setOpen('list'))),
              })}
        >
          {report.listed ? (busy ? 'Saving…' : 'Unlist') : 'List'}
        </button>
      )}
      <button
        type="button"
        className="report-tool report-tool-more"
        aria-label="More report actions"
        aria-haspopup="menu"
        aria-expanded={open === 'more'}
        ref={moreButton}
        disabled={deleting}
        onClick={() => (open === 'more' ? close() : setOpen('more'))}
      >
        <Icon name="more" />
      </button>
      {open === 'list' && (
        <div
          className="report-tools-pop report-tools-list"
          role="dialog"
          aria-label="List in Research"
          tabIndex={-1}
          ref={dialog}
        >
          {choosing ? (
            <HandleChooser
              busy={busy}
              refusal={handleRefusal}
              onSubmit={chooseHandle}
              onCancel={() => close(listButton)}
            />
          ) : (
            <>
              <p>
                Listing puts this report on Research, under your handle, where anyone can find it.
              </p>
              <div className="report-tools-actions">
                <button
                  type="button"
                  className="report-handle-cancel"
                  onClick={() => close(listButton)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="report-listing-button"
                  disabled={busy}
                  onClick={() => run(true)}
                >
                  {busy ? 'Listing…' : 'List in Research'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {open === 'more' && (
        <div className="report-tools-pop report-tools-menu" role="menu" aria-label="Report actions">
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            ref={deleteItem}
            onClick={() => {
              close(moreButton);
              onDelete();
            }}
          >
            <Icon name="trash" />
            Delete this report
          </button>
        </div>
      )}
      {refusal && (
        <p className="report-listing-error" role="alert">
          {refusal}
        </p>
      )}
    </div>
  );
};
