import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSignUpThen } from '../components/Auth/useSignUpThen';
import { useFeedback } from '../feedback/useFeedback';
import { errorCode, setPublicHandle, setReportListed } from '../reportsApi';
import { authorPath, publishedLine, staleDays } from '../research/researchFormat';

/* "Published …, data as of …", and a badge once the report is more than three days old. */
export const Published = ({ createdAt }) => {
  const days = staleDays(createdAt);
  return (
    <p className="report-published">
      <time dateTime={createdAt}>{publishedLine(createdAt)}</time>
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

/*
 * The author's List/Unlist toggle. Listing without a public handle opens the
 * chooser inline; once it is set the listing goes through. `onChanged` reloads
 * the report so the page shows what is now public.
 */
export const ListingToggle = ({ report, onChanged }) => {
  const { waitlist } = useAuth();
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [handleRefusal, setHandleRefusal] = useState(null);
  if (!report.isAuthor || waitlist) return null;

  const list = async (listed) => {
    try {
      await setReportListed(report.id, listed);
    } catch (failure) {
      const code = errorCode(failure);
      if (listed && code === 'handle_required') {
        setChoosing(true);
        return;
      }
      setChoosing(false);
      setRefusal(LISTING_ERRORS[code] ?? FAILED);
      return;
    }
    setChoosing(false);
    await onChanged();
  };

  const toggle = async () => {
    setBusy(true);
    setRefusal(null);
    await list(!report.listed);
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

  return (
    <div className="report-listing">
      <div className="report-listing-row">
        <p className="report-listing-state">
          {report.listed ? (
            <>
              <strong>Listed</strong> in <Link to="/research">Research</Link>
              {report.featured ? ', Featured' : ''}. Anyone can find it there.
            </>
          ) : (
            <>
              <strong>Unlisted.</strong> Only people with the link can open it.
            </>
          )}
        </p>
        {!choosing && (
          <button type="button" className="report-listing-button" onClick={toggle} disabled={busy}>
            {busy ? 'Saving…' : report.listed ? 'Unlist' : 'List in Research'}
          </button>
        )}
      </div>
      {choosing && (
        <HandleChooser
          busy={busy}
          refusal={handleRefusal}
          onSubmit={chooseHandle}
          onCancel={() => {
            setChoosing(false);
            setHandleRefusal(null);
          }}
        />
      )}
      {refusal && (
        <p className="report-listing-error" role="alert">
          {refusal}
        </p>
      )}
    </div>
  );
};
