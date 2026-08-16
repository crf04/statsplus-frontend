import { Link } from 'react-router-dom';
import { Container, Spinner } from 'react-bootstrap';
import LoginButton from './LoginButton';
import { useAuth } from '../../contexts/AuthContext';
import '../../operations/OperationsPage.css';

const Message = ({ title, children, action, role = 'region' }) => (
  <Container className="admin-route-state" role={role} aria-labelledby="admin-route-title">
    <p className="eyebrow">CourtAI operations</p>
    <h1 id="admin-route-title">{title}</h1>
    <p>{children}</p>
    {action}
  </Container>
);

export default function AdminProtectedRoute({ children }) {
  const {
    isAuthenticated,
    loading,
    isAdmin,
    adminLoading,
    adminStatus,
    adminError,
    refreshAdminClaims,
  } = useAuth();

  if (loading) {
    return (
      <Container className="admin-route-state" role="status" aria-live="polite">
        <Spinner animation="border" variant="light" aria-label="Loading authentication" />
        <p>Checking authentication…</p>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Message
        title="Sign in to access Operations Console"
        action={
          <span className="admin-route-action">
            <LoginButton />
          </span>
        }
      >
        Administrator permissions are checked after sign-in. No collection data is loaded yet.
      </Message>
    );
  }

  if (adminLoading || adminStatus === 'unknown') {
    return (
      <Container className="admin-route-state" role="status" aria-live="polite">
        <Spinner animation="border" variant="light" aria-label="Checking administrator access" />
        <p>Checking administrator access…</p>
      </Container>
    );
  }

  if (adminStatus === 'configuration_error') {
    return (
      <Message
        title="Administrator access could not be verified"
        role="alert"
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => refreshAdminClaims(undefined, true)}
          >
            Retry permission check
          </button>
        }
      >
        {adminError || 'Firebase did not return a usable administrator claim.'}
      </Message>
    );
  }

  if (!isAdmin) {
    return (
      <Message
        title="Administrator permission required"
        action={<Link to="/">Return to Search</Link>}
      >
        This route is hidden from ordinary users. Your signed-in account is not authorized to view
        collection operations.
      </Message>
    );
  }

  return children;
}
