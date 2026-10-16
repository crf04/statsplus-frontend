import { useEffect, useRef, useState } from 'react';
import MatchupCardFrame from './MatchupCardFrame';
import './ConnectPage.css';

// The page always describes the production connector, so this is not an
// environment setting. The copy button reads the same constant the page shows.
export const CONNECTOR_URL = 'https://statsplus-mcp-production.up.railway.app/mcp';

const COPIED_MS = 2000;

// Every connector tool, each prompt answered by the production connector when
// this list last changed (2026-10-16). A Slate needs a date with games, so the
// example names one rather than "tonight". The injury report is stored only on
// game days, so those two examples ask about today.
const TOOLS = [
  {
    tool: 'Slate',
    answers: "A date's games, and the players whose Matchups stand out in each.",
    prompt: "What's on the slate for April 10, 2026?",
  },
  {
    tool: 'Matchup',
    answers:
      "A player's Matchup Score against an opponent, and the play types and zones behind it.",
    prompt: "Show Cade Cunningham's matchup against Charlotte.",
  },
  {
    tool: 'Game logs',
    answers: 'How a player did in past games, filtered by opponent rank or teammates out.',
    prompt:
      'How has Cade Cunningham done against the 10 teams that allow the most pick-and-roll points?',
  },
  {
    tool: 'Rotation',
    answers: 'Who starts, how many minutes a player plays and when, and whose minutes changed.',
    prompt: "How have Ausar Thompson's minutes looked lately?",
  },
  {
    tool: 'Injury report',
    answers: 'The official NBA injury report for a date, stored from 11:00 ET on game days.',
    prompt: "Who's on the injury report today?",
  },
  {
    tool: 'Injury Scenarios',
    answers: 'How each teammate produced in games a Questionable, Doubtful or Out player missed.',
    prompt: "Which teammates move when tonight's injured players sit?",
  },
  {
    tool: 'On/off splits',
    answers: "A team's per-36 rates with chosen players on or off the floor.",
    prompt: 'How did Detroit play with Cade Cunningham off the floor in 2025-26?',
  },
  {
    tool: 'Targets',
    answers: 'Which opposing players fit your saved Targets on a date.',
    prompt: 'Which players fit my Targets today?',
  },
  {
    tool: 'Backtest',
    answers: 'How players who fit a Target you describe did against that opponent.',
    prompt:
      'Backtest players who run at least 30% of their plays as the pick-and-roll ball handler against Charlotte.',
  },
];

const CLIENTS = [
  {
    id: 'claude',
    name: 'Claude',
    note: (
      <>
        Web or desktop app. On a Team or Enterprise plan, an Owner first adds CourtAI under{' '}
        <strong>Organization settings → Connectors</strong>; members then find it under{' '}
        <strong>Customize → Connectors</strong> and start at step 5.
      </>
    ),
    steps: [
      <>
        Open <strong>Customize → Connectors</strong>, select <strong>+ Add</strong>, then{' '}
        <strong>Add custom connector</strong>.
      </>,
      <>Name it CourtAI, paste the connector URL and select Continue.</>,
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
        On the web, with a Plus, Pro, Business, Enterprise or Education plan. Availability may
        depend on your workspace settings. If ChatGPT asks for Developer mode, enable it before
        adding the connector.
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

const NOTES = [
  ['Facts, not picks', "CourtAI reports what the numbers say. It doesn't make picks."],
  ['Ranks run 1 to 30', '30 means the defense allows the most of that stat, and 1 the fewest.'],
  [
    'Dated answers',
    'Every answer ends with the date its data is as of. Dates use US Eastern time and default to today.',
  ],
  ['Your account', 'Answers come from your own CourtAI sign-in, so your Targets come along.'],
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

      <section
        className="connect-section"
        id="connect-setup"
        aria-labelledby="connect-setup-heading"
      >
        <h2 id="connect-setup-heading">Set it up</h2>
        <ClientTabs />
      </section>

      <section className="connect-section" aria-labelledby="connect-prompts-heading">
        <h2 id="connect-prompts-heading">What you can ask</h2>
        <p className="connect-note">
          CourtAI has one tool per kind of question. Paste an example into a chat with CourtAI
          turned on, or ask in your own words.
        </p>
        <ul className="connect-tools">
          {TOOLS.map(({ tool, answers, prompt }) => (
            <li key={tool}>
              <span className="connect-prompt-tool">{tool}</span>
              <p className="connect-tool-answers">{answers}</p>
              <p className="connect-tool-prompt">{prompt}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="connect-section" aria-labelledby="connect-notes-heading">
        <h2 id="connect-notes-heading">Good to know</h2>
        <dl className="connect-notes">
          {NOTES.map(([title, body]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
};

export default ConnectPage;
