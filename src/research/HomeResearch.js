import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { fetchResearch } from '../reportsApi';
import ResearchEntry from './ResearchEntry';
import './research.css';

// Newest listed first, Featured included.
export const latestEntries = ({ featured, reports }) =>
  [...featured, ...reports].sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt));

/*
 * The latest three listed reports on the public home, read each time the home
 * opens; nothing while none are listed or the read fails.
 */
const HomeResearch = () => {
  const [latest, setLatest] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchResearch({ signal: controller.signal })
      .then((page) => setLatest(latestEntries(page).slice(0, 3)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
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
