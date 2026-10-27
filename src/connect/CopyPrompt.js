import { useEffect, useState } from 'react';

const COPIED_MS = 1600;

const CopyPrompt = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="guide-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // The prompt stays on screen as selectable text.
        }
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
};

export default CopyPrompt;
