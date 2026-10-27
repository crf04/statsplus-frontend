import { useEffect } from 'react';
import { useFeedback } from './useFeedback';

const REF_PATTERN = /\(ref ([0-9a-f]{8})\)/;

/**
 * The reference a request error message ends with, as built by
 * `withRequestReference`, or null.
 */
export const extractRequestReference = (message) =>
  typeof message === 'string' ? (message.match(REF_PATTERN)?.[1] ?? null) : null;

/**
 * Renders a request error message. When it carries a `(ref xxxxxxxx)` and the
 * viewer can send feedback, a "Report this" link follows the text, and the
 * reference is on offer to the header's Feedback button while this is mounted.
 */
export default function ErrorMessage({ message }) {
  const feedback = useFeedback();
  const reference = extractRequestReference(message);
  const registerReference = feedback?.registerReference;

  useEffect(() => {
    if (!reference || !registerReference) return undefined;
    return registerReference(reference);
  }, [reference, registerReference]);

  if (!reference || !feedback) return message;
  return (
    <>
      {message}{' '}
      <button
        type="button"
        className="feedback-report-link"
        onClick={(event) => feedback.openFeedback({ reference, opener: event.currentTarget })}
      >
        Report this
      </button>
    </>
  );
}
