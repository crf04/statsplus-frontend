import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SignInTerms from './SignInTerms';
import { DATA_SOURCE, FACTS_NOT_ADVICE, LEGAL_LINKS } from './legalConfig';
import './legal.css';

/** Links to the legal pages, with the 21+ notice and the data attribution. */
const LegalFooter = () => {
  const { isAuthenticated } = useAuth();
  return (
    <footer className="legal-footer">
      <nav className="legal-footer-links" aria-label="Legal">
        {LEGAL_LINKS.map(({ path, label }) => (
          <NavLink key={path} to={path}>
            {label}
          </NavLink>
        ))}
      </nav>
      {!isAuthenticated && <SignInTerms className="legal-signin-footer" />}
      <p>21+ only. {FACTS_NOT_ADVICE}</p>
      <p>{DATA_SOURCE}</p>
    </footer>
  );
};

export default LegalFooter;
