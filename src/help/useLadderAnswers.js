import { useEffect, useState } from 'react';
import { isRequestCancelled } from '../gameLogsApi';
import { fetchLadder } from '../ladderApi';

/*
 * Each ladder rung's real answer (crf04/statsplus#211): its average points,
 * how many games it kept, and every kept game's points in date order. One
 * anonymous read, so the signed-out page shows the same answers a signed-in
 * reader sees. Any failure leaves the ladder without answers rather than half
 * of them. `enabled` is whether the Query Prompt is on screen.
 */
export const useLadderAnswers = (enabled) => {
  const [answers, setAnswers] = useState(null);
  useEffect(() => {
    setAnswers(null);
    if (!enabled) {
      return undefined;
    }
    const controller = new AbortController();
    fetchLadder({ signal: controller.signal })
      .then(setAnswers)
      .catch((error) => {
        if (!isRequestCancelled(error)) setAnswers(null);
      });
    return () => controller.abort();
  }, [enabled]);
  return answers;
};
