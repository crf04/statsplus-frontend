import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { ClipDialog } from '../connect/ClipPlayer';
import { TUTORIALS } from '../connect/tutorialList';

/* The newest tutorial in the X series, between the search and the ladder; the
   Connect guide lists them all. */
const HomeTutorial = () => {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[0];
  if (!tutorial) return null;

  return (
    <section className="home-tutorial" aria-labelledby="home-tutorial-title">
      <button
        type="button"
        className="clip-thumb home-tutorial-thumb"
        aria-label={`Play: ${tutorial.title}`}
        onClick={() => setOpen(true)}
      >
        <img src={tutorial.poster} alt="" />
        <span className="clip-play" aria-hidden="true">
          <Play size={14} fill="currentColor" />
        </span>
        <span className="clip-duration">{tutorial.duration}</span>
      </button>
      <div className="home-tutorial-text">
        <p className="home-tutorial-eyebrow">
          New tutorial <span>· Part {TUTORIALS.length}</span>
        </p>
        <h2 id="home-tutorial-title" className="home-tutorial-title">
          {tutorial.title}
        </h2>
        <p className="home-tutorial-summary">{tutorial.summary}</p>
        <div className="home-tutorial-actions">
          <button type="button" className="home-tutorial-watch" onClick={() => setOpen(true)}>
            <Play size={13} fill="currentColor" aria-hidden="true" /> Watch · {tutorial.duration}
          </button>
          <Link to="/connect#guide-tutorials" className="home-tutorial-all">
            All tutorials <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <ClipDialog clip={tutorial} open={open} onClose={() => setOpen(false)} />
    </section>
  );
};

export default HomeTutorial;
