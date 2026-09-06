/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * D — Record. A ledger where the season record is the row: how often
 * qualifying players have beaten their own season average against the
 * opponent, by how much, and a strip of every game in the order it was
 * played. A row opens into the leaderboard of who cashed and who did not.
 * Today is nowhere on this page; the Matchups page owns today.
 */
import { useState } from 'react';
import { ComposeRow } from './VariantA';
import { QualifierChips, isLive } from './shared';
import { monthDay, monthName, percent, signedDelta, summarise, toneOf } from './history';

export const NAME = 'Record';

function GameStrip({ games, column }) {
  return (
    <span className="pt-strip" aria-label={`${games.length} games, oldest to newest`}>
      {games.map((game, index) => (
        <i
          key={`${game.player.canonicalId}-${game.date}-${index}`}
          className={`is-${toneOf(game.delta[column])}`}
          title={`${monthDay(game.date)} · ${game.player.name} ${game.stats[column]} ${column} (${signedDelta(game.delta[column])} vs season)`}
        />
      ))}
    </span>
  );
}

function Leaderboard({ record }) {
  const { leaderboard, primary } = record;
  const shown = leaderboard.filter((row) => row.games > 0);
  return (
    <table className="pt-d-board" aria-label={`Who cashed, by margin on ${primary}`}>
      <thead>
        <tr>
          <th>Player</th>
          <th className="num">G</th>
          <th className="num">Hit</th>
          <th className="num">vs season {primary}</th>
          <th>Games, oldest first</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((row) => (
          <tr key={row.player.canonicalId}>
            <td>
              <b>{row.player.name}</b>
              <small>
                {row.player.tricode} · season {row.player.seasonAverages[primary].toFixed(1)}
              </small>
            </td>
            <td className="num">{row.games}</td>
            <td className="num">
              {row.hits}/{row.games}
            </td>
            <td className={`num is-${toneOf(row.mean)}`}>{signedDelta(row.mean)}</td>
            <td className="pt-d-lines">
              {row.lines.map((line) => (
                <span
                  key={line.date}
                  className={`is-${toneOf(line.delta)}`}
                  title={`${monthDay(line.date)} · ${line.value} ${primary}`}
                >
                  {line.value}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RecordRow({ item, read, open, onToggle }) {
  const { target } = item;
  const record = read?.status === 'ready' ? summarise(read.backtest) : null;
  const lead = record?.columns[0];
  return (
    <li className={`pt-d-item${open ? ' is-open' : ''}`}>
      <button type="button" className="pt-d-row" aria-expanded={open} onClick={onToggle}>
        <span className="pt-d-opp">{target.opponent}</span>
        <span className="pt-d-def">
          <QualifierChips target={target} />
          <span className="pt-d-note">{target.note || <em>no note</em>}</span>
        </span>
        {record && lead ? (
          <>
            <span className="pt-d-rate">
              <b className={lead.rate !== null && lead.rate >= 0.5 ? 'is-hit' : 'is-miss'}>
                {percent(lead.rate)}
              </b>
              <small>
                {lead.hits} of {record.games.length} over season {lead.column}
              </small>
            </span>
            <span className="pt-d-strip">
              <GameStrip games={record.games} column={lead.column} />
              <small>
                {record.playerCount} players · {monthName(record.first)}–{monthName(record.last)}
              </small>
            </span>
            <span className="pt-d-margin">
              {record.columns.map((column) => (
                <span key={column.column} className={`is-${toneOf(column.mean)}`}>
                  {signedDelta(column.mean)} <small>{column.column}</small>
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="pt-d-pending">
            {target.local
              ? 'unsaved · no season to read'
              : read?.status === 'error'
                ? 'the season did not read'
                : 'reading the season…'}
          </span>
        )}
        <span className="pt-d-caret" aria-hidden="true">
          {open ? '–' : '+'}
        </span>
      </button>
      {open && record && (
        <div className="pt-d-body">
          <span className="target-section-heading">
            Who cashed · every qualifying player who has faced {target.opponent} this season
            {isLive(item) ? ' · today is on the Matchups page' : ''}
          </span>
          <Leaderboard record={record} />
        </div>
      )}
    </li>
  );
}

export default function VariantD({ data }) {
  const { list, items, backtests, saveLocally } = data;
  const [openId, setOpenId] = useState(null);
  const [composing, setComposing] = useState(false);
  const records = items
    .map((item) => backtests[String(item.target.id)])
    .filter((read) => read?.status === 'ready')
    .map((read) => summarise(read.backtest));
  const totalGames = records.reduce((sum, record) => sum + record.games.length, 0);
  const totalHits = records.reduce((sum, record) => sum + record.columns[0].hits, 0);

  return (
    <main className="slate-page targets-page pt-d">
      <header className="pt-d-head">
        <div>
          <p className="eyebrow">Targets</p>
          <h1>
            {list.status === 'ready'
              ? `${items.length} ${items.length === 1 ? 'Target' : 'Targets'}`
              : 'Targets'}
          </h1>
        </div>
        <p className="pt-d-season">
          {records.length ? (
            <>
              <b>{percent(totalGames ? totalHits / totalGames : null)}</b>
              <span>of {totalGames} games this season beat the player&apos;s own average</span>
            </>
          ) : (
            'reading the season…'
          )}
        </p>
      </header>

      {list.status === 'loading' && <p role="status">Loading your Targets…</p>}
      {list.status === 'error' && <p role="alert">{list.error}</p>}

      <ul className="pt-d-ledger">
        <li className="pt-d-item is-head" aria-hidden="true">
          <span className="pt-d-row">
            <span>Opp</span>
            <span>The read</span>
            <span>Hit rate</span>
            <span>Every game, Oct → now</span>
            <span>Margin</span>
            <span />
          </span>
        </li>
        {items.map((item) => (
          <RecordRow
            key={item.target.id}
            item={item}
            read={backtests[String(item.target.id)]}
            open={openId === item.target.id}
            onToggle={() => setOpenId(openId === item.target.id ? null : item.target.id)}
          />
        ))}
        {composing ? (
          <ComposeRow
            onSave={(request) => {
              saveLocally(request);
              setComposing(false);
            }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <li className="pt-d-item is-new">
            <button type="button" className="pt-d-row" onClick={() => setComposing(true)}>
              <span className="pt-d-opp">+</span>
              <span className="pt-d-new-label">New Target</span>
              <span className="pt-d-pending">its season starts reading the moment it is saved</span>
              <span />
              <span />
              <span />
            </button>
          </li>
        )}
      </ul>
    </main>
  );
}
