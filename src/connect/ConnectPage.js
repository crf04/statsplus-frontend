import { useEffect, useRef, useState } from 'react';
import './ConnectPage.css';

// The page always describes the production connector, so this is not an
// environment setting. The copy button reads the same constant the page shows.
export const CONNECTOR_URL = 'https://statsplus-mcp-production.up.railway.app/mcp';

const COPIED_MS = 2000;

const EXAMPLE_PROMPTS = [
  "What's on tonight's slate?",
  "Show Cade Cunningham's matchup in DET @ CHA.",
  'How has he done against the 10 teams that allow the most points to guards?',
  'Which players fit my Targets today?',
];

/**
 * Public setup guide for the StatsPlus MCP connector. It makes no API calls,
 * so a signed-out visitor can read it before creating an account.
 */
const ConnectPage = () => {
  const headingRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // A client-side route change moves no focus on its own.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(CONNECTOR_URL);
      setCopied(true);
    } catch {
      // A blocked clipboard leaves the URL as selectable text beside the button.
    }
  };

  return (
    <main className="connect-page">
      <h1 className="connect-title" tabIndex={-1} ref={headingRef}>
        Use StatsPlus in Claude or ChatGPT
      </h1>
      <p className="connect-lede">
        Ask about matchups, slates, your Targets and game logs, using data from your StatsPlus
        account. StatsPlus reports facts. It doesn&apos;t make picks.
      </p>

      <section className="connect-section" aria-labelledby="connect-url-heading">
        <h2 id="connect-url-heading">Connector URL</h2>
        <div className="connect-url">
          <code>{CONNECTOR_URL}</code>
          <button type="button" className="connect-copy" onClick={copyUrl}>
            <span aria-live="polite">
              {copied ? (
                'Copied'
              ) : (
                <>
                  Copy<span className="visually-hidden"> connector URL</span>
                </>
              )}
            </span>
          </button>
        </div>
      </section>

      <div className="connect-clients">
        <section className="connect-section" aria-labelledby="connect-claude-heading">
          <h2 id="connect-claude-heading">Claude</h2>
          <p className="connect-note">Web or desktop app, on any Claude plan.</p>
          <ol className="connect-steps">
            <li>
              Open <strong>Customize → Connectors</strong>, select <strong>+ Add</strong>, then{' '}
              <strong>Add custom connector</strong>.
            </li>
            <li>Name it StatsPlus, paste the connector URL and select Continue.</li>
            <li>Keep the sign-in settings Claude detects, then select Add.</li>
            <li>Select Connect and sign in with Google, using your StatsPlus account.</li>
            <li>
              In a chat, open the <strong>+</strong> menu, choose <strong>Connectors</strong> and
              turn StatsPlus on.
            </li>
          </ol>
        </section>

        <section className="connect-section" aria-labelledby="connect-chatgpt-heading">
          <h2 id="connect-chatgpt-heading">ChatGPT</h2>
          <p className="connect-note">
            On the web, with a Plus, Pro, Business, Enterprise or Education plan. Custom connectors
            need Developer mode.
          </p>
          <ol className="connect-steps">
            <li>
              Open <strong>Settings → Security and login</strong> and turn on{' '}
              <strong>Developer mode</strong>.
            </li>
            <li>
              Go to <strong>Plugins</strong> and select the <strong>+</strong> button.
            </li>
            <li>
              Name it StatsPlus, paste the connector URL as the connection, choose OAuth and create
              it.
            </li>
            <li>Sign in with Google, using your StatsPlus account.</li>
            <li>
              In a chat, open the <strong>+</strong> menu, choose <strong>Developer mode</strong>{' '}
              and select StatsPlus.
            </li>
          </ol>
        </section>
      </div>

      <section className="connect-section" aria-labelledby="connect-prompts-heading">
        <h2 id="connect-prompts-heading">Try asking</h2>
        <ul className="connect-prompts">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </section>

      <section className="connect-section" aria-labelledby="connect-notes-heading">
        <h2 id="connect-notes-heading">Good to know</h2>
        <ul className="connect-notes">
          <li>
            Opponent ranks run from 1 to 30, where 1 means the defense allows the most of that stat.
          </li>
          <li>Dates use US Eastern time and default to today.</li>
        </ul>
      </section>
    </main>
  );
};

export default ConnectPage;
