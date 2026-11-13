import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import './chartSetup';
import MetricsDashboardRow from './MetricsDashboardRow';
import AppliedFilters from './AppliedFilters';
import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';
import { postedLineFor } from './gameLogsApi';
import { bookName } from './matchups/displayConfig';
import { shortSlateDay } from './home/homeFormat';
import { useThemeColors } from './theme/useThemeColors';
import { ordinal } from './profileMatchup/matchupReading';
// PROTOTYPE (throwaway, branch prototype/hover-card): hover card variants.
import { useHoverProto } from './hoverProto/mode';
import { gameFacts, signed } from './hoverProto/gameFacts';
import { Floating, GameStrip, MiniCard, VersusCard } from './hoverProto/Cards';
import Switcher from './hoverProto/Switcher';
import { StripDetail, StripHeader, StripScoreboard } from './hoverProto/Strips';

const STRIPS = ['D', 'E', 'F', 'G'];

// Canvas paint, resolved from the theme tokens, each with the role it plays.
const CHART_COLORS = {
  over: ['fill', '--ct-hit-fill-78'],
  under: ['fill', '--ct-miss-fill-72'],
  bar: ['fill', '--ct-gold-fill-72'],
  ghost: ['fill', '--ct-gold-bg-16'],
  empty: ['fill', '--ct-scrim-10'],
  line: ['line', '--ct-gold'],
  labelGround: ['fill', '--ct-surface-2'],
  label: ['fg', '--ct-gold'],
  labelEdge: ['line', '--ct-gold-fg-40'],
  tooltipGround: ['fill', '--ct-surface-2'],
  tooltipTitle: ['fg', '--ct-text'],
  tooltipBody: ['fg', '--ct-dim'],
  tooltipEdge: ['line', '--ct-line-strong'],
  hitText: ['fg', '--ct-hit'], // PROTOTYPE
  missText: ['fg', '--ct-miss'], // PROTOTYPE
  tick: ['fg', '--ct-dim'],
  legend: ['fg', '--ct-dim'],
  grid: ['line', '--ct-overlay-fg-6'],
};

// A game date as M/D ("3/10"), from an ISO date or an epoch-millisecond label.
const shortGameDate = (label) => {
  const iso = /^\d{4}-(\d{2})-(\d{2})/.exec(String(label));
  if (iso) return `${Number(iso[1])}/${Number(iso[2])}`;
  return typeof label === 'number' || /^\d{12,}$/.test(String(label))
    ? new Date(Number(label)).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    : label;
};

const getPer36Value = (average, stat) => {
  const value = toFiniteNumber(average?.[stat]);
  const minutes = toFiniteNumber(average?.MIN);
  return value !== null && minutes !== null && minutes !== 0 ? (value / minutes) * 36 : 0;
};

// Whose line it is, then which game, on two lines so a phone-width chart fits
// it: "PrizePicks 26.5" / "GSW vs LAL · Wed, Oct 21".
const postedLineLabel = ({ key, line, matchup, gameDate }) =>
  [
    `${bookName(key)} ${formatNumber(line, 1)}`,
    [matchup, gameDate && shortSlateDay(gameDate)].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');

// A quarter of the bar's width, at most 10px, so narrow phone bars do not
// turn into pills. Chart.js draws bars at 0.9 × 0.8 of each category slot.
const barCornerRadius = ({ chart, dataset }) => {
  const area = chart.chartArea;
  if (!area || !dataset?.data?.length) return 10;
  const barWidth = (area.width / dataset.data.length) * 0.72;
  return Math.min(10, Math.round(barWidth / 4));
};

// Rebound and assist charts show the player-tracking opportunity behind each
// bar: the chances a rebound could have come from, the passes that led to a shot.
const TRACKING = {
  REB: {
    chances: 'REB_CHANCES',
    conversion: 'REB_CONV_PCT',
    noun: 'chances',
    rowLabel: 'Chances',
    ghostLabel: 'Rebound chances',
  },
  AST: {
    chances: 'POTENTIAL_AST',
    conversion: 'AST_CONV_PCT',
    noun: 'potential',
    rowLabel: 'Potential',
    ghostLabel: 'Potential assists',
  },
};

const percentText = (ratio) => `${Math.round(ratio * 100)}%`;

// The average chances, one decimal; null when the backend sends none.
const trackingAverageText = (average, tracking) => {
  const chances = toFiniteNumber(average?.[tracking.chances]);
  return chances === null ? null : formatNumber(chances, 1);
};

const TrackingAverages = ({ tracking, averages }) => {
  const filtered = trackingAverageText(averages?.[0], tracking);
  if (filtered === null) return null;
  const season = trackingAverageText(averages?.[1], tracking);
  return (
    <div className="tracking-averages mt-2 flex items-baseline gap-2 font-mono text-sm">
      <span className="text-[color:var(--ct-dim)] uppercase text-xs tracking-wider">
        {tracking.rowLabel}
      </span>{' '}
      <span className="text-[color:var(--ct-gold)] font-bold">{filtered}</span>
      {season !== null && <span className="text-[color:var(--ct-dim)]"> · season {season}</span>}
    </div>
  );
};

const ChartComponent = ({
  gameLogs,
  lineType,
  lineValue,
  averages,
  postedLine,
  opponentRanks,
  lineSource,
  appliedFilters,
}) => {
  const explicitLineValue = toFiniteNumber(lineValue);
  const numericLineValue =
    explicitLineValue !== null ? explicitLineValue : toFiniteNumber(averages?.[1]?.[lineType], 0);
  const tracking = TRACKING[lineType] ?? null;
  const posted = lineSource ? postedLineFor(postedLine, lineType, lineSource) : null;
  const colors = useThemeColors(CHART_COLORS);
  const lineLabel = posted
    ? postedLineLabel(posted)
    : explicitLineValue !== null
      ? `Line: ${lineValue}`
      : `Season avg: ${numericLineValue.toFixed(1)}`;

  // PROTOTYPE (throwaway): hover card variants, `#proto=hover&v=O|A|B|C|D`.
  const proto = useHoverProto(useLocation().search);
  const variant = proto.variant || 'O';
  const [tip, setTip] = useState(null);
  const [picked, setPicked] = useState(null);
  const logCount = Array.isArray(gameLogs) ? gameLogs.length : 0;
  const selected = picked !== null && picked < logCount ? picked : logCount - 1;
  const step = (d) => setPicked(Math.max(0, Math.min(logCount - 1, selected + d)));
  const lineSourceText = posted
    ? bookName(posted.key)
    : explicitLineValue !== null
      ? 'Line'
      : 'Season avg';
  const factsAt = (index) =>
    gameFacts({
      log: gameLogs?.[index],
      lineType,
      // Strips judge each game against the sportsbook close only.
      line: STRIPS.includes(variant) ? null : numericLineValue,
      lineSource: lineSourceText,
      opponentRanks,
      average: averages?.[0],
    });

  // react-chartjs-2 redraws whenever `data` or `options` is a new object, so
  // both are rebuilt only when an input they read changes.
  const chartData = useMemo(() => {
    if (!Array.isArray(gameLogs) || gameLogs.length === 0 || lineType === 'None') {
      return {
        labels: [],
        datasets: [
          {
            label: 'No data',
            data: [],
            backgroundColor: colors.empty,
          },
        ],
      };
    }

    const labels = gameLogs.map((log) => log?.GAME_DATE || '');
    const data = gameLogs.map((log) => numericOrZero(log?.[lineType]));

    const backgroundColors =
      !isNaN(numericLineValue) && numericLineValue > 0
        ? data.map((value) => (value > numericLineValue ? colors.over : colors.under))
        : colors.bar;

    const bars = {
      label: lineType,
      data,
      backgroundColor: backgroundColors,
      borderWidth: 0,
      borderRadius: barCornerRadius,
      borderSkipped: 'bottom',
      ...(STRIPS.includes(variant) && {
        borderColor: colors.label,
        borderWidth: data.map((_, i) => (i === selected ? 2 : 0)),
      }),
    };
    if (!tracking) return { labels, datasets: [bars] };

    // Drawn first and behind (a higher order is drawn earlier). An untracked
    // game is null, which Chart.js leaves empty; it is not a zero-height bar.
    return {
      labels,
      datasets: [
        { ...bars, grouped: false, order: 0 },
        {
          label: tracking.ghostLabel,
          data: gameLogs.map((log) => toFiniteNumber(log?.[tracking.chances])),
          backgroundColor: colors.ghost,
          borderWidth: 0,
          borderRadius: barCornerRadius,
          borderSkipped: 'bottom',
          grouped: false,
          order: 1,
        },
      ],
    };
  }, [gameLogs, lineType, numericLineValue, tracking, colors, variant, selected]);

  // PROTOTYPE A: the same canvas tooltip, in sections — result, lines, opponent, drivers.
  const sectionedCallbacks = {
    title: (items) => {
      const f = factsAt(items[0].dataIndex);
      return `${f.date} · ${f.where} ${f.opponent}`;
    },
    label: (item) => {
      const f = factsAt(item.dataIndex);
      const lines = [
        `${f.stat} ${formatNumber(f.value, 0)}${
          f.line
            ? `   ${signed(f.line.margin)} vs ${f.line.source} ${formatNumber(f.line.value, 1)}`
            : ''
        }`,
      ];
      if (f.closing)
        lines.push(
          `Closed ${formatNumber(f.closing.value, 1)} ${f.closing.book} · ${
            f.closing.over ? 'beat' : 'missed'
          } by ${formatNumber(Math.abs(f.closing.margin), 1)}`,
        );
      return lines;
    },
    labelTextColor: (item) => {
      const f = factsAt(item.dataIndex);
      const over = f.closing ? f.closing.over : f.line?.over;
      return over === undefined ? colors.tooltipTitle : over ? colors.hitText : colors.missText;
    },
    afterBody: (items) => {
      const f = factsAt(items[0].dataIndex);
      const out = [''];
      if (f.rank) out.push(`${f.opponent} ${f.rank.text} of 30 · ${f.rank.label}`, '');
      const splits = f.drivers.filter((d) => d.sub);
      f.drivers
        .filter((d) => !d.sub)
        .forEach((d) =>
          out.push(
            `${d.label.padEnd(9)}${d.text.padStart(4)}${d.avgText ? `   avg ${d.avgText}` : ''}`,
          ),
        );
      if (splits.length) out.push(splits.map((d) => `${d.label} ${d.text}`).join(' · '));
      return out;
    },
  };

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      // The container sets the height, so phones get as tall a chart as desktops.
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onHover: STRIPS.includes(variant)
        ? (_event, elements) => {
            if (elements.length) setPicked(elements[0].index);
          }
        : undefined,
      plugins: {
        legend: {
          display: Boolean(tracking),
          // Both bars are named; hiding one would only misread the other.
          onClick: null,
          labels: {
            color: colors.legend,
            boxWidth: 12,
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          },
        },
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: numericLineValue || 0,
              yMax: numericLineValue || 0,
              borderColor: colors.line,
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: {
                content: lineLabel.split('\n'),
                // chartjs-plugin-annotation 3 draws a label only with `display`.
                display: true,
                position: 'start',
                backgroundColor: colors.labelGround,
                color: colors.label,
                borderColor: colors.labelEdge,
                borderWidth: 1,
                font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
              },
            },
          },
        },
        tooltip: {
          ...(['B', 'C', ...STRIPS].includes(variant) && {
            enabled: false,
            external: STRIPS.includes(variant)
              ? undefined
              : ({ chart, tooltip }) => {
                  const point = tooltip.dataPoints?.[0];
                  const next =
                    tooltip.opacity === 0 || !point
                      ? null
                      : {
                          index: point.dataIndex,
                          x: tooltip.caretX,
                          y: tooltip.caretY,
                          width: chart.width,
                          height: chart.height,
                        };
                  setTip((prev) =>
                    prev === next ||
                    (prev &&
                      next &&
                      prev.index === next.index &&
                      prev.x === next.x &&
                      prev.y === next.y)
                      ? prev
                      : next,
                  );
                },
          }),
          displayColors: false, // This removes the colored box
          backgroundColor: colors.tooltipGround,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipEdge,
          borderWidth: 1,
          cornerRadius: 6,
          titleFont: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          bodyFont: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          // One entry per game: the ghost bar shares the main bar's tooltip.
          filter: (item) => item.datasetIndex === 0,
          callbacks:
            variant === 'A'
              ? sectionedCallbacks
              : {
                  title: (tooltipItems) => {
                    const index = tooltipItems[0].dataIndex;
                    return `${gameLogs[index]?.GAME_DATE || 'N/A'}`;
                  },
                  label: (tooltipItem) => {
                    const index = tooltipItem.dataIndex;
                    const value = tooltipItem.raw;
                    const matchup = gameLogs[index]?.MATCHUP;
                    const opponent =
                      typeof matchup === 'string' ? matchup.split(' ')[2] || 'N/A' : 'N/A';
                    const ranking = opponentRanks?.[lineType];
                    const rank = ranking?.ranks[opponent];
                    const lines = [
                      `OPP: ${opponent}`,
                      `MIN: ${numericOrZero(gameLogs[index]?.MIN)}`,
                      `${lineType}: ${numericOrZero(value)}`,
                    ];
                    // Points show the shot attempts behind them.
                    if (lineType === 'PTS') {
                      lines.push(
                        `FGA: ${numericOrZero(gameLogs[index]?.FGA)}`,
                        `3PA: ${numericOrZero(gameLogs[index]?.FG3A)}`,
                      );
                    }
                    if (tracking) {
                      const chances = toFiniteNumber(gameLogs[index]?.[tracking.chances]);
                      const made = numericOrZero(value);
                      lines[2] =
                        chances === null
                          ? `${lineType} ${made} · not tracked`
                          : `${lineType} ${made} · ${chances} ${tracking.noun}${
                              chances > 0 ? ` · ${percentText(made / chances)}` : ''
                            }`;
                    }
                    // The charted stat's code stands in for the label's stat words.
                    const verb = ranking?.label.match(/ (Allowed|Forced)$/)?.[1];
                    if (rank)
                      lines.splice(1, 0, `${ordinal(rank)} ${lineType}${verb ? ` ${verb}` : ''}`);
                    return lines;
                  },
                },
        },
        datalabels: {
          display: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: colors.tick,
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            callback(value) {
              return shortGameDate(this.getLabelForValue(value));
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          ticks: {
            color: colors.tick,
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 },
          },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- PROTOTYPE
    [gameLogs, lineType, lineLabel, numericLineValue, tracking, colors, opponentRanks, variant],
  );

  const { player_name: _player, ...withoutPlayer } = appliedFilters || {};

  const overLineCount = (logs) =>
    logs.filter((log) => numericOrZero(log[lineType]) > numericLineValue).length;

  return (
    <>
      {Array.isArray(gameLogs) && gameLogs.length > 0 && lineType !== 'None' && (
        <>
          <MetricsDashboardRow
            lineType={lineType}
            rawValue={numericOrZero(averages?.[0]?.[lineType])}
            per36Value={getPer36Value(averages?.[0], lineType)}
            seasonRawValue={numericOrZero(averages?.[1]?.[lineType])}
            seasonPer36Value={getPer36Value(averages?.[1], lineType)}
            ratio={`${overLineCount(gameLogs)}/${gameLogs.length}`}
            last5ratio={`${overLineCount(gameLogs.slice(-5))}/${Math.min(5, gameLogs.length)}`}
            last10ratio={`${overLineCount(gameLogs.slice(-10))}/${Math.min(10, gameLogs.length)}`}
          />
          {tracking && <TrackingAverages tracking={tracking} averages={averages} />}
          {/* The Player box above already names the player. */}
          <div className="chart-filters">
            <AppliedFilters filters={withoutPlayer} />
          </div>
          {selected >= 0 && variant === 'F' && (
            <StripHeader
              f={factsAt(selected)}
              log={gameLogs[selected]}
              lineType={lineType}
              index={selected}
              total={logCount}
              onStep={step}
            />
          )}
          <div className="chart-container" onMouseLeave={() => setTip(null)}>
            <Bar data={chartData} options={chartOptions} />
            {tip && (variant === 'B' || variant === 'C') && (
              <Floating tip={tip} width={tip.width}>
                {variant === 'B' ? (
                  <MiniCard f={factsAt(tip.index)} />
                ) : (
                  <VersusCard f={factsAt(tip.index)} />
                )}
              </Floating>
            )}
          </div>
          {selected >= 0 && variant === 'D' && (
            <GameStrip
              f={factsAt(selected)}
              log={gameLogs[selected]}
              lineType={lineType}
              index={selected}
              total={logCount}
              onStep={step}
            />
          )}
          {selected >= 0 && variant === 'E' && (
            <StripDetail
              f={factsAt(selected)}
              log={gameLogs[selected]}
              lineType={lineType}
              index={selected}
              total={logCount}
              onStep={step}
            />
          )}
          {selected >= 0 && variant === 'G' && (
            <StripScoreboard
              f={factsAt(selected)}
              log={gameLogs[selected]}
              lineType={lineType}
              index={selected}
              total={logCount}
              onStep={step}
            />
          )}
          {proto.active && <Switcher variant={variant} goTo={proto.goTo} step={proto.step} />}
        </>
      )}
    </>
  );
};

export default ChartComponent;
