import { useEffect, useRef } from 'react';
import useDocumentTitle from '../useDocumentTitle';
import { LAST_UPDATED } from './legalConfig';
import './legal.css';

/** The shared sheet for a legal page: a focused title, the date, then sections. */
const LegalPage = ({ title, documentTitle = title, lede, children }) => {
  const headingRef = useRef(null);
  useDocumentTitle(`${documentTitle} | CourtAI`);

  // A client-side route change moves no focus on its own.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="legal-page">
      <h1 className="legal-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h1>
      <p className="legal-updated">Last updated {LAST_UPDATED}</p>
      {lede && <p className="legal-lede">{lede}</p>}
      {children}
    </main>
  );
};

export const LegalSection = ({ id, title, children }) => (
  <section className="legal-section" aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    {children}
  </section>
);

export default LegalPage;
