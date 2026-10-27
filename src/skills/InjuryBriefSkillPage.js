import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import CopyPrompt from '../connect/CopyPrompt';
import SetupTabs from '../connect/SetupTabs';
import '../connect/ConnectPage.css';
import '../connect/ConnectGuide.css';
import './InjuryBriefSkillPage.css';

export const SKILL_ZIP = '/skills/courtai-injury-brief.zip';
export const ASK = 'Run the injury brief for tonight.';
// The same text as CHATGPT.md in the skill (crf04/statsplus share/courtai-injury-brief).
export const CHATGPT_INSTRUCTIONS = `When I ask for the injury brief (or which spots to target given who is out tonight), follow SKILL.md in this project's files step by step, using the CourtAI plugin for every NBA number and web search for this season's news. Read ANALYSIS.md for how to build each case and EXAMPLES.md for real examples. Write the brief in the chat, games first, then the graded spots, then publish it as a CourtAI report and give me the link. CourtAI reports facts; the grades are your reading of them, and I make the final call.`;

const Download = () => (
  <a className="skill-download" href={SKILL_ZIP} download>
    Download the skill (.zip)
  </a>
);

const Ask = () => (
  <>
    ask <q>{ASK}</q> <CopyPrompt text={ASK} label="Copy" />
  </>
);

const CLIENTS = [
  {
    id: 'claude',
    name: 'Claude',
    note: (
      <>
        Web or desktop app. Skills need code execution: turn on{' '}
        <strong>Settings → Capabilities → Code execution and file creation</strong> first.
      </>
    ),
    steps: [
      <>
        <Download />
      </>,
      <>
        Open <strong>Customize → Skills</strong>, select <strong>+</strong>, then{' '}
        <strong>Create skill → Upload a skill</strong>, and choose the zip.
      </>,
      <>
        In a chat, turn the CourtAI connector on (<strong>+ → Connectors</strong>) and <Ask />
      </>,
    ],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    note: <>The skill installs as a folder under your personal skills.</>,
    steps: [
      <>
        <Download />
      </>,
      <>
        Unzip it into your skills folder:{' '}
        <code>unzip courtai-injury-brief.zip -d ~/.claude/skills/</code>
      </>,
      <>
        Add CourtAI with{' '}
        <code>claude mcp add --transport http courtai https://mcp.courtai.app/mcp</code>, run{' '}
        <code>/mcp</code> in Claude Code to sign in, then <Ask />
      </>,
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    note: (
      <>
        ChatGPT has no skill format, so the brief runs as a <strong>Project</strong> whose files are
        the skill. It needs the CourtAI plugin, which you can add on the web.
      </>
    ),
    steps: [
      <>
        <Download /> and unzip it.
      </>,
      <>
        Create a Project and add <code>SKILL.md</code>, <code>ANALYSIS.md</code> and{' '}
        <code>EXAMPLES.md</code> to its files.
      </>,
      <>
        Paste these into the Project&apos;s instructions:{' '}
        <CopyPrompt text={CHATGPT_INSTRUCTIONS} label="Copy instructions" />
        <blockquote className="skill-instructions">{CHATGPT_INSTRUCTIONS}</blockquote>
      </>,
      <>
        In a chat inside the Project, turn the CourtAI plugin on and <Ask />
      </>,
    ],
  },
];

const InjuryBriefSkillPage = () => {
  const headingRef = useRef(null);
  // A client-side route change moves no focus on its own.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="connect-page skill-page">
      <div className="skill-hero">
        <p className="connect-eyebrow">CourtAI skill</p>
        <h1 className="connect-title" tabIndex={-1} ref={headingRef}>
          Injury brief
        </h1>
        <p className="connect-lede">
          Most nights a few absences change someone&apos;s role before the line catches up. This
          skill has your assistant read the whole injury report with CourtAI, work out who actually
          gains, check it against tonight&apos;s lines, and write you a short brief. The research is
          the assistant&apos;s; the call is yours.
        </p>
      </div>

      <section className="skill-section" aria-labelledby="skill-what">
        <h2 id="skill-what">What you get</h2>
        <ul className="skill-points">
          <li>
            <strong>Every game first.</strong> Who is out on both sides, who stands to gain, and the
            number that shows it, with CourtAI&apos;s cards.
          </li>
          <li>
            <strong>Graded spots.</strong> Each bet as strong, lean, thin or pass, with its
            rotation, usage, record against tonight&apos;s line, matchup, and what would lose it.
          </li>
          <li>
            <strong>Checked against this season.</strong> Roster moves and tonight&apos;s news from
            the web, with a source on every fact and the injury report time it used.
          </li>
        </ul>
        <p className="skill-fine">
          A spot is a place to look, not a pick. The method is{' '}
          <a href="https://x.com/bighatprops" target="_blank" rel="noreferrer">
            @bighatprops
          </a>
          &apos;s, distilled from 131 of his write-ups. A slate takes a few dozen CourtAI calls on
          your account.
        </p>
      </section>

      <section className="skill-section" aria-labelledby="skill-setup">
        <h2 id="skill-setup">Set it up</h2>
        <p className="connect-note">
          First add CourtAI to your chat app: <Link to="/connect#guide-setup">Connect</Link> has the
          steps.
        </p>
        <SetupTabs clients={CLIENTS} label="Where you run it" idPrefix="skill" />
      </section>
    </main>
  );
};

export default InjuryBriefSkillPage;
