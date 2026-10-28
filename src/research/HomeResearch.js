import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLatestResearch } from './ResearchContext';
import ResearchEntry from './ResearchEntry';
import './research.css';

/* The latest three listed reports on the public home; nothing while none are listed. */
const HomeResearch = () => {
  const latest = useLatestResearch().slice(0, 3);
  if (!latest.length) return null;
  return (
    <section className="home-research" aria-labelledby="home-research-title">
      <div className="home-research-head">
        <h2 id="home-research-title">Research</h2>
        <Link to="/research">
          All research <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <ul className="research-list is-strip" aria-label="Latest research">
        {latest.map((entry) => (
          <li key={entry.id}>
            <ResearchEntry entry={entry} compact />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default HomeResearch;
