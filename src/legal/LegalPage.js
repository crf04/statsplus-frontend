import { useEffect, useRef } from 'react';
import useDocumentTitle from '../useDocumentTitle';
import './LegalPage.css';

export const SUPPORT_EMAIL = 'support@courtai.app';
export const LEGAL_EFFECTIVE_DATE = 'October 19, 2026';

/** The shared sheet the Privacy Policy and Terms of Service are printed on. */
const LegalPage = ({ title, children }) => {
  const headingRef = useRef(null);
  useDocumentTitle(`${title} | CourtAI`);

  // A client-side route change moves no focus on its own.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="legal-page">
      <h1 className="legal-page-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h1>
      <p className="legal-page-effective">Effective {LEGAL_EFFECTIVE_DATE}</p>
      {children}
    </main>
  );
};

export const SupportEmail = () => <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

export default LegalPage;
