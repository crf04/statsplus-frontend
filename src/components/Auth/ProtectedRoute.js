import { useAuth } from '../../contexts/AuthContext';
import { Container, Spinner } from 'react-bootstrap';

const ProtectedRoute = ({ children }) => {
  const { loading, error } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <div className="text-center">
          <Spinner animation="border" variant="light" />
          <div className="mt-3 text-light">Loading...</div>
        </div>
      </Container>
    );
  }

  // This shell intentionally remains public: the landing page owns the sign-in
  // affordance. Surface an auth configuration/listener failure without hiding
  // the rest of the app, so users can still understand why protected requests
  // are unavailable.
  return (
    <>
      {error && (
        <div className="auth-status-message text-center text-warning py-2" role="alert">
          {error}
        </div>
      )}
      {children}
    </>
  );
};

export default ProtectedRoute;
