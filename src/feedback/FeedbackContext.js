import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FeedbackPopover from './FeedbackPopover';
import { FeedbackContext } from './useFeedback';
import './feedback.css';

const TOAST_MS = 3200;

/** The dialog an opener sits in, if any: the popover must live inside it to take focus. */
const dialogAround = (opener) => opener?.closest?.('[role="dialog"]') ?? null;

const toastElement = ({ text, container }) => {
  const toast = (
    <div className="feedback-toast" role="status" data-feedback-layer>
      <Check size={14} aria-hidden="true" /> {text}
    </div>
  );
  return container?.isConnected ? createPortal(toast, container) : toast;
};

/**
 * The Feedback state for a signed-in account: whether the popover is open and
 * which error reference it carries, the references of the error messages now
 * on screen, and the confirmation toast. A signed-out visitor gets no context,
 * so no Feedback button and no "Report this" links appear for them.
 */
export function FeedbackProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [panel, setPanel] = useState(null);
  const [toast, setToast] = useState(null);
  const panelRef = useRef(null);
  const nextId = useRef(0);
  const onScreen = useRef([]);
  const toastTimer = useRef(null);

  const showPanel = useCallback((next) => {
    panelRef.current = next;
    setPanel(next);
  }, []);

  const registerReference = useCallback((reference) => {
    const entry = { reference };
    onScreen.current.push(entry);
    return () => {
      onScreen.current = onScreen.current.filter((item) => item !== entry);
    };
  }, []);

  // `report` is the id of a report being flagged. `opener` is the element that asked: focus returns to it on close, and a
  // dialog around it hosts the popover so the dialog's focus trap lets it type.
  const openFeedback = useCallback(
    ({ reference, report, opener } = {}) => {
      const current = panelRef.current;
      const latest = onScreen.current[onScreen.current.length - 1]?.reference ?? null;
      const nextOpener = opener ?? current?.opener ?? null;
      showPanel({
        id: current?.id ?? ++nextId.current,
        // A flagged report (crf04/statsplus#372) is about the report, not an error.
        reference: report ? null : (reference ?? latest),
        report: report ?? null,
        opener: nextOpener,
        container: dialogAround(nextOpener),
      });
    },
    [showPanel],
  );

  // With an id, closes only the open that id belongs to, so a send that
  // finishes after its popover was dismissed leaves a newer draft alone.
  const closeFeedback = useCallback(
    (id) => {
      const current = panelRef.current;
      if (!current || (id !== undefined && id !== current.id)) return;
      showPanel(null);
      // After the click that closed it has settled, so a control the user
      // clicked instead keeps focus.
      window.setTimeout(() => {
        const { opener, container } = current;
        const active = document.activeElement;
        // A dialog's focus trap meanwhile parks focus on the dialog itself,
        // which is no deliberate choice by the user either.
        const undecided = !active || active === document.body || active === container;
        if (opener?.isConnected && undecided) opener.focus();
      }, 0);
    },
    [showPanel],
  );

  // `container` is the dialog the popover was in: the toast appears there too,
  // above the dialog's backdrop and inside what its screen reader users hear.
  const showToast = useCallback((text, container = null) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, container });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // A popover opened on one page does not follow the user to another.
  useEffect(() => {
    showPanel(null);
  }, [pathname, showPanel]);
  useEffect(() => {
    if (!isAuthenticated) showPanel(null);
  }, [isAuthenticated, showPanel]);

  const value = useMemo(
    () =>
      isAuthenticated ? { panel, openFeedback, closeFeedback, registerReference, showToast } : null,
    [isAuthenticated, panel, openFeedback, closeFeedback, registerReference, showToast],
  );

  const popover = panel && (
    <FeedbackPopover key={`${panel.id}-${panel.container ? 'in' : 'out'}`} />
  );
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {value && (
        <div className="feedback-layer">
          {popover && (panel.container ? createPortal(popover, panel.container) : popover)}
          {toast && toastElement(toast)}
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
