// PROTOTYPE (throwaway, branch prototype/connect-page-look): four looks for
// the Connect page, picked with `#v=A|B|C|D`.
import { useEffect, useRef } from 'react';
import LandingCourt from '../LandingCourt';
import '../ModernSearch.css';
import {
  AnswerCard,
  CLIENTS,
  ClientTabs,
  CopyUrl,
  NOTES,
  SAMPLE_ANSWER,
  Steps,
  TOOLS,
} from './content';
import { useProto } from './protoState';
import './ConnectPrototype.css';

const CardTag = () => <span className="cp-tag">Card in Claude</span>;

const Notes = () => (
  <section className="cp-section" aria-labelledby="cp-notes-h">
    <h2 id="cp-notes-h" className="cp-h2">
      Good to know
    </h2>
    <dl className="cp-notes">
      {NOTES.map((note) => (
        <div key={note.title}>
          <dt>{note.title}</dt>
          <dd>{note.body}</dd>
        </div>
      ))}
    </dl>
  </section>
);

/** A: the current guide, tightened — URL in the hero, tools as cards. */
const VariantA = ({ headingRef }) => (
  <main className="cp cp-a">
    <header className="cp-hero">
      <p className="cp-eyebrow">CourtAI Connect</p>
      <h1 className="cp-title" tabIndex={-1} ref={headingRef}>
        Use CourtAI in Claude or ChatGPT
      </h1>
      <p className="cp-lede">
        Ask about matchups, slates, your Targets and game logs in plain English, answered from your
        CourtAI account. Add one URL and sign in with Google.
      </p>
      <CopyUrl className="cp-url-hero" />
    </header>

    <section className="cp-section" aria-labelledby="cp-a-tools">
      <h2 id="cp-a-tools" className="cp-h2">
        What you can ask
      </h2>
      <ul className="cp-tools">
        {TOOLS.map((tool) => (
          <li key={tool.key} className="cp-tool">
            <div className="cp-tool-head">
              <h3>{tool.name}</h3>
              {tool.card && <CardTag />}
            </div>
            <p>{tool.blurb}</p>
            <q>{tool.prompt}</q>
          </li>
        ))}
      </ul>
    </section>

    <section className="cp-section" aria-labelledby="cp-a-setup">
      <h2 id="cp-a-setup" className="cp-h2">
        Set it up
      </h2>
      <div className="cp-clients">
        {CLIENTS.map((client) => (
          <section key={client.name} className="cp-client" aria-labelledby={`cp-a-${client.name}`}>
            <h3 id={`cp-a-${client.name}`}>{client.name}</h3>
            <p className="cp-note">{client.note}</p>
            <Steps client={client} className="cp-steps-dots" />
          </section>
        ))}
      </div>
    </section>

    <Notes />
  </main>
);

/** B: show the payoff first — a real answer beside the URL. */
const VariantB = ({ headingRef }) => (
  <main className="cp cp-b">
    <header className="cp-b-hero">
      <div className="cp-b-copy">
        <p className="cp-eyebrow">CourtAI Connect</p>
        <h1 className="cp-title" tabIndex={-1} ref={headingRef}>
          Ask CourtAI from your chat
        </h1>
        <p className="cp-lede">
          Add CourtAI to Claude or ChatGPT and ask about tonight&apos;s matchups in your own words.
          Answers come from your CourtAI account, with the date their data is as of.
        </p>
        <CopyUrl />
        <p className="cp-b-jump">
          Then follow the steps for <a href="#cp-b-setup">Claude or ChatGPT</a>.
        </p>
      </div>

      <figure className="cp-chat" aria-label="An example conversation">
        <div className="cp-chat-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="cp-bubble cp-bubble-user">{SAMPLE_ANSWER.question}</div>
        <div className="cp-bubble cp-bubble-ai">
          <p>
            Points lean slightly favourable: <strong>+0.4% vs league</strong>. The edge is his
            pick-and-roll: 37% of his plays, and Charlotte ranks 26th against it.
          </p>
          <AnswerCard />
        </div>
        <figcaption>A real answer from the connector, trimmed to points.</figcaption>
      </figure>
    </header>

    <section className="cp-section" aria-labelledby="cp-b-setup" id="cp-b-setup">
      <h2 id="cp-b-setup-h" className="cp-h2">
        Set it up
      </h2>
      <ClientTabs idPrefix="cp-b" />
    </section>

    <section className="cp-section" aria-labelledby="cp-b-ask">
      <h2 id="cp-b-ask" className="cp-h2">
        Try asking
      </h2>
      <ul className="cp-chips">
        {TOOLS.map((tool) => (
          <li key={tool.key}>
            <span className="cp-chip-tool">{tool.name}</span>
            {tool.prompt}
          </li>
        ))}
      </ul>
    </section>

    <Notes />
  </main>
);

/** C: the whole page is the three steps. */
const VariantC = ({ headingRef }) => (
  <main className="cp cp-c">
    <header className="cp-hero cp-c-hero">
      <h1 className="cp-title" tabIndex={-1} ref={headingRef}>
        CourtAI in Claude or ChatGPT
      </h1>
      <p className="cp-lede">Three steps, about two minutes.</p>
    </header>

    <ol className="cp-c-flow">
      <li className="cp-c-step">
        <span className="cp-c-num" aria-hidden="true">
          01
        </span>
        <div className="cp-c-body">
          <h2 className="cp-c-h">Copy the connector URL</h2>
          <CopyUrl />
        </div>
      </li>
      <li className="cp-c-step">
        <span className="cp-c-num" aria-hidden="true">
          02
        </span>
        <div className="cp-c-body">
          <h2 className="cp-c-h">Add it to your chat app</h2>
          <ClientTabs idPrefix="cp-c" />
        </div>
      </li>
      <li className="cp-c-step">
        <span className="cp-c-num" aria-hidden="true">
          03
        </span>
        <div className="cp-c-body">
          <h2 className="cp-c-h">Ask</h2>
          <ul className="cp-c-asks">
            {TOOLS.map((tool) => (
              <li key={tool.key}>
                <span className="cp-c-tool">{tool.name}</span>
                <q>{tool.prompt}</q>
                <span className="cp-c-blurb">{tool.blurb}</span>
              </li>
            ))}
          </ul>
          <p className="cp-note">
            In Claude, Slate, Matchup and Game-log answers open as interactive cards.
          </p>
        </div>
      </li>
    </ol>

    <Notes />
  </main>
);

/** D: the landing page's floor and type, tools as a box score. */
const VariantD = ({ headingRef }) => (
  <main className="cp cp-d">
    <header className="cp-d-hero">
      <LandingCourt />
      <h1 className="cp-d-title" tabIndex={-1} ref={headingRef}>
        Ask from <em>your chat</em>
      </h1>
      <p className="cp-d-tagline">
        CourtAI in Claude or ChatGPT. One URL, a Google sign-in, and your account comes with you.
      </p>
      <CopyUrl className="cp-d-url" />
    </header>

    <section className="cp-section" aria-labelledby="cp-d-tools">
      <h2 id="cp-d-tools" className="cp-h2">
        The lineup
      </h2>
      <table className="cp-d-table">
        <thead>
          <tr>
            <th scope="col">Tool</th>
            <th scope="col">Answers</th>
            <th scope="col">Try</th>
            <th scope="col">Card</th>
          </tr>
        </thead>
        <tbody>
          {TOOLS.map((tool) => (
            <tr key={tool.key}>
              <th scope="row">{tool.name}</th>
              <td>{tool.blurb}</td>
              <td>
                <q>{tool.prompt}</q>
              </td>
              <td className="cp-d-card">{tool.card ? 'Claude' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <section className="cp-section" aria-labelledby="cp-d-setup">
      <h2 id="cp-d-setup" className="cp-h2">
        Set it up
      </h2>
      <div className="cp-clients">
        {CLIENTS.map((client) => (
          <section key={client.name} className="cp-client" aria-labelledby={`cp-d-${client.name}`}>
            <h3 id={`cp-d-${client.name}`}>{client.name}</h3>
            <p className="cp-note">{client.note}</p>
            <Steps client={client} className="cp-steps-dots" />
          </section>
        ))}
      </div>
    </section>

    <Notes />
  </main>
);

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD };

const ConnectPrototype = () => {
  const { v } = useProto();
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [v]);
  const Variant = VARIANTS[v] || VariantA;
  return <Variant headingRef={headingRef} />;
};

export default ConnectPrototype;
