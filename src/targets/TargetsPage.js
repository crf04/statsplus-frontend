import { TargetConditionSummary } from './TargetConditions';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRequestErrorMessage } from '../gameLogsApi';
import { formatTip } from '../calendarDate';
import TargetForm, { blankTargetDraft } from './TargetForm';
import TargetLab from './TargetLab';
import TargetRecord from './TargetRecord';
import { formatQualifierParts, formatObservedShare } from './targetCatalog';
import { createTarget, fetchTargetBacktest } from './targetsApi';
import TargetsSignedOut from './TargetsSignedOut';
import { useResolvedTargets, useTargets } from './useTargets';
import '../SlatePage.css';
import './TargetsPage.css';

function TargetCard({ target, entry, read }) {
  const game = entry?.game;
  return (
    <li>
      <article className="target-card" aria-label={target.title}>
        <div className="target-card-head">
          {entry ? (
            game ? (
              <Link className="target-game-chip" to={`/matchups/${game.gameId}`}>
                {game.away.tricode} @ {game.home.tricode} · {formatTip(game.scheduledAt)}
              </Link>
            ) : (
              <span className="target-card-today">no game today</span>
            )
          ) : (
            <span>Today’s activity unavailable</span>
          )}
          <Link className="target-card-go" to={`/targets/${target.id}`}>
            Edit →
          </Link>
        </div>
        <span className="target-card-opponent">{target.opponent}</span>
        <div className="target-card-qualifiers">
          {target.qualifiers.map((qualifier, index) => {
            const { label, value } = formatQualifierParts(qualifier);
            return (
              <span key={index}>
                {label} <b>{value}</b>
              </span>
            );
          })}
        </div>
        <TargetConditionSummary target={target} compact />
        {target.note && <p className="target-card-note">{target.note}</p>}
        {game && (
          <section aria-label="Playing tonight">
            <h3 className="target-section-heading">Playing tonight</h3>
            {entry.availability.status !== 'available' ? (
              <p className="target-empty">pool unavailable</p>
            ) : entry.players.length === 0 ? (
              <p className="target-empty">nobody meets every Qualifier</p>
            ) : (
              <ul className="target-fit-pills">
                {entry.players.map((player) => (
                  <li key={player.canonicalId} className={player.thin ? 'is-thin' : undefined}>
                    <b>{player.name}</b> ·{' '}
                    {player.shares
                      .map(
                        (share, index) =>
                          `${formatQualifierParts(target.qualifiers[index]).label} ${formatObservedShare(share.share)}`,
                      )
                      .join(' · ')}{' '}
                    · {player.seasonScoring === null ? '—' : player.seasonScoring.toFixed(1)} ppg
                    {player.thin && <small> · thin evidence</small>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section aria-label="Backtest">
          <p className="target-backtest-proxy">Backtest · season to date</p>
          {read?.status === 'ready' ? (
            <>
              <TargetConditionSummary
                target={read.backtest.target}
                gamesConsidered={read.backtest.gamesConsidered}
              />
              <TargetRecord backtest={read.backtest} />
            </>
          ) : (
            <p className="target-empty">{read?.error || 'Reading the season…'}</p>
          )}
        </section>
      </article>
    </li>
  );
}

// The league-wide scans are queued; a refusal does not strand later cards.
function useListBacktests(targets, enabled) {
  const [reads, setReads] = useState({});
  useEffect(() => {
    if (!enabled) {
      setReads({});
      return undefined;
    }
    const controller = new AbortController();
    setReads({});
    (async () => {
      for (const target of targets) {
        if (controller.signal.aborted) return;
        try {
          const backtest = await fetchTargetBacktest({ id: target.id, signal: controller.signal });
          if (controller.signal.aborted) return;
          setReads((current) => ({ ...current, [target.id]: { status: 'ready', backtest } }));
        } catch (error) {
          if (controller.signal.aborted) return;
          setReads((current) => ({
            ...current,
            [target.id]: {
              status: 'error',
              error: getRequestErrorMessage(error, 'Unable to read this Backtest.'),
            },
          }));
        }
      }
    })();
    return () => controller.abort();
  }, [targets, enabled]);
  return reads;
}

export default function TargetsPage() {
  const navigate = useNavigate();
  const { authLoading, isAuthenticated, status, targets, error } = useTargets();
  /*
   * What each Target is worth today, read for the current Slate Date. It is a
   * second read over the same list, so a day that will not resolve costs the
   * cards their counts and nothing else.
   */
  const resolved = useResolvedTargets();
  const reads = useListBacktests(targets, status === 'ready' && isAuthenticated);
  const [draft, setDraft] = useState(blankTargetDraft);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!authLoading && !isAuthenticated) {
    return <TargetsSignedOut />;
  }

  /*
   * A saved draft becomes the record and opens on its own page, where the
   * evidence the Lab showed reads the same. A refused save keeps the draft
   * exactly as it was typed: a duplicate or a full account is one edit away
   * from a Target worth keeping, not a retype.
   */
  const save = async (request) => {
    setSaving(true);
    setSaveError(null);
    try {
      const target = await createTarget(request);
      setComposing(false);
      navigate(`/targets/${target.id}`);
    } catch (requestError) {
      setSaveError(
        getRequestErrorMessage(requestError, 'Unable to save this Target. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="slate-page targets-page">
      <section className="slate-heading">
        <div className="slate-title">
          <p className="eyebrow">Targets</p>
          <p className="targets-active">
            {resolved.status === 'ready'
              ? (() => {
                  const count = resolved.entries.filter((entry) => entry.game).length;
                  return count
                    ? `${count} ${count === 1 ? 'Target' : 'Targets'} active today`
                    : 'No Targets active today';
                })()
              : resolved.status === 'error'
                ? 'Today’s activity unavailable'
                : 'Reading today’s activity…'}
          </p>
        </div>
        <button type="button" onClick={() => setComposing(true)} disabled={composing}>
          + New Target
        </button>
      </section>

      {composing && (
        <section className="target-new" aria-labelledby="new-target-heading">
          <h2 id="new-target-heading" className="target-section-heading">
            New Target
          </h2>
          <TargetForm
            draft={draft}
            busy={saving}
            onChange={(patch) => setDraft({ ...draft, ...patch })}
            onSubmit={save}
          />
          {saveError && (
            <p className="target-error" role="alert">
              {saveError}
            </p>
          )}
          <TargetLab draft={draft} />
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setComposing(false);
              setDraft(blankTargetDraft());
              setSaveError(null);
            }}
          >
            Cancel
          </button>
        </section>
      )}

      {status === 'loading' && <p role="status">Loading your Targets…</p>}
      {status === 'error' && <p role="alert">{error}</p>}
      {status === 'ready' &&
        (targets.length === 0 ? (
          <div className="empty-slate">
            <h2>No Targets yet.</h2>
            <p>Choose + New Target to save a read on a defense.</p>
          </div>
        ) : (
          <ul className="target-grid">
            {targets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                read={reads[target.id]}
                entry={resolved.entries.find((entry) => entry.target.id === target.id) || null}
              />
            ))}
          </ul>
        ))}
    </main>
  );
}
