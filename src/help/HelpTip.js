import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { HELP_TIPS } from './helpTips';
import './HelpTip.css';

const VIEWPORT_MARGIN = 8;

/** A "?" beside a section heading that opens a short note on how to read it. */
export default function HelpTip({ tip }) {
  const { title, body } = HELP_TIPS[tip];
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const root = useRef(null);
  const bubble = useRef(null);
  const button = useRef(null);
  const bubbleId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const { left, right } = bubble.current.getBoundingClientRect();
    const overflow = right - (document.documentElement.clientWidth - VIEWPORT_MARGIN);
    setShift(overflow > 0 ? -Math.min(overflow, left - VIEWPORT_MARGIN) : 0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <span
      className="help-tip"
      ref={root}
      onKeyDown={(event) => {
        // Escape closes the note only, not a card or dialog the tip sits in.
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        button.current.focus();
      }}
    >
      <button
        ref={button}
        type="button"
        className="help-tip-button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        onClick={() => {
          setShift(0);
          setOpen(!open);
        }}
      >
        <CircleHelp size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open && (
        <span
          ref={bubble}
          id={bubbleId}
          role="note"
          aria-label={title}
          className="help-tip-bubble"
          style={{ '--help-tip-shift': `${shift}px` }}
        >
          <b>{title}</b>
          {body.map((paragraph) => (
            <span key={paragraph}>{paragraph}</span>
          ))}
        </span>
      )}
    </span>
  );
}
