import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Container, Spinner } from 'react-bootstrap';

const ProtectedRoute = ({ children }) => {
  const { loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <Spinner animation="border" variant="light" />
          <div className="mt-3 text-light">Loading...</div>
        </div>
      </Container>
    );
  }

  // Always render children (the natural language query page will handle login display)
  return children;
};

export default ProtectedRoute;