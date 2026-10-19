import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL } from './LegalPage';
import './SiteFooter.css';

/** Every page's way to the legal pages and a person to write to. */
const SiteFooter = () => (
  <footer className="site-footer">
    <nav aria-label="Legal">
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </nav>
  </footer>
);

export default SiteFooter;
