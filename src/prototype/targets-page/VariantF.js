/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * F — Report. One report per Target, stacked full width, each written as a
 * verdict: a sentence that says how the read has done, a distribution of every
 * game's margin against the player's own average, and the five players who
 * made the most of it. The composer is the sentence from C, because a Target
 * written as a sentence is answered by a report written as one.
 */
import { SentenceComposer } from './VariantC';
import { QualifierChips } from './shared';
import { monthDay, monthName, percent, signedDelta, summarise, toneOf } from './history';

export const NAME = 'Report';

const TOP = 5;

/*
 * A histogram of margin against the player's own season average, one bin per
 * whole unit, zero in the middle. Bars over zero are hits, under it misses;
 * the zero bin is neither. Thin bars, 2px of surface between, anchored to the
 * baseline, hover for the count.
 */
function MarginHistogram({ record, column }) {
  const stat = record.columns.find((entry) => entry.column === column);
  const reach = Math.max(Math.ceil(Math.abs(stat.min)), Math.ceil(Math.abs(stat.max)), 1);
  const counts = {};
  record.games.forEach((game) => {
    const bin = Math.max(-reach, Math.min(reach, Math.round(game.delta[column])));
    counts[bin] = (counts[bin] || 0) + 1;
  });
  const most = Math.max(1, ...Object.values(counts));
  const bins = Array.from({ length: reach * 2 + 1 }, (_, index) => index - reach);
  return (
    <div
      className="pt-f-hist"
      role="img"
      aria-label={`${column}: ${percent(stat.rate)} of games over season average`}
    >
      <div className="pt-f-hist-plot" style={{ '--bins': bins.length }}>
        {bins.map((bin) => {
          const count = counts[bin] || 0;
          return (
            <i
              key={bin}
              className={`is-${toneOf(bin)}${bin === 0 ? ' is-zero' : ''}`}
              style={{ height: count ? `${Math.max(3, (count / most) * 100)}%` : 0 }}
              title={`${count} ${count === 1 ? 'game' : 'games'} at ${signedDelta(bin)} ${column}`}
            />
          );
        })}
      </div>
      <div className="pt-f-strip-axis">
        <span>{signedDelta(-reach)}</span>
        <span className="pt-f-strip-name">
          {column} <small>vs the player&apos;s own season · {record.games.length} games</small>
        </span>
        <span>{signedDelta(reach)}</span>
      </div>
    </div>
  );
}

function Verdict({ target, record }) {
  const lead = record.columns[0];
  const others = record.columns.slice(1);
  return (
    <p className="pt-f-verdict">
      Since {monthName(record.first)}, <b>{record.playerCount} players</b> meeting the Qualifiers
      have faced {target.opponent} <b>{record.games.length} times</b>. They beat their own season{' '}
      {lead.column} in{' '}
      <b className={lead.rate >= 0.5 ? 'is-hit' : 'is-miss'}>
        {lead.hits} of those ({percent(lead.rate)})
      </b>
      , by <b className={`is-${toneOf(lead.mean)}`}>{signedDelta(lead.mean)}</b> on average
      {others.length > 0 && (
        <>
          ;{' '}
          {others.map((column, index) => (
            <span key={column.column}>
              {index > 0 && ', '}
              {column.column} cashed{' '}
              <b className={column.rate >= 0.5 ? 'is-hit' : 'is-miss'}>{percent(column.rate)}</b>
            </span>
          ))}
        </>
      )}
      .
    </p>
  );
}

function Report({ item, read }) {
  const { target } = item;
  const record = read?.status === 'ready' ? summarise(read.backtest) : null;
  return (
    <article className="pt-f-report">
      <header className="pt-f-report-head">
        <span className="pt-f-opp">{target.opponent}</span>
        <div className="pt-f-def">
          <QualifierChips target={target} />
          {target.note && <p className="pt-f-note">{target.note}</p>}
        </div>
        {record && (
          <span className="pt-f-hero">
            <b className={record.columns[0].rate >= 0.5 ? 'is-hit' : 'is-miss'}>
              {percent(record.columns[0].rate)}
            </b>
            <small>over season {record.primary}</small>
          </span>
        )}
      </header>
      {record ? (
        <>
          <Verdict target={target} record={record} />
          <div className="pt-f-strips">
            {record.columns.map((column) => (
              <MarginHistogram key={column.column} record={record} column={column.column} />
            ))}
          </div>
          <div className="pt-f-top">
            <span className="target-section-heading">
              Made the most of it · by margin on {record.primary}
            </span>
            <ol>
              {record.leaderboard.slice(0, TOP).map((row) => (
                <li key={row.player.canonicalId}>
                  <span className="pt-f-top-who">
                    <b>{row.player.name}</b>
                    <small>
                      {row.player.tricode} · season{' '}
                      {row.player.seasonAverages[record.primary].toFixed(1)}
                    </small>
                  </span>
                  <span className="pt-f-top-lines">
                    {row.lines.map((line) => (
                      <span
                        key={line.date}
                        className={`is-${toneOf(line.delta)}`}
                        title={`${monthDay(line.date)} · ${signedDelta(line.delta)}`}
                      >
                        {line.value}
                      </span>
                    ))}
                  </span>
                  <span className={`pt-f-top-mean is-${toneOf(row.mean)}`}>
                    {signedDelta(row.mean)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <p className="target-empty">
          {target.local
            ? 'Unsaved, this session only. A saved Target has a season the moment it is saved.'
            : read?.status === 'error'
              ? 'The season did not read.'
              : 'Reading the season…'}
        </p>
      )}
    </article>
  );
}

export default function VariantF({ data }) {
  const { list, items, backtests, saveLocally } = data;
  return (
    <main className="slate-page targets-page pt-f">
      <header className="pt-f-head">
        <p className="eyebrow">Targets</p>
        <h1>
          {list.status === 'ready'
            ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
            : 'Targets'}
        </h1>
        <p className="pt-f-sub">
          What each read has produced this season. Today&apos;s games live on the Matchups page.
        </p>
      </header>

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}

      <div className="pt-f-reports">
        {items.map((item) => (
          <Report key={item.target.id} item={item} read={backtests[String(item.target.id)]} />
        ))}
      </div>

      <section className="pt-f-compose">
        <h2 className="pt-e-section-head">
          <span>New Target</span>
          <small>written as the sentence its report will answer</small>
        </h2>
        <SentenceComposer onSave={saveLocally} />
      </section>
    </main>
  );
}
