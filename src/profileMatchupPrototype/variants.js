/*
 * PROTOTYPE (throwaway). One Base of the Matchup engine, four layouts.
 */
import { useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import '../chartSetup';
import { useThemeColors } from '../theme/useThemeColors';
import {
  MARKETS,
  TAB_BASES,
  pct,
  readBase,
  score,
  seasonLabel,
  share,
  tone,
  useMatchup,
} from './read';
import './proto.css';

const rankTitle = (s, opp) =>
  s.mix
    ? `${s.label}: ${pct(s.vs)} vs league for his mix of 2s and 3s (no opponent rank)`
    : s.rank == null
      ? `${s.label}: ${opp} has no row for this market`
      : `${s.label}: ${opp} ranks ${s.rank} of 30 (30 = allows the most), ${pct(s.vs)} vs league · row ${s.row}`;

/* Rank 30 (allows the most) is soft = green; rank 1 tough = red. */
const rankFill = (rank) => {
  if (rank == null) return undefined;
  const d = (rank - 15.5) / 14.5;
  const hue = d >= 0 ? 'hit' : 'miss';
  return `rgb(var(--ct-${hue}-fill-rgb) / ${(0.12 + Math.abs(d) * 0.55).toFixed(2)})`;
};

const RankPill = ({ s }) =>
  s.mix ? (
    <span className="pmp-pill pmp-pill-mix" title="Scored on his mix of 2s and 3s">
      mix
    </span>
  ) : s.rank == null ? (
    <span className="pmp-pill pmp-pill-none">–</span>
  ) : (
    <span className="pmp-pill" style={{ background: rankFill(s.rank) }}>
      {s.rank}
    </span>
  );

const Vs = ({ v }) => <span className={`pmp-vs pmp-${tone(v)}`}>{pct(v)}</span>;

const Header = ({ reading, label, market, setMarket, opponent, scored }) => {
  const { component, blend } = reading;
  return (
    <div className="pmp-head">
      <div className="pmp-markets" role="group" aria-label="Market">
        {MARKETS.map((m) => (
          <button
            key={m}
            type="button"
            className={`${m === market ? 'pmp-on' : ''}${scored.has(m) ? '' : ' pmp-off'}`}
            title={scored.has(m) ? undefined : `${label} has no ${m} component`}
            onClick={() => setMarket(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="pmp-score">
        {component ? (
          <>
            <span className="pmp-score-label">
              {label} component · {market}
            </span>
            <span className={`pmp-score-value pmp-${tone(component.value * 100)}`}>
              {score(component.value)}
            </span>
            <span className="pmp-score-sub">
              vs league{component.thin ? ' · thin sample' : ''} · {market} Season Matchup Score{' '}
              {score(blend)} vs {opponent}
            </span>
          </>
        ) : (
          <>
            <span className="pmp-score-label">
              {label} component · {market}
            </span>
            <span className="pmp-score-value pmp-even">none</span>
            <span className="pmp-score-sub">
              {label} does not score {market} · Season Matchup Score {score(blend)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

const TableVariant = ({ slices, opponent }) => (
  <table className="pmp-table">
    <thead>
      <tr>
        <th scope="col">Slice</th>
        <th scope="col">Share</th>
        <th scope="col">League</th>
        <th scope="col" title="1-30, 30 = allows the most">
          {opponent} rank
        </th>
        <th scope="col">vs lg</th>
      </tr>
    </thead>
    <tbody>
      {slices.map((s) => (
        <tr key={s.key} className={s.driver ? 'pmp-driver' : ''} title={rankTitle(s, opponent)}>
          <th scope="row">
            {s.label}
            {s.driver && <span className="pmp-tag">driver</span>}
          </th>
          <td className="pmp-num">{share(s.share)}</td>
          <td className="pmp-num pmp-dim">{share(s.league)}</td>
          <td className="pmp-num">
            <RankPill s={s} />
          </td>
          <td className="pmp-num">
            <Vs v={s.vs} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const BarsVariant = ({ slices, opponent }) => {
  const max = Math.max(...slices.map((s) => Math.max(s.share, s.league ?? 0)), 0.01);
  return (
    <ul className="pmp-bars">
      {slices.map((s) => (
        <li key={s.key} className={s.driver ? 'pmp-driver' : ''} title={rankTitle(s, opponent)}>
          <div className="pmp-bars-top">
            <span className="pmp-bars-name">
              {s.label}
              {s.driver && <span className="pmp-tag">driver</span>}
            </span>
            <span className="pmp-bars-share">
              {share(s.share)} <span className="pmp-dim">lg {share(s.league)}</span>
            </span>
          </div>
          <div className="pmp-bars-row">
            <div className="pmp-track">
              <div className="pmp-fill" style={{ width: `${(s.share / max) * 100}%` }} />
              {s.league != null && (
                <div className="pmp-tick" style={{ left: `${(s.league / max) * 100}%` }} />
              )}
            </div>
            <RankPill s={s} />
            <Vs v={s.vs} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const CHART_COLORS = {
  bar: ['fill', '--ct-gold-fill'],
  driver: ['fill', '--ct-gold-fill-hover'],
  league: ['fg', '--ct-text'],
  line: ['line', '--ct-slate'],
  tick: ['fg', '--ct-dim'],
  grid: ['line', '--ct-line'],
  hit: ['fill', '--ct-hit-fill'],
  miss: ['fill', '--ct-miss-fill'],
};

const ComboVariant = ({ slices, opponent }) => {
  const colors = useThemeColors(CHART_COLORS);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
  const data = useMemo(
    () => ({
      labels: slices.map((s) => s.label),
      datasets: [
        {
          type: 'line',
          label: '% vs league',
          data: slices.map((s) => s.vs),
          yAxisID: 'vs',
          borderColor: colors.line,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: slices.map((s) =>
            s.vs == null ? colors.line : s.vs >= 0 ? colors.hit : colors.miss,
          ),
          pointBorderColor: colors.line,
          spanGaps: true,
          order: 0,
        },
        {
          type: 'line',
          label: 'League share',
          data: slices.map((s) => (s.league == null ? null : s.league * 100)),
          yAxisID: 'share',
          showLine: false,
          pointStyle: 'line',
          pointRadius: narrow ? 9 : 14,
          pointBorderWidth: 3,
          pointBorderColor: colors.league,
          order: 1,
        },
        {
          type: 'bar',
          label: 'His share',
          data: slices.map((s) => s.share * 100),
          yAxisID: 'share',
          backgroundColor: slices.map((s) => (s.driver ? colors.driver : colors.bar)),
          borderRadius: 3,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
          order: 2,
        },
      ],
    }),
    [slices, colors, narrow],
  );
  const range = Math.ceil((Math.max(10, ...slices.map((s) => Math.abs(s.vs ?? 0))) * 1.1) / 5) * 5;
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: colors.tick, usePointStyle: true, boxWidth: 14, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            title: (items) => slices[items[0].dataIndex].label,
            label: () => null,
            afterBody: (items) => {
              const s = slices[items[0].dataIndex];
              return [
                `Share ${share(s.share)} (league ${share(s.league)})`,
                s.mix
                  ? `${pct(s.vs)} vs league for his mix of 2s and 3s`
                  : s.rank == null
                    ? `${opponent}: no row for this market`
                    : `${opponent} ranks ${s.rank} of 30 · ${pct(s.vs)} vs league`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: colors.tick,
            autoSkip: false,
            maxRotation: 50,
            minRotation: narrow ? 50 : 30,
            font: { size: narrow ? 10 : 11 },
          },
          grid: { display: false },
        },
        share: {
          position: 'left',
          beginAtZero: true,
          ticks: { color: colors.tick, callback: (v) => `${v}%`, font: { size: 10 } },
          grid: { color: colors.grid },
          title: { display: !narrow, text: 'Share of his Diet', color: colors.tick },
        },
        vs: {
          position: 'right',
          min: -range,
          max: range,
          ticks: { color: colors.tick, callback: (v) => pct(v), font: { size: 10 } },
          grid: { display: false },
          title: { display: !narrow, text: `${opponent} vs league`, color: colors.tick },
        },
      },
    }),
    [colors, slices, opponent, narrow, range],
  );
  return (
    <div className="pmp-combo">
      <Chart type="bar" data={data} options={options} />
    </div>
  );
};

/* D: the MCP sentence, laid out as two aligned lines, with a diverging
   vs-league bar so the soft/tough read is the visual. */
const DivergingVariant = ({ slices, opponent }) => {
  const max = Math.max(10, ...slices.map((s) => Math.abs(s.vs ?? 0)));
  return (
    <ul className="pmp-div">
      {slices.map((s) => (
        <li key={s.key} className={s.driver ? 'pmp-driver' : ''} title={rankTitle(s, opponent)}>
          <div className="pmp-div-text">
            <b>{s.label}</b> {share(s.share)}{' '}
            <span className="pmp-dim">(league {share(s.league)})</span>
            {s.driver && <span className="pmp-tag">driver</span>}
            <div className="pmp-div-sub">
              {s.mix
                ? `${pct(s.vs)} vs league for his mix of 2s and 3s`
                : s.rank == null
                  ? `${opponent} has no row for this market`
                  : `${opponent} ranks ${s.rank} · ${pct(s.vs)} vs league`}
            </div>
          </div>
          <div className="pmp-div-axis" aria-hidden="true">
            <span className="pmp-div-zero" />
            {s.vs != null && (
              <span
                className={`pmp-div-bar pmp-bg-${tone(s.vs)}`}
                style={
                  s.vs >= 0
                    ? { left: '50%', width: `${(s.vs / max) * 50}%` }
                    : { right: '50%', width: `${(-s.vs / max) * 50}%` }
                }
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

const BODIES = { A: TableVariant, B: BarsVariant, C: ComboVariant, D: DivergingVariant };

const MatchupTabProto = ({ tab, variant, playerName, opponent }) => {
  // Assist locations scores no points market, so its tab opens on AST.
  const [market, setMarket] = useState(tab === 'assists' ? 'AST' : 'PTS');
  const state = useMatchup(playerName, opponent);
  const { base, label } = TAB_BASES[tab];
  if (state.loading) return <p>Loading data...</p>;
  if (state.error) return <p className="text-danger">{state.error}</p>;
  const reading = readBase(state.data, opponent, base, market);
  const scores = state.data.players[0].scores || {};
  const scored = new Set(
    MARKETS.filter((m) => scores[m]?.season?.components?.[base]?.value != null),
  );
  const Body = BODIES[variant];
  return (
    <div className={`pmp-root pmp-v${variant}`}>
      <p className="ps-evidence-season">{seasonLabel(state.data)}</p>
      <h6 className="subcategory-heading no-border pmp-title">
        {playerName} vs {opponent} · {label}
      </h6>
      <Header
        reading={reading}
        label={label}
        market={market}
        setMarket={setMarket}
        opponent={opponent}
        scored={scored}
      />
      {reading.slices.length === 0 ? (
        <p>
          No {label} Diet for {playerName}.
        </p>
      ) : (
        <Body slices={reading.slices} opponent={opponent} />
      )}
      <p className="pmp-foot">
        Share = his {label} Diet (league share in grey). {opponent} rank 1-30, 30 = allows the most
        of the slice's {market} row. Positive = favourable.
      </p>
    </div>
  );
};

export default MatchupTabProto;
