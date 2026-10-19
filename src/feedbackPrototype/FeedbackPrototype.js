/*
 * PROTOTYPE — throwaway (branch prototype/feedback-look). See ./prototypeMode.js
 * for the question. Four variants, each owning its entry point, its form, and
 * what it puts next to a visible "(ref …)" error. Sending is a stub: the
 * message lands in an in-memory outbox, rendered as the email Chris would get.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUp,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Lightbulb,
  MessageCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Ruler,
  X,
} from 'lucide-react';
import config from '../config';
import { useAuth } from '../contexts/AuthContext';
import { VARIANT_KEYS, VARIANT_NAMES, useVariant } from './prototypeMode';
import './prototype.css';

const Ctx = createContext(null);
const useProto = () => useContext(Ctx);

const REF_PATTERN = /\(ref ([0-9a-f]{8})\)/;

/** The first "(ref …)" an error line on screen shows, if any. */
const visibleRef = () => {
  for (const el of document.querySelectorAll('[role="alert"]')) {
    const match = el.textContent.match(REF_PATTERN);
    if (match) return match[1];
  }
  return null;
};

export function FeedbackProtoProvider({ children }) {
  const proto = useVariant();
  const { currentUser } = useAuth();
  const { pathname, search } = useLocation();
  const [outbox, setOutbox] = useState(() =>
    JSON.parse(window.sessionStorage.getItem('courtai:feedback-proto-outbox') || '[]'),
  );
  useEffect(() => {
    window.sessionStorage.setItem('courtai:feedback-proto-outbox', JSON.stringify(outbox));
  }, [outbox]);
  const [toast, setToast] = useState(null);
  // Which surface is open, and what it was opened with (an error ref).
  const [panel, setPanel] = useState(null);

  const open = useCallback((opts = {}) => setPanel({ ref: visibleRef(), ...opts }), []);
  const close = useCallback(() => setPanel(null), []);

  useEffect(() => {
    setPanel(null);
  }, [proto.variant]);

  const send = useCallback(
    ({ message, kind, replyOk, screenshot, ref, via }) => {
      setOutbox((items) => [
        {
          id: Date.now(),
          message,
          kind,
          replyOk,
          screenshot,
          ref,
          via,
          variant: proto.variant,
          page: `${pathname}${search}`,
          version: config.APP_VERSION,
          name: currentUser?.displayName,
          email: currentUser?.email,
          viewport: `${window.innerWidth}×${window.innerHeight}`,
          at: new Date().toISOString(),
        },
        ...items,
      ]);
      // The chat confirms inside its own thread.
      if (via !== 'Chat dock') {
        setToast('Sent. Thanks — Chris reads every one.');
        window.setTimeout(() => setToast(null), 3200);
      }
    },
    [currentUser, pathname, search, proto.variant],
  );

  return (
    <Ctx.Provider value={{ ...proto, outbox, send, panel, open, close, toast, currentUser }}>
      {children}
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                          */
/* ------------------------------------------------------------------ */

const ScreenshotThumb = ({ page }) => (
  <div className="fbp-shot" aria-label="Screenshot preview">
    <div className="fbp-shot-bar" />
    <div className="fbp-shot-body">
      <span>{page}</span>
    </div>
  </div>
);

const ReplyCheck = ({ checked, onChange, email }) => (
  <label className="fbp-check">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>OK to email me back{email ? <> at {email}</> : null}</span>
  </label>
);

const usePage = () => {
  const { pathname } = useLocation();
  return pathname;
};

/* ------------------------------------------------------------------ */
/* A — Header link → popover                                            */
/* ------------------------------------------------------------------ */

function AHeader() {
  const { panel, open, close } = useProto();
  return (
    <button
      type="button"
      className={`fbp-a-trigger ${panel ? 'is-open' : ''}`}
      onClick={() => (panel ? close() : open())}
      aria-expanded={Boolean(panel)}
    >
      <MessageSquarePlus size={16} />
      <span>Feedback</span>
    </button>
  );
}

function APopover() {
  const { panel, close, send, currentUser } = useProto();
  const page = usePage();
  const [message, setMessage] = useState('');
  const [replyOk, setReplyOk] = useState(true);
  const [screenshot, setScreenshot] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const ref = panel.ref;
  return (
    <div className="fbp-a-pop" role="dialog" aria-label="Send feedback">
      <div className="fbp-a-head">
        <strong>{ref ? 'Report this error' : 'Feedback'}</strong>
        <button type="button" className="fbp-icon" onClick={close} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <textarea
        ref={box}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          ref
            ? 'What were you doing when this happened?'
            : 'What’s working, what’s broken, what’s missing?'
        }
      />
      <div className="fbp-a-opts">
        <ReplyCheck checked={replyOk} onChange={setReplyOk} email={currentUser?.email} />
        <label className="fbp-check">
          <input
            type="checkbox"
            checked={screenshot}
            onChange={(e) => setScreenshot(e.target.checked)}
          />
          <span>Include a screenshot of this page</span>
        </label>
        {screenshot && <ScreenshotThumb page={page} />}
      </div>
      <p className="fbp-fine">
        Also sends this page’s address and the app version
        {ref ? (
          <>
            , and error <code>ref {ref}</code>
          </>
        ) : null}
        .
      </p>
      <div className="fbp-actions">
        <button
          type="button"
          className="fbp-primary"
          disabled={!message.trim()}
          onClick={() => {
            send({ message, replyOk, screenshot, ref, via: 'Header link' });
            close();
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function ARef({ refId }) {
  const { open } = useProto();
  return (
    <button type="button" className="fbp-a-reflink" onClick={() => open({ ref: refId })}>
      Report this
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* B — Floating tab → pick a kind → drawer                              */
/* ------------------------------------------------------------------ */

const KINDS = [
  {
    key: 'broken',
    label: 'Something’s broken',
    icon: AlertTriangle,
    prompt: 'What were you doing, and what happened?',
  },
  {
    key: 'wrong',
    label: 'A number looks wrong',
    icon: Ruler,
    prompt: 'Which number, and what did you expect it to be?',
  },
  {
    key: 'wish',
    label: 'I wish it could…',
    icon: Lightbulb,
    prompt: 'What were you trying to find out?',
  },
  { key: 'other', label: 'Something else', icon: MoreHorizontal, prompt: 'What’s on your mind?' },
];

function BLauncher() {
  const { panel, open } = useProto();
  if (panel) return null;
  return (
    <button type="button" className="fbp-b-launch" onClick={() => open()}>
      <MessageCircle size={18} />
      <span>Feedback</span>
    </button>
  );
}

function BDrawer() {
  const { panel, close, send, currentUser } = useProto();
  const page = usePage();
  const [kind, setKind] = useState(panel.ref ? 'broken' : null);
  const [message, setMessage] = useState('');
  const [replyOk, setReplyOk] = useState(true);
  const [screenshot, setScreenshot] = useState(Boolean(panel.ref));
  const chosen = KINDS.find((k) => k.key === kind);
  return (
    <>
      <div className="fbp-scrim" onClick={close} />
      <aside className="fbp-b-drawer" role="dialog" aria-label="Send feedback">
        <div className="fbp-b-head">
          {chosen ? (
            <button type="button" className="fbp-icon" onClick={() => setKind(null)}>
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span />
          )}
          <strong>{chosen ? chosen.label : 'Tell Chris'}</strong>
          <button type="button" className="fbp-icon" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {!chosen ? (
          <div className="fbp-b-kinds">
            <p className="fbp-b-lede">What kind of thing?</p>
            {KINDS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" className="fbp-b-kind" onClick={() => setKind(key)}>
                <Icon size={18} />
                <span>{label}</span>
                <ChevronRight size={16} className="fbp-b-chev" />
              </button>
            ))}
          </div>
        ) : (
          <div className="fbp-b-form">
            <label className="fbp-b-q" htmlFor="fbp-b-msg">
              {chosen.prompt}
            </label>
            <textarea
              id="fbp-b-msg"
              autoFocus
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {panel.ref && (
              <p className="fbp-b-ctx">
                Error <code>ref {panel.ref}</code> is attached.
              </p>
            )}
            <div className="fbp-b-toggle">
              <span>Screenshot</span>
              <button
                type="button"
                role="switch"
                aria-checked={screenshot}
                className={`fbp-switch ${screenshot ? 'on' : ''}`}
                onClick={() => setScreenshot(!screenshot)}
              >
                <i />
              </button>
            </div>
            {screenshot && <ScreenshotThumb page={page} />}
            <ReplyCheck checked={replyOk} onChange={setReplyOk} email={currentUser?.email} />
            <button
              type="button"
              className="fbp-primary fbp-wide"
              disabled={!message.trim()}
              onClick={() => {
                send({
                  message,
                  kind: chosen.label,
                  replyOk,
                  screenshot,
                  ref: panel.ref,
                  via: 'Floating tab',
                });
                close();
              }}
            >
              Send to Chris
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function BRef({ refId }) {
  const { send } = useProto();
  const [state, setState] = useState('closed');
  const [message, setMessage] = useState('');
  if (state === 'sent')
    return (
      <span className="fbp-b-refcard is-sent">
        <Check size={14} /> Thanks. Chris has <code>ref {refId}</code> and what you wrote.
      </span>
    );
  return (
    <span className={`fbp-b-refcard ${state === 'open' ? 'is-open' : ''}`}>
      {state === 'closed' ? (
        <button type="button" className="fbp-b-refbtn" onClick={() => setState('open')}>
          This failed on our side. Tell Chris what you were doing <ChevronRight size={14} />
        </button>
      ) : (
        <>
          <textarea
            autoFocus
            rows={2}
            value={message}
            placeholder="e.g. opened Matchups from the home page on my phone"
            onChange={(e) => setMessage(e.target.value)}
          />
          <span className="fbp-b-refrow">
            <span className="fbp-fine">
              Sends <code>ref {refId}</code>, this page and a screenshot.
            </span>
            <button
              type="button"
              className="fbp-primary"
              onClick={() => {
                send({
                  message: message || '(no note)',
                  kind: 'Something’s broken',
                  replyOk: true,
                  screenshot: true,
                  ref: refId,
                  via: 'Inline error card',
                });
                setState('sent');
              }}
            >
              Send
            </button>
          </span>
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* C — Account menu + footer → dialog with visible, removable context   */
/* ------------------------------------------------------------------ */

function CDialog() {
  const { panel, close, send, currentUser } = useProto();
  const page = usePage();
  const [message, setMessage] = useState('');
  const [replyOk, setReplyOk] = useState(true);
  const [chips, setChips] = useState({ page: true, ref: Boolean(panel.ref), screenshot: false });
  const drop = (key) => setChips((c) => ({ ...c, [key]: false }));
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className="fbp-c-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="fbp-c-dialog" role="dialog" aria-modal="true" aria-label="Send feedback">
        <div className="fbp-c-head">
          <h2>Send feedback</h2>
          <button type="button" className="fbp-icon" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="fbp-c-lede">
          It goes straight to Chris, who builds CourtAI. Bugs, wrong numbers, things you wish it did
          — all of it helps.
        </p>
        <textarea
          autoFocus
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={panel.ref ? 'Add a note about what you were doing (optional)' : ''}
        />
        <div className="fbp-c-attached">
          <span className="fbp-c-label">Attached</span>
          {chips.page && (
            <span className="fbp-chip">
              Page <code>{page}</code>
              <button type="button" onClick={() => drop('page')} aria-label="Remove page">
                <X size={12} />
              </button>
            </span>
          )}
          <span className="fbp-chip">
            Version <code>{config.APP_VERSION}</code>
          </span>
          {chips.ref && (
            <span className="fbp-chip is-ref">
              Error <code>ref {panel.ref}</code>
              <button type="button" onClick={() => drop('ref')} aria-label="Remove error ref">
                <X size={12} />
              </button>
            </span>
          )}
          {chips.screenshot ? (
            <span className="fbp-chip">
              Screenshot
              <button type="button" onClick={() => drop('screenshot')} aria-label="Remove">
                <X size={12} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="fbp-chip is-add"
              onClick={() => setChips((c) => ({ ...c, screenshot: true }))}
            >
              <Camera size={12} /> Add screenshot
            </button>
          )}
        </div>
        {chips.screenshot && <ScreenshotThumb page={page} />}
        <ReplyCheck checked={replyOk} onChange={setReplyOk} email={currentUser?.email} />
        <div className="fbp-actions">
          <button type="button" className="fbp-ghost" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="fbp-primary"
            disabled={!message.trim() && !chips.ref}
            onClick={() => {
              send({
                message: message || '(no note)',
                replyOk,
                screenshot: chips.screenshot,
                ref: chips.ref ? panel.ref : null,
                via: panel.via || 'Account menu',
              });
              close();
            }}
          >
            Send feedback
          </button>
        </div>
      </div>
    </div>
  );
}

function CRef({ refId }) {
  const { send, open } = useProto();
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <span className="fbp-c-refdone">
        <Check size={14} /> Reported.{' '}
        <button type="button" onClick={() => open({ ref: refId, via: 'Error note' })}>
          Add a note
        </button>
      </span>
    );
  return (
    <button
      type="button"
      className="fbp-c-refbtn"
      onClick={() => {
        send({
          message: '(one-click report, no note)',
          replyOk: false,
          screenshot: false,
          ref: refId,
          via: 'One-click error report',
        });
        setSent(true);
      }}
    >
      Send report
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* D — Talk to Chris: a chat dock in the founder's voice                */
/* ------------------------------------------------------------------ */

function DDock() {
  const { panel, open, close, send, currentUser } = useProto();
  const page = usePage();
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState('');
  const [shot, setShot] = useState(false);
  const [nudge, setNudge] = useState(null);
  const [replyOk, setReplyOk] = useState(true);
  const end = useRef(null);

  // An error with a ref on screen: the dock speaks up once, without opening.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const ref = visibleRef();
      setNudge((current) => (ref && current !== 'dismissed' && !panel ? ref : current));
    }, 600);
    return () => window.clearInterval(timer);
  }, [panel]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [thread, panel]);

  const submit = () => {
    if (!draft.trim()) return;
    const ref = panel?.ref;
    send({ message: draft, replyOk, screenshot: shot, ref, via: 'Chat dock' });
    setThread((t) => [...t, { from: 'me', text: draft, shot, ref }]);
    setDraft('');
    setShot(false);
  };

  if (!panel)
    return (
      <div className="fbp-d-dockwrap">
        {nudge && nudge !== 'dismissed' && (
          <div className="fbp-d-nudge">
            <button
              type="button"
              className="fbp-icon fbp-d-nudge-x"
              aria-label="Dismiss"
              onClick={() => setNudge('dismissed')}
            >
              <X size={14} />
            </button>
            <p>
              That didn’t load (<code>ref {nudge}</code>). Want to tell me what you were doing?
            </p>
            <button
              type="button"
              className="fbp-d-nudge-go"
              onClick={() => {
                open({ ref: nudge });
                setNudge('dismissed');
              }}
            >
              Tell Chris
            </button>
          </div>
        )}
        <button type="button" className="fbp-d-dock" onClick={() => open()}>
          <span className="fbp-d-avatar">CF</span>
          <span className="fbp-d-docklabel">Talk to Chris</span>
        </button>
      </div>
    );

  return (
    <section className="fbp-d-panel" role="dialog" aria-label="Talk to Chris">
      <header className="fbp-d-head">
        <span className="fbp-d-avatar is-lg">CF</span>
        <span>
          <strong>Chris</strong>
          <small>Built CourtAI · replies by email</small>
        </span>
        <button type="button" className="fbp-icon" onClick={close} aria-label="Close">
          <X size={18} />
        </button>
      </header>
      <div className="fbp-d-thread">
        <p className="fbp-d-msg is-them">Hey — I’m Chris. I built CourtAI on my own.</p>
        <p className="fbp-d-msg is-them">
          What were you looking up today? If something’s broken, confusing, or missing, tell me
          here. I read every message.
        </p>
        {panel.ref && (
          <p className="fbp-d-msg is-them">
            I can see that last request failed (<code>ref {panel.ref}</code>) — it’ll be attached,
            so just tell me what you were doing.
          </p>
        )}
        {thread.map((m, i) => (
          <div key={i} className="fbp-d-mine">
            <p className="fbp-d-msg is-me">{m.text}</p>
            {m.shot && <span className="fbp-d-meta">+ screenshot of {page}</span>}
          </div>
        ))}
        {thread.length > 0 && (
          <p className="fbp-d-sys">
            <Check size={12} /> Sent to Chris.{' '}
            {replyOk ? <>He’ll reply to {currentUser?.email}.</> : 'No reply requested.'}
          </p>
        )}
        <div ref={end} />
      </div>
      <footer className="fbp-d-compose">
        {shot && (
          <span className="fbp-chip">
            <Camera size={12} /> Screenshot of {page}
            <button type="button" onClick={() => setShot(false)} aria-label="Remove screenshot">
              <X size={12} />
            </button>
          </span>
        )}
        <div className="fbp-d-row">
          <button
            type="button"
            className={`fbp-icon ${shot ? 'is-on' : ''}`}
            onClick={() => setShot(!shot)}
            aria-label="Attach a screenshot of this page"
            title="Attach a screenshot of this page"
          >
            <Camera size={18} />
          </button>
          <textarea
            autoFocus
            rows={1}
            value={draft}
            placeholder="Message Chris…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            className="fbp-d-send"
            disabled={!draft.trim()}
            onClick={submit}
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </div>
        <label className="fbp-d-reply">
          <input type="checkbox" checked={replyOk} onChange={(e) => setReplyOk(e.target.checked)} />
          Reply to {currentUser?.email}
        </label>
      </footer>
    </section>
  );
}

function DRef() {
  // The dock's nudge carries the error; the line itself stays clean.
  return null;
}

/* ------------------------------------------------------------------ */
/* Slots the app shell mounts                                           */
/* ------------------------------------------------------------------ */

/** Next to the avatar in the header. */
export function FeedbackHeaderSlot() {
  const proto = useProto();
  if (!proto?.active || proto.variant !== 'A') return null;
  return <AHeader />;
}

/** An item in the account dropdown. */
export function FeedbackMenuItem({ Item }) {
  const proto = useProto();
  if (!proto?.active || proto.variant !== 'C') return null;
  return (
    <Item
      onClick={() => proto.open({ via: 'Account menu' })}
      className="d-flex align-items-center gap-2"
    >
      <MessageSquarePlus size={16} />
      Send feedback
    </Item>
  );
}

/** A link in the site footer. */
export function FeedbackFooterSlot() {
  const proto = useProto();
  if (!proto?.active || proto.variant !== 'C') return null;
  return (
    <button
      type="button"
      className="fbp-footer-link"
      onClick={() => proto.open({ via: 'Footer link' })}
    >
      Send feedback
    </button>
  );
}

const REF_AFFORDANCE = { A: ARef, B: BRef, C: CRef, D: DRef };

/** Finds every error line showing a "(ref …)" and gives it a slot to render into. */
function useRefSlots() {
  const [slots, setSlots] = useState([]);
  useEffect(() => {
    const scan = () => {
      const found = [];
      for (const el of document.querySelectorAll('[role="alert"]')) {
        if (el.closest('.fbp-layer')) continue;
        const match = el.textContent.match(REF_PATTERN);
        if (!match) continue;
        let slot = el.querySelector(':scope > .fbp-ref-slot');
        if (!slot) {
          slot = document.createElement('span');
          slot.className = 'fbp-ref-slot';
          el.appendChild(slot);
        }
        found.push({ slot, ref: match[1] });
      }
      setSlots((prev) =>
        prev.length === found.length && prev.every((p, i) => p.slot === found[i].slot)
          ? prev
          : found,
      );
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return slots;
}

function Switcher() {
  const { variant, step, failing, setFailing, outbox } = useProto();
  const [inboxOpen, setInboxOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);
  return (
    <>
      {inboxOpen && <InboxPreview onClose={() => setInboxOpen(false)} />}
      <div className="fbp-switcher" role="toolbar" aria-label="Prototype variants">
        <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
          <ChevronLeft size={16} />
        </button>
        <span className="fbp-switcher-label">
          <b>{variant}</b>
          <span className="fbp-switcher-name">{VARIANT_NAMES[variant]}</span>
        </span>
        <button type="button" onClick={() => step(1)} aria-label="Next variant">
          <ChevronRight size={16} />
        </button>
        <span className="fbp-switcher-sep" />
        <button
          type="button"
          className={`fbp-switcher-pill ${failing ? 'is-on' : ''}`}
          onClick={() => {
            // A full load so the slate refetches (and fails) under the new state.
            setFailing(!failing);
            if (window.location.pathname === '/matchups') window.location.reload();
            else window.location.assign(`/matchups${window.location.hash}`);
          }}
          title="Make the Matchups slate fail with a (ref …), like production does"
        >
          <AlertTriangle size={14} />
          <span className="fbp-switcher-text">{failing ? 'Error on' : 'Show error'}</span>
        </button>
        <button
          type="button"
          className="fbp-switcher-pill"
          onClick={() => setInboxOpen(!inboxOpen)}
          title="What Chris would receive"
        >
          <Inbox size={14} />
          <span className="fbp-switcher-text">Chris’s inbox</span>
          {outbox.length > 0 && <em>{outbox.length}</em>}
        </button>
      </div>
    </>
  );
}

function InboxPreview({ onClose }) {
  const { outbox } = useProto();
  return (
    <div className="fbp-inbox" role="dialog" aria-label="What Chris would receive">
      <div className="fbp-inbox-head">
        <strong>What lands in Chris’s inbox</strong>
        <button type="button" className="fbp-icon" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      {outbox.length === 0 ? (
        <p className="fbp-fine">Nothing sent yet. Send some feedback with any variant.</p>
      ) : (
        outbox.map((m) => (
          <article key={m.id} className="fbp-mail">
            <p className="fbp-mail-subj">
              [CourtAI feedback] {m.kind || 'Feedback'} · {m.page.split('?')[0]}
              {m.ref ? ` · ref ${m.ref}` : ''}
            </p>
            <dl>
              <dt>From</dt>
              <dd>CourtAI &lt;feedback@courtai.app&gt;</dd>
              <dt>Reply-To</dt>
              <dd>{m.replyOk ? `${m.name} <${m.email}>` : '— (didn’t ask for a reply)'}</dd>
            </dl>
            <blockquote>{m.message}</blockquote>
            <dl className="fbp-mail-ctx">
              <dt>Page</dt>
              <dd>
                <code>{m.page}</code>
              </dd>
              <dt>Version</dt>
              <dd>
                <code>{m.version}</code>
              </dd>
              <dt>Error ref</dt>
              <dd>{m.ref ? <code>{m.ref}</code> : '—'}</dd>
              <dt>Screenshot</dt>
              <dd>{m.screenshot ? 'attached' : '—'}</dd>
              <dt>Viewport</dt>
              <dd>{m.viewport}</dd>
              <dt>Sent via</dt>
              <dd>
                {m.via} (variant {m.variant})
              </dd>
              <dt>At</dt>
              <dd>{new Date(m.at).toLocaleString()}</dd>
            </dl>
          </article>
        ))
      )}
    </div>
  );
}

/** Everything that floats: the variant's surface, ref affordances, the switcher. */
export function FeedbackLayer() {
  const proto = useProto();
  const slots = useRefSlots();
  if (!proto?.active) return null;
  const { variant, panel, toast } = proto;
  const RefAffordance = REF_AFFORDANCE[variant];
  return (
    <div className={`fbp-layer fbp-v-${variant}`}>
      {slots.map(({ slot, ref }) =>
        createPortal(<RefAffordance key={`${variant}-${ref}`} refId={ref} />, slot),
      )}
      {variant === 'A' && panel && <APopover key={panel.ref || 'plain'} />}
      {variant === 'B' && <BLauncher />}
      {variant === 'B' && panel && <BDrawer key={panel.ref || 'plain'} />}
      {variant === 'C' && panel && <CDialog key={`${panel.ref}-${panel.via}`} />}
      {variant === 'D' && <DDock />}
      {toast && (
        <div className="fbp-toast" role="status">
          <Check size={14} /> {toast}
        </div>
      )}
      <Switcher />
    </div>
  );
}

export { VARIANT_KEYS };
