// PROTOTYPE (throwaway): where the landing page mentions the connector.
// NaturalLanguageQuery mounts one slot per position; only the slot matching
// `#h=` renders.
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PROTO_ENABLED, useProto } from './protoState';
import './HomeConnectSlot.css';

const Eyebrow = () => (
  <Link to="/connect" className="hc-eyebrow">
    <span className="hc-eyebrow-new">New</span>
    Ask CourtAI in Claude or ChatGPT
    <ArrowRight size={14} aria-hidden="true" />
  </Link>
);

const ThirdDoor = () => (
  <p className="hc-door">
    Rather ask in a chat?{' '}
    <Link to="/connect" className="hc-door-link">
      Add CourtAI to Claude or ChatGPT
    </Link>
  </p>
);

const Card = () => (
  <aside className="hc-card" aria-labelledby="hc-card-h">
    <div className="hc-card-copy">
      <p className="hc-card-kicker">CourtAI Connect</p>
      <h2 id="hc-card-h">Ask CourtAI from Claude or ChatGPT</h2>
      <p>
        Slates, Matchups, game logs and your Targets, answered in the chat you already use. One URL
        and a Google sign-in.
      </p>
      <Link to="/connect" className="hc-card-cta">
        Set it up <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
    <div className="hc-card-chat" aria-hidden="true">
      <div className="hc-card-bubble hc-card-user">
        Show Cade Cunningham&apos;s matchup against Charlotte.
      </div>
      <div className="hc-card-bubble hc-card-ai">
        Points lean slightly favourable, <strong>+0.4% vs league</strong>. Charlotte ranks 26th
        against his pick-and-roll…
      </div>
    </div>
  </aside>
);

const Ticker = () => (
  <Link to="/connect" className="hc-ticker">
    <span className="hc-ticker-tag">Connect</span>
    <span className="hc-ticker-text">
      CourtAI now answers in Claude and ChatGPT. Ask about tonight&apos;s slate in your own words.
    </span>
    <span className="hc-ticker-cta">
      Set it up <ArrowRight size={14} aria-hidden="true" />
    </span>
  </Link>
);

const SLOTS = {
  eyebrow: ['1', Eyebrow],
  door: ['2', ThirdDoor],
  card: ['3', Card],
  ticker: ['4', Ticker],
};

const Slot = ({ at }) => {
  const { h } = useProto();
  const [id, Component] = SLOTS[at];
  return h === id ? <Component /> : null;
};

const HomeConnectSlot = ({ at }) => (PROTO_ENABLED ? <Slot at={at} /> : null);

export default HomeConnectSlot;
