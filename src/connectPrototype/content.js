// PROTOTYPE (throwaway): copy shared by every Connect variant.
import { useEffect, useState } from 'react';
import { CONNECTOR_URL } from '../connect/ConnectPage';

export { CONNECTOR_URL };

export const TOOLS = [
  {
    key: 'slate',
    name: 'Slate',
    blurb: "Tonight's games and the ten most and least favourable Matchups by points.",
    prompt: "What's on the slate for April 10, 2026?",
    card: true,
  },
  {
    key: 'matchup',
    name: 'Matchup',
    blurb: "One player's Matchup Score in every market, and the parts of his game that drive it.",
    prompt: "Show Cade Cunningham's matchup against Charlotte.",
    card: true,
  },
  {
    key: 'logs',
    name: 'Game logs',
    blurb:
      'His games against defenses like this one, with teammates in or out, minutes, home or away.',
    prompt:
      'How has Cade Cunningham done against the 10 teams that allow the most pick-and-roll points?',
    card: true,
  },
  {
    key: 'targets',
    name: 'Targets',
    blurb: "Your saved Targets read against today's Slate, and the players who fit them.",
    prompt: 'Which players fit my Targets today?',
  },
  {
    key: 'backtest',
    name: 'Backtest',
    blurb: 'Try a draft Target over a full season before you save it.',
    prompt:
      'Backtest players who run at least 30% of their plays as the pick-and-roll ball handler against Charlotte.',
  },
];

export const CLAUDE = {
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
      If asked for an OAuth client, choose <strong>Register automatically</strong>, then select Add.
    </>,
    <>Select Connect and sign in with Google, using your CourtAI account.</>,
    <>
      In a chat, open the <strong>+</strong> menu, choose <strong>Connectors</strong> and turn
      CourtAI on.
    </>,
  ],
};

export const CHATGPT = {
  name: 'ChatGPT',
  note: (
    <>
      On the web, with a Plus, Pro, Business, Enterprise or Education plan. If ChatGPT asks for
      Developer mode, enable it before adding the connector.
    </>
  ),
  steps: [
    <>
      Open <strong>Plugins → Add → Add custom MCP server</strong>.
    </>,
    <>
      Name it CourtAI, paste the connector URL into <strong>Server URL</strong> and choose{' '}
      <strong>OAuth</strong>.
    </>,
    <>
      If asked for a registration method, choose <strong>Dynamic Client Registration (DCR)</strong>.
    </>,
    <>
      Check <strong>I understand and want to continue</strong>, then select{' '}
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
};

export const CLIENTS = [CLAUDE, CHATGPT];

export const NOTES = [
  { title: 'Facts, not picks', body: 'CourtAI reports what the numbers say. It never predicts.' },
  {
    title: 'Ranks run 1 to 30',
    body: '30 means the defense allows the most of that stat; 1 the fewest.',
  },
  {
    title: 'Dated answers',
    body: 'Every answer ends with the date its data is as of. Dates use US Eastern time.',
  },
  {
    title: 'Your account',
    body: 'Answers use your CourtAI sign-in, so your Targets come along.',
  },
];

// A real answer from the production connector (Unscheduled Matchup, completed
// 2025-26 season, data as of 2026-08-24), trimmed to the points block.
export const SAMPLE_ANSWER = {
  question: "Show Cade Cunningham's matchup against Charlotte.",
  player: 'Cade Cunningham',
  matchup: 'DET vs CHA',
  score: '+0.4%',
  label: 'favourable',
  rows: [
    {
      base: 'Play types',
      slice: 'PnR ball handler',
      share: '37%',
      rank: 26,
      vs: '+12%',
      sig: true,
    },
    { base: 'Shot types', slice: 'Pull-ups', share: '40%', rank: 25, vs: '+6%' },
    { base: 'Shot zones', slice: 'Above-break 3', share: '29%', rank: 19, vs: '+2%' },
  ],
  asOf: 'Data as of 2026-08-24 · completed 2025-26 season',
};

export const useCopy = () => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONNECTOR_URL);
      setCopied(true);
    } catch {
      // the URL stays selectable beside the button
    }
  };
  return [copied, copy];
};

export const CopyUrl = ({ className = '' }) => {
  const [copied, copy] = useCopy();
  return (
    <div className={`cp-url ${className}`}>
      <code>{CONNECTOR_URL}</code>
      <button type="button" className="cp-copy" onClick={copy}>
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
  );
};

export const Steps = ({ client, className = '' }) => (
  <ol className={`cp-steps ${className}`}>
    {client.steps.map((step, index) => (
      <li key={index}>{step}</li>
    ))}
  </ol>
);

export const ClientTabs = ({ idPrefix }) => {
  const [active, setActive] = useState(0);
  const client = CLIENTS[active];
  return (
    <div className="cp-tabs">
      <div className="cp-tablist" role="tablist" aria-label="Your chat app">
        {CLIENTS.map((c, index) => (
          <button
            key={c.name}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${index}`}
            aria-selected={index === active}
            aria-controls={`${idPrefix}-panel`}
            className="cp-tab"
            onClick={() => setActive(index)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${active}`}>
        <p className="cp-note">{client.note}</p>
        <Steps client={client} />
      </div>
    </div>
  );
};

export const AnswerCard = () => (
  <div className="cp-answer">
    <div className="cp-answer-head">
      <span className="cp-answer-player">{SAMPLE_ANSWER.player}</span>
      <span className="cp-answer-game">{SAMPLE_ANSWER.matchup}</span>
    </div>
    <div className="cp-answer-score">
      <span className="cp-answer-market">PTS</span>
      <span className="cp-answer-value">{SAMPLE_ANSWER.score}</span>
      <span className="cp-answer-label">vs league · {SAMPLE_ANSWER.label}</span>
    </div>
    <table className="cp-answer-rows">
      <thead>
        <tr>
          <th scope="col">His biggest slice</th>
          <th scope="col">Share</th>
          <th scope="col">CHA rank</th>
          <th scope="col">vs lg</th>
        </tr>
      </thead>
      <tbody>
        {SAMPLE_ANSWER.rows.map((row) => (
          <tr key={row.base}>
            <th scope="row">
              <span className="cp-answer-base">{row.base}</span>
              {row.slice}
              {row.sig && <span className="cp-answer-sig">signature</span>}
            </th>
            <td>{row.share}</td>
            <td>
              <span className="cp-rank" style={{ '--rank': row.rank }}>
                {row.rank}
              </span>
            </td>
            <td className="cp-pos">{row.vs}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="cp-answer-asof">{SAMPLE_ANSWER.asOf}</p>
  </div>
);
