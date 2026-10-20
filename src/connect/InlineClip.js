import './InlineClip.css';

const InlineClip = ({ clip }) => (
  <aside className="clip-inline" aria-label={clip.title}>
    <video
      className="clip-inline-video"
      src={clip.src}
      poster={clip.poster}
      controls
      playsInline
      preload="none"
    />
    <p className="clip-inline-caption">
      <strong>{clip.title}</strong> · {clip.duration}
    </p>
    <a className="clip-x" href={clip.tweetUrl} target="_blank" rel="noreferrer">
      <span aria-hidden="true">𝕏</span> Watch on X <span aria-hidden="true">↗</span>
    </a>
  </aside>
);

export default InlineClip;
