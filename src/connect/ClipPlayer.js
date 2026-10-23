import { useEffect, useRef, useState } from 'react';
import './ClipPlayer.css';

const XLink = ({ href }) => (
  <a className="clip-x" href={href} target="_blank" rel="noreferrer">
    <span aria-hidden="true">𝕏</span> Watch on X <span aria-hidden="true">↗</span>
  </a>
);

/* A landscape screen recording is unreadable at sidebar width, so the page shows
   its poster and plays it full size in a dialog. */
const ClipPlayer = ({ clip }) => {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [open]);

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.close) dialog.close();
    setOpen(false);
  };

  return (
    <aside className="clip" aria-label={clip.title}>
      <button
        type="button"
        className="clip-thumb"
        aria-label={`Play: ${clip.title}`}
        onClick={() => setOpen(true)}
      >
        <img src={clip.poster} alt="" />
        <span className="clip-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          </svg>
        </span>
        <span className="clip-duration">{clip.duration}</span>
      </button>
      <p className="clip-caption">
        <strong>{clip.title}</strong> · {clip.duration}
      </p>
      {clip.summary && <p className="clip-summary">{clip.summary}</p>}
      <XLink href={clip.tweetUrl} />
      <dialog
        ref={dialogRef}
        className="clip-dialog"
        aria-label={clip.title}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        {open && (
          <div className="clip-dialog-body">
            <video
              className="clip-dialog-video"
              src={clip.src}
              poster={clip.poster}
              controls
              autoPlay
              playsInline
            />
            <div className="clip-dialog-foot">
              <p className="clip-dialog-title">{clip.title}</p>
              <XLink href={clip.tweetUrl} />
            </div>
            <button type="button" className="clip-dialog-close" onClick={close} aria-label="Close">
              ×
            </button>
          </div>
        )}
      </dialog>
    </aside>
  );
};

export default ClipPlayer;
