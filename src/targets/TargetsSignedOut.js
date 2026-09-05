import '../SlatePage.css';

/*
 * Targets belong to an account, so both Targets routes are readable only when
 * signed in. Neither redirects: the link a reader followed is still the link
 * they wanted once they have signed in.
 */
export default function TargetsSignedOut() {
  return (
    <main className="slate-page signed-out-slate">
      <h1>Sign in to view your Targets</h1>
      <p>Use the sign-in control in the navigation to load the Targets saved to your account.</p>
    </main>
  );
}
