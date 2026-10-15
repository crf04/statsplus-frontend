import { useEffect, useState } from 'react';
import { fetchGameLogsData, isRequestCancelled } from '../gameLogsApi';
import { QUERY_LADDER } from './queryHelp';

/*
 * Each ladder rung's real answer (crf04/statsplus#204): its average points,
 * how many games it kept, and every kept game's points in date order. The
 * three reads are the same Game Logs request the Log Workspace makes for the
 * rung's Filter Set, so the answer is the one the rung opens. Any failure
 * leaves the ladder without answers rather than half of them.
 */
const answerFrom = ({ gameLogs, averages }) => {
  const series = gameLogs.map((log) => Number(log.PTS)).filter(Number.isFinite);
  const average = Number(averages[0]?.PTS);
  if (series.length === 0 || !Number.isFinite(average)) return null;
  return { points: average, games: series.length, series };
};

export const useLadderAnswers = (enabled) => {
  const [answers, setAnswers] = useState(null);
  useEffect(() => {
    if (!enabled) {
      setAnswers(null);
      return undefined;
    }
    const controller = new AbortController();
    Promise.all(
      QUERY_LADDER.map((step) => fetchGameLogsData(step.filters, { signal: controller.signal })),
    )
      .then((responses) => {
        const decoded = responses.map(answerFrom);
        setAnswers(decoded.every(Boolean) ? decoded : null);
      })
      .catch((error) => {
        if (!isRequestCancelled(error)) setAnswers(null);
      });
    return () => controller.abort();
  }, [enabled]);
  return answers;
};
