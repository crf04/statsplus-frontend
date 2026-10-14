import { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import useDocumentTitle from '../../useDocumentTitle';
import './WaitlistScreen.css';

const WaitlistScreen = () => {
  const { currentUser, waitlist, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  useDocumentTitle('Waitlist');

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="waitlist-screen">
      <div className="waitlist-card">
        <p className="waitlist-brand">CourtAI</p>
        <p className="waitlist-eyebrow">Beta waitlist</p>
        <h1 className="waitlist-title">You&apos;re on the waitlist</h1>
        <p className="waitlist-message">{waitlist?.message}</p>
        {currentUser?.email && (
          <p className="waitlist-account">
            Signed in as <span className="waitlist-email">{currentUser.email}</span>
          </p>
        )}
        <Button
          variant="outline-light"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="waitlist-signout d-inline-flex align-items-center justify-content-center gap-2"
        >
          {isLoggingOut ? <Spinner size="sm" /> : <LogOut size={16} aria-hidden="true" />}
          Sign out
        </Button>
      </div>
    </main>
  );
};

export default WaitlistScreen;
