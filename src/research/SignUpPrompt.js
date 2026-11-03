import { useAuth } from '../contexts/AuthContext';
import LoginButton from '../components/Auth/LoginButton';

/* For signed-out visitors: what an account does, and the way in. */
const SignUpPrompt = ({ title = 'Run the same research on any player' }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;
  return (
    <aside className="research-signup" aria-label="Sign up">
      <div>
        <h2>{title}</h2>
        <p>
          Connect CourtAI to Claude or ChatGPT and ask about any player, game or injury: game logs,
          matchups, rotations and lines, the same facts these cards are built from.
        </p>
      </div>
      <LoginButton size="sm" label="Sign up free" />
    </aside>
  );
};

export default SignUpPrompt;
