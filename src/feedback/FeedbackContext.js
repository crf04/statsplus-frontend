import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FeedbackPopover from './FeedbackPopover';
import { FeedbackContext } from './useFeedback';
import './feedback.css';

const TOAST_MS = 3200;
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
  const onScreen = useRef([]);
  const toastTimer = useRef(null);

  const registerReference = useCallback((reference) => {
    const entry = { reference };
    onScreen.current.push(entry);
    return () => {
      onScreen.current = onScreen.current.filter((item) => item !== entry);
    };
  }, []);

  const openFeedback = useCallback(({ reference } = {}) => {
    const latest = onScreen.current[onScreen.current.length - 1]?.reference ?? null;
    setPanel({ reference: reference ?? latest });
  }, []);
  const closeFeedback = useCallback(() => setPanel(null), []);

  const showToast = useCallback((text) => {
    window.clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // A popover opened on one page does not follow the user to another.
  useEffect(() => {
    setPanel(null);
  }, [pathname]);
  useEffect(() => {
    if (!isAuthenticated) setPanel(null);
  }, [isAuthenticated]);

  const value = useMemo(
    () =>
      isAuthenticated ? { panel, openFeedback, closeFeedback, registerReference, showToast } : null,
    [isAuthenticated, panel, openFeedback, closeFeedback, registerReference, showToast],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {value && (
        <div className="feedback-layer" data-feedback-layer>
          {panel && <FeedbackPopover />}
          {toast && (
            <div className="feedback-toast" role="status">
              <Check size={14} aria-hidden="true" /> {toast}
            </div>
          )}
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
