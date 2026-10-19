import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  MESSAGE_MAX_LENGTH,
  SCREENSHOT_MISSED_NOTE,
  SENT_MESSAGE,
  X_HANDLE_PATTERN,
  captureScreenshot,
  describeSendFailure,
  getAppVersion,
  sendFeedback,
} from './feedbackApi';
import { useFeedback } from './useFeedback';

const X_HANDLE_STORAGE_KEY = 'courtai:feedback-x-handle';
const PAGE_MAX_LENGTH = 500;

const readRememberedHandle = () => {
  try {
    return window.localStorage.getItem(X_HANDLE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const rememberHandle = (handle) => {
  try {
    if (handle) window.localStorage.setItem(X_HANDLE_STORAGE_KEY, handle);
    else window.localStorage.removeItem(X_HANDLE_STORAGE_KEY);
  } catch {
    // Remembering the handle is a convenience; a blocked store is not an error.
  }
};

/** The popover under the header: titled by the error it reports, if any. */
export default function FeedbackPopover() {
  const { panel, closeFeedback, showToast } = useFeedback();
  const { currentUser } = useAuth();
  const { pathname, search } = useLocation();
  const reference = panel.reference;
  const [message, setMessage] = useState('');
  const [replyOk, setReplyOk] = useState(true);
  const [withScreenshot, setWithScreenshot] = useState(false);
  const [xHandle, setXHandle] = useState(readRememberedHandle);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const popover = useRef(null);
  const messageBox = useRef(null);

  const handle = xHandle.trim().replace(/^@/, '');
  const handleValid = handle === '' || X_HANDLE_PATTERN.test(handle);

  useEffect(() => {
    messageBox.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeFeedback();
    };
    // The header button and the Report this links manage the popover themselves.
    const onPointerDown = (event) => {
      if (
        popover.current?.contains(event.target) ||
        event.target.closest?.('[data-feedback-trigger], .feedback-report-link')
      ) {
        return;
      }
      closeFeedback();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [closeFeedback]);

  const send = async () => {
    setSending(true);
    setSendError(null);
    const screenshot = withScreenshot ? await captureScreenshot() : null;
    const body = {
      message: message.trim(),
      reply_ok: replyOk,
      page: `${pathname}${search}`.slice(0, PAGE_MAX_LENGTH),
      app_version: getAppVersion(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
    if (handle) body.x_handle = handle;
    if (reference) body.error_ref = reference;
    if (screenshot) body.screenshot = screenshot;
    try {
      await sendFeedback(body);
    } catch (error) {
      setSendError(describeSendFailure(error));
      setSending(false);
      return;
    }
    rememberHandle(handle);
    closeFeedback();
    showToast(
      withScreenshot && !screenshot ? `${SENT_MESSAGE} ${SCREENSHOT_MISSED_NOTE}` : SENT_MESSAGE,
    );
  };

  return (
    <div className="feedback-popover" role="dialog" aria-label="Send feedback" ref={popover}>
      <div className="feedback-head">
        <strong>{reference ? 'Report this error' : 'Feedback'}</strong>
        <button
          type="button"
          className="feedback-icon"
          onClick={closeFeedback}
          aria-label="Close feedback"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <textarea
        ref={messageBox}
        rows={4}
        maxLength={MESSAGE_MAX_LENGTH}
        aria-label="Your feedback"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={
          reference
            ? 'What were you doing when this happened?'
            : 'What’s working, what’s broken, what’s missing?'
        }
      />
      <label className="feedback-x">
        <span className="feedback-x-label">
          X handle <em>optional</em>
        </span>
        <span className={`feedback-x-field${handleValid ? '' : ' is-bad'}`}>
          <span aria-hidden="true">@</span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={16}
            value={xHandle}
            placeholder="yourhandle"
            aria-invalid={!handleValid}
            aria-describedby={handleValid ? undefined : 'feedback-x-error'}
            onChange={(event) => setXHandle(event.target.value.replace(/^\s*@+/, ''))}
          />
        </span>
      </label>
      {!handleValid && (
        <p className="feedback-x-error" id="feedback-x-error">
          Letters, numbers and underscores, up to 15 characters.
        </p>
      )}
      <div className="feedback-options">
        <label className="feedback-check">
          <input
            type="checkbox"
            checked={replyOk}
            onChange={(event) => setReplyOk(event.target.checked)}
          />
          <span>
            OK to email me back
            {currentUser?.email ? <> at {currentUser.email}</> : null}
          </span>
        </label>
        <label className="feedback-check">
          <input
            type="checkbox"
            checked={withScreenshot}
            onChange={(event) => setWithScreenshot(event.target.checked)}
          />
          <span>Include a screenshot of this page</span>
        </label>
      </div>
      <p className="feedback-fine">
        Also sends this page’s address and the app version
        {reference ? (
          <>
            , and error <code>ref {reference}</code>
          </>
        ) : null}
        .
      </p>
      {sendError && (
        <p className="feedback-send-error" role="alert">
          {sendError}
        </p>
      )}
      <div className="feedback-actions">
        <button
          type="button"
          className="feedback-send"
          disabled={!message.trim() || !handleValid || sending}
          onClick={send}
        >
          Send
        </button>
      </div>
    </div>
  );
}
