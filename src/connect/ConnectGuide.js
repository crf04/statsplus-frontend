import Capabilities from './Capabilities';
import { CONNECT_CLIP } from './connectClip';
import CopyPrompt from './CopyPrompt';
import ClipPlayer from './ClipPlayer';
import { Anatomy, OutcomeRuns } from './OutcomeRuns';
import ResearchRun from './ResearchRun';
import './ConnectGuide.css';

const LESSONS = [
  { id: 'guide-setup', title: 'Connect CourtAI' },
  { id: 'guide-ask', title: 'Ask one question' },
  { id: 'guide-outcome', title: 'Hand it an outcome' },
  { id: 'guide-research', title: 'Let it run the research' },
  { id: 'guide-tools', title: 'Everything it can do' },
];

// How to phrase a question, each with a prompt the production connector answers.
const ASKING = [
  {
    rule: 'Name the player and the opponent',
    why: 'That is enough for a Matchup, even with no game scheduled. It reads the latest season CourtAI has, and says which.',
    prompt: "Show Cade Cunningham's matchup against Charlotte.",
  },
  {
    rule: 'Give a date when you mean one',
    why: 'Dates default to today in US Eastern time. On a day with no games, the Slate and Matchups use the next game day and say so.',
    prompt: "What's on the slate for April 10, 2026?",
  },
  {
    rule: 'Say the stat',
    why: 'A Matchup covers every stat, but the answer talks about points unless you name another: rebounds, assists, threes, steals, blocks or a combination like PRA.',
    prompt: "Show Cade Cunningham's assists matchup against Charlotte.",
  },
  {
    rule: 'Add the condition you care about',
    why: 'Game logs filter by opponent rank, teammates out, minutes, home or away, and dates.',
    prompt: 'How did Daniss Jenkins do in the games Cade Cunningham missed last season?',
  },
];

// Opens a new Claude chat with the prompt in the composer.
const claudeChatUrl = (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;

const Lesson = ({ id, children }) => {
  const index = LESSONS.findIndex((lesson) => lesson.id === id);
  return (
    <section className="guide-lesson" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="guide-lesson-title">
        <span className="guide-lesson-n" aria-hidden="true">
          {index + 1}
        </span>
        {LESSONS[index].title}
      </h2>
      {children}
    </section>
  );
};

const Asking = () => (
  <>
    <p className="guide-p">
      Turn CourtAI on in a chat and ask in your own words. You don&apos;t need tool names; the chat
      picks the tool from your question. <strong>Ask Claude</strong> opens a new Claude chat with
      the prompt filled in. A few habits get you better answers:
    </p>
    <ol className="guide-ask">
      {ASKING.map(({ rule, why, prompt }) => (
        <li key={rule}>
          <div>
            <p className="guide-rule">{rule}</p>
            <p className="guide-why">{why}</p>
          </div>
          <div className="guide-try">
            <p className="guide-try-prompt">{prompt}</p>
            <div className="guide-try-actions">
              <CopyPrompt text={prompt} label="Copy" />
              <a
                className="guide-copy"
                href={claudeChatUrl(prompt)}
                target="_blank"
                rel="noreferrer"
              >
                Ask Claude
              </a>
            </div>
          </div>
        </li>
      ))}
    </ol>
  </>
);

const Replay = ({ label, children }) => (
  <details className="guide-fold">
    <summary>
      <span className="guide-fold-label">{label}</span>
      <span className="guide-fold-hint">the calls, why and what each returned</span>
    </summary>
    <div className="guide-fold-body">{children}</div>
  </details>
);

const ConnectGuide = ({ setup }) => (
  <div className="guide">
    <nav className="guide-toc" aria-label="In this guide">
      <p className="guide-toc-head">In this guide</p>
      <ol>
        {LESSONS.map((lesson, index) => (
          <li key={lesson.id}>
            <a href={`#${lesson.id}`}>
              <span aria-hidden="true">{index + 1}</span>
              {lesson.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>

    <div className="guide-body">
      <Lesson id="guide-setup">
        <p className="guide-p">
          Add the connector URL above to your chat app once. Pick your app for its steps.
        </p>
        <div id="connect-setup">{setup}</div>
      </Lesson>

      <Lesson id="guide-ask">
        {CONNECT_CLIP ? (
          <div className="clip-intro">
            <div>
              <Asking />
            </div>
            <ClipPlayer clip={CONNECT_CLIP} />
          </div>
        ) : (
          <Asking />
        )}
      </Lesson>

      <Lesson id="guide-outcome">
        <p className="guide-p">
          You don&apos;t have to ask one question at a time. Describe the result you want and the
          chat decides which CourtAI tools to call, in what order, passing what each answer returns
          (a player, a date, the exact row behind a rank) into the next call. You see each call in
          the chat as it runs.
        </p>
        <p className="guide-p">A good outcome prompt has four parts:</p>
        <Anatomy />
        <Replay label="Step through four runs">
          <p className="guide-p">
            Four outcome prompts and the calls the chat chose for each. None of them names a tool.
          </p>
          <OutcomeRuns />
          <ul className="guide-tips">
            <li>
              <strong>Ask for the proof.</strong> &ldquo;Check whether it held up&rdquo; makes it
              pull past games instead of stopping at the Matchup.
            </li>
            <li>
              <strong>Ask for sample sizes.</strong> A split from 4 games and one from 40 read the
              same until you see the count.
            </li>
            <li>
              <strong>Push back.</strong> If a step looks thin, say so: &ldquo;only use games after
              the trade&rdquo; or &ldquo;try 30% instead of 25%&rdquo; reruns that call with the
              change.
            </li>
          </ul>
        </Replay>
      </Lesson>

      <Lesson id="guide-research">
        <p className="guide-p">
          An outcome has an answer you can picture. Research doesn&apos;t: you hand over a question
          and a standard of proof, and the chat works it like an analyst would. It surveys the
          night, picks leads, tests each one against past games, looks for the reason a lead might
          be wrong, and comes back with what survived and what it threw out.
        </p>
        <p className="guide-p">
          The brief matters more than the question. Say how to work and what counts as good enough;
          the chat decides every call. This is one real run:
        </p>
        <Replay label="Step through the whole run">
          <ResearchRun />
          <ul className="guide-tips">
            <li>
              <strong>Ask for what it dropped.</strong> The dropped leads are how you know it tested
              anything. A report with only winners hasn&apos;t looked for reasons to be wrong.
            </li>
            <li>
              <strong>Set the bar in the brief.</strong> &ldquo;At least 10 games&rdquo; or
              &ldquo;over the line in two thirds of them&rdquo; turns its judgement into your rule.
            </li>
            <li>
              <strong>Keep going in the same chat.</strong> &ldquo;Look closer at Queta&rdquo; or
              &ldquo;run the same check on the other five games&rdquo; picks up where it stopped.
            </li>
          </ul>
        </Replay>
      </Lesson>

      <Lesson id="guide-tools">
        <p className="guide-p">
          The lessons above use a few tools. This is all of them: every kind of question CourtAI
          answers, with a prompt to copy and the answer it actually gave. Filter by the job you have
          in mind.
        </p>
        <Capabilities />
      </Lesson>
    </div>
  </div>
);

export default ConnectGuide;
