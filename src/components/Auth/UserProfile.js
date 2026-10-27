import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { Bookmark, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SavedFilterSetsModal from '../../SavedFilterSetsModal';

const UserProfile = () => {
  const { currentUser, logout, waitlist } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSavedFilterSets, setShowSavedFilterSets] = useState(false);

  if (!currentUser) {
    return null;
  }

  // Get user initials from display name or email
  const getInitials = (user) => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map((name) => name.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
    }

    // Fallback to email initials
    if (user.email) {
      const emailParts = user.email.split('@')[0];
      return (
        emailParts.charAt(0).toUpperCase() +
        (emailParts.length > 1 ? emailParts.charAt(1).toUpperCase() : '')
      );
    }

    return 'U';
  };

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

  const initials = getInitials(currentUser);
  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';

  return (
    <>
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="outline-light"
          id="user-dropdown"
          className="d-flex align-items-center gap-2 border-0 bg-transparent p-0"
          style={{ boxShadow: 'none' }}
          bsPrefix="custom-dropdown-toggle"
        >
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{
              width: 36,
              height: 36,
              background:
                'linear-gradient(135deg, var(--ct-x-667eea-fill) 0%, var(--ct-x-764ba2-fill) 100%)',
              color: 'var(--ct-on-ffffff)',
              fontSize: '14px',
              fontWeight: '600',
              border: '2px solid var(--ct-on-ffffff-40)',
              flexShrink: 0,
              boxShadow: '0 2px 8px var(--ct-x-667eea-30)',
            }}
          >
            {initials}
          </div>

          <span
            style={{
              color: 'var(--ct-text-max)',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </span>

          <ChevronDown size={12} color="var(--ct-text-max)" style={{ opacity: 0.7 }} />
        </Dropdown.Toggle>

        <Dropdown.Menu className="mt-2">
          {/* Saved Filter Sets are an admitted account's; a waitlisted read is refused. */}
          {!waitlist && (
            <Dropdown.Item
              onClick={() => setShowSavedFilterSets(true)}
              className="d-flex align-items-center gap-2"
            >
              <Bookmark size={16} />
              Saved Filter Sets
            </Dropdown.Item>
          )}
          <Dropdown.Item
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="d-flex align-items-center gap-2"
          >
            <LogOut size={16} />
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <SavedFilterSetsModal
        show={showSavedFilterSets}
        onHide={() => setShowSavedFilterSets(false)}
      />
    </>
  );
};

export default UserProfile;
