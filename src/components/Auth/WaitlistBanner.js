import { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './WaitlistBanner.css';

// A waitlisted account has signed up but is not admitted yet. The public home
// page stays open to it; this says why searching is closed and lets it sign out.
const WaitlistBanner = () => {
  const { currentUser, waitlist, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    <section className="waitlist-banner" aria-label="Beta waitlist">
      <div className="waitlist-copy">
        <p className="waitlist-eyebrow">Beta waitlist</p>
        <h2 className="waitlist-title">You&apos;re on the waitlist</h2>
        <p className="waitlist-message">{waitlist?.message}</p>
        {currentUser?.email && (
          <p className="waitlist-account">
            Signed in as <span className="waitlist-email">{currentUser.email}</span>
          </p>
        )}
      </div>
      <Button
        variant="outline-light"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="waitlist-signout d-inline-flex align-items-center justify-content-center gap-2"
      >
        {isLoggingOut ? <Spinner size="sm" /> : <LogOut size={16} aria-hidden="true" />}
        Sign out
      </Button>
    </section>
  );
};

export default WaitlistBanner;
