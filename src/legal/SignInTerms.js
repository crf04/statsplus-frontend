import { Link } from 'react-router-dom';
import { PRIVACY_PATH, TERMS_PATH } from './legalConfig';
import './legal.css';

/** The line beside a sign-in control: signing in accepts the Terms and Privacy Policy. */
const SignInTerms = ({ className = '' }) => (
  <p className={`legal-signin ${className}`.trim()}>
    By signing in you agree to the <Link to={TERMS_PATH}>Terms</Link> and{' '}
    <Link to={PRIVACY_PATH}>Privacy</Link>.
  </p>
);

export default SignInTerms;
