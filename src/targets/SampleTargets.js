import { useState } from 'react';
import TargetRecord from './TargetRecord';
import { deriveTargetTitle, formatQualifierParts } from './targetCatalog';
import { useTargetPreview } from './useTargets';

const samples = [
  {
    opponent: 'ORL',
    qualifiers: [
      { base: 'play_types', sliceKey: 'PRBallHandler', comparator: 'at_or_above', threshold: 0.25 },
    ],
    note: 'Explore players who use at least 25% of their possessions as pick-and-roll ball handlers.',
  },
  {
    opponent: 'NYK',
    qualifiers: [
      { base: 'play_types', sliceKey: 'PRRollMan', comparator: 'at_or_above', threshold: 0.15 },
    ],
    note: 'Explore players who use at least 15% of their possessions as pick-and-roll roll men.',
  },
];

function SampleCard({ target, onAdd }) {
  const { status, preview, error, retry } = useTargetPreview(target, { immediateInitial: true });
  const [preferences, setPreferences] = useState(null);
  const columns = preferences?.columns ?? preview?.statColumns ?? [];
  const gradedBy = preferences?.gradedBy ?? columns[0];
  return (
    <li>
      <article className="target-card" aria-label={deriveTargetTitle(target)}>
        <div className="target-card-head">
          <span className="target-label">Sample</span>
          <button
            className="target-primary"
            type="button"
            onClick={() => onAdd(target, preferences)}
          >
            Add to my targets
          </button>
        </div>
        <div className="target-card-criteria">
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
          <p className="target-card-note">{target.note}</p>
        </div>
        <section aria-label="Sample backtest">
          <p className="target-backtest-proxy">Backtest · season to date</p>
          {status === 'error' ? (
            <p className="target-error" role="alert">
              {error}{' '}
              <button className="target-ghost" type="button" onClick={retry}>
                Retry backtest
              </button>
            </p>
          ) : preview ? (
            <TargetRecord
              backtest={preview}
              columns={columns}
              gradedBy={gradedBy}
              onGrade={(column) => setPreferences({ columns, gradedBy: column })}
              onPreferencesChange={setPreferences}
            />
          ) : (
            <p className="target-empty">Reading the season…</p>
          )}
        </section>
      </article>
    </li>
  );
}

export default function SampleTargets({ onAdd }) {
  return (
    <section aria-labelledby="sample-targets-heading">
      <div className="sample-targets-intro">
        <h2 id="sample-targets-heading">Sample Targets</h2>
      </div>
      <ul className="target-grid">
        {samples.map((target) => (
          <SampleCard key={target.opponent} target={target} onAdd={onAdd} />
        ))}
      </ul>
    </section>
  );
}
