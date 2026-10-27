import { MessageSquarePlus } from 'lucide-react';
import { useFeedback } from './useFeedback';

/** The header's Feedback pill: icon and label, icon only on a phone. */
export default function FeedbackButton() {
  const feedback = useFeedback();
  if (!feedback) return null;
  const { panel, openFeedback, closeFeedback } = feedback;
  return (
    <button
      type="button"
      className={`feedback-trigger${panel ? ' is-open' : ''}`}
      aria-label="Feedback"
      aria-expanded={Boolean(panel)}
      data-feedback-trigger
      onClick={(event) => (panel ? closeFeedback() : openFeedback({ opener: event.currentTarget }))}
    >
      <MessageSquarePlus size={16} aria-hidden="true" />
      <span>Feedback</span>
    </button>
  );
}
