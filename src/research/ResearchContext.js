import { createContext, useContext, useEffect, useState } from 'react';
import { fetchResearch } from '../reportsApi';

const ResearchContext = createContext(null);

// Newest listed first, Featured included: what the nav and the home strip show.
export const latestEntries = ({ featured, reports }) =>
  [...featured, ...reports].sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt));

/*
 * The first page of Research, read once per page load, so the nav's link and
 * the home strip appear only while there is something listed to show. Until
 * it answers, and if it fails, there is nothing to show.
 */
export function ResearchProvider({ children }) {
  const [latest, setLatest] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchResearch({ signal: controller.signal })
      .then((page) => setLatest(latestEntries(page)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <ResearchContext.Provider value={latest}>{children}</ResearchContext.Provider>;
}

/* The newest listed reports, or an empty list while none are known. */
export const useLatestResearch = () => useContext(ResearchContext) ?? [];
