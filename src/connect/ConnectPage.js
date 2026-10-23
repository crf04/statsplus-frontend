import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ConnectGuide from './ConnectGuide';
import MatchupCardFrame from './MatchupCardFrame';
import './ConnectPage.css';

// The page always describes the production connector, so this is not an
// environment setting. The copy button reads the same constant the page shows.
export const CONNECTOR_URL = 'https://mcp.courtai.app/mcp';

// Claude's install links open its Add custom connector dialog with the name and URL filled in;
// the admin path opens the organization-wide dialog for a Team or Enterprise Owner.
const claudeInstallLink = (path) =>
  `https://claude.ai/${path}?modal=add-custom-connector&connectorName=CourtAI` +
  `&connectorUrl=${encodeURIComponent(CONNECTOR_URL)}`;
const CLAUDE_INSTALL_URL = claudeInstallLink('customize/connectors');
const CLAUDE_ORG_INSTALL_URL = claudeInstallLink('admin-settings/connectors');

const COPIED_MS = 2000;

const CLIENTS = [
  {
    id: 'claude',
    name: 'Claude',
    note: (
      <>
        Web or desktop app. On a Team or Enterprise plan, an Owner first adds CourtAI with the{' '}
        <a href={CLAUDE_ORG_INSTALL_URL} target="_blank" rel="noreferrer">
          organization install link
        </a>
        ; members then find it under <strong>Customize → Connectors</strong> and start at step 4.
      </>
    ),
    steps: [
      <>
        Select{' '}
        <a href={CLAUDE_INSTALL_URL} target="_blank" rel="noreferrer">
          <strong>Add CourtAI to Claude</strong>
        </a>
        . Claude opens <strong>Add custom connector</strong> with the name and URL filled in; check
        them and select Continue.
      </>,
      <>Review the authentication settings Claude detects and select Continue.</>,
      <>
        If asked for an OAuth client, choose <strong>Register automatically</strong>, then select
        Add.
      </>,
      <>Select Connect and sign in with Google, using your CourtAI account.</>,
      <>
        In a chat, open the <strong>+</strong> menu, choose <strong>Connectors</strong> and turn
        CourtAI on.
      </>,
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    note: (
      <>
        On the web, with a Plus, Pro, Business, Enterprise or Education plan. You can only add MCP
        servers on desktop, not in the ChatGPT phone app. Availability may depend on your workspace
        settings. If ChatGPT asks for Developer mode, enable it before adding the connector.
      </>
    ),
    steps: [
      <>
        Open <strong>Plugins → Add → Add custom MCP server</strong>.
      </>,
      <>
        Name it CourtAI, paste the connector URL into <strong>Server URL</strong> and choose{' '}
        <strong>OAuth</strong> for authentication.
      </>,
      <>
        Let ChatGPT discover the OAuth settings. If asked for a registration method, choose{' '}
        <strong>Dynamic Client Registration (DCR)</strong>.
      </>,
      <>
        Review the notice, check <strong>I understand and want to continue</strong>, then select{' '}
        <strong>Create as a plugin</strong>.
      </>,
      <>
        Select <strong>Continue to CourtAI</strong> and sign in with Google, using your CourtAI
        account.
      </>,
      <>
        On the CourtAI plugin page, select <strong>Try in chat</strong> and ask a question.
      </>,
    ],
  },
];

const ClientTabs = () => {
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);

  // Arrow keys move between tabs and select, as in the WAI-ARIA tabs pattern.
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (active + step + CLIENTS.length) % CLIENTS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="connect-tablist" role="tablist" aria-label="Chat app">
        {CLIENTS.map((c, index) => (
          <button
            key={c.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`connect-tab-${c.id}`}
            aria-selected={index === active}
            aria-controls={`connect-panel-${c.id}`}
            tabIndex={index === active ? 0 : -1}
            className="connect-tab"
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
          >
            {c.name}
          </button>
        ))}
      </div>
      {CLIENTS.map((c, index) => (
        <div
          key={c.id}
          className="connect-tabpanel"
          role="tabpanel"
          id={`connect-panel-${c.id}`}
          aria-labelledby={`connect-tab-${c.id}`}
          hidden={index !== active}
        >
          <p className="connect-note">{c.note}</p>
          <ol className="connect-steps">
            {c.steps.map((step, stepIndex) => (
              <li key={stepIndex}>{step}</li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
};

// A link from another page to a lesson (/connect#guide-tutorials) arrives before this
// lazy page renders, so the browser never scrolls to it. Scroll once rendered, and
// again while the card above settles its height, until the visitor scrolls.
const SETTLE_MS = 5000;
const STOP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'click'];

const lessonFor = (hash) => {
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // A malformed fragment is matched as typed rather than crashing the page.
  }
  return id && document.getElementById(id);
};

const useScrollToHash = () => {
  const { hash } = useLocation();
  useEffect(() => {
    const target = lessonFor(hash);
    if (!target) return undefined;
    const scroll = () => target.scrollIntoView({ block: 'start' });
    scroll();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(scroll);
    observer.observe(document.body);
    const stop = () => observer.disconnect();
    const timer = setTimeout(stop, SETTLE_MS);
    STOP_EVENTS.forEach((type) => window.addEventListener(type, stop, { passive: true }));
    return () => {
      stop();
      clearTimeout(timer);
      STOP_EVENTS.forEach((type) => window.removeEventListener(type, stop));
    };
  }, [hash]);
};

/**
 * Public setup guide for the CourtAI MCP connector. It makes no API calls,
 * so a signed-out visitor can read it before creating an account.
 */
const ConnectPage = () => {
  const headingRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // A client-side route change moves no focus on its own.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  useScrollToHash();

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
      <div className="connect-hero">
        <div className="connect-pitch">
          <p className="connect-eyebrow">CourtAI Connect</p>
          <h1 className="connect-title" tabIndex={-1} ref={headingRef}>
            Ask CourtAI from your chat
          </h1>
          <p className="connect-lede">
            Add CourtAI to Claude or ChatGPT and ask about matchups in your own words. Answers come
            from your CourtAI account, with the date their data is as of.
          </p>
        </div>
        <div className="connect-start">
          <div className="connect-url" role="group" aria-label="Connector URL">
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
          <p className="connect-jump">
            Then follow the steps for <a href="#connect-setup">Claude or ChatGPT</a>.
          </p>
        </div>
      </div>

      {/* The card runs side by side (court beside the Bases) once it is wider
          than 520px, so the example gets the page's width, not a hero column. */}
      <figure className="connect-chat" aria-label="An example conversation">
        <div className="connect-chat-talk">
          <p className="connect-bubble connect-bubble-user">
            Show Cade Cunningham&apos;s matchup against Charlotte.
          </p>
          <p className="connect-bubble connect-bubble-answer">
            Cade&apos;s points Matchup against Charlotte is <strong>+0.4% vs league</strong>,
            slightly favourable. The edge is his pick-and-roll: 37% of his plays, and Charlotte
            ranks 26th against it.
          </p>
          <figcaption>
            The connector&apos;s own Matchup card, with data from the completed 2025-26 season.
          </figcaption>
        </div>
        <MatchupCardFrame />
      </figure>

      <ConnectGuide setup={<ClientTabs />} />
    </main>
  );
};

export default ConnectPage;
