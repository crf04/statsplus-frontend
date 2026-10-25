import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { fetchSeasons } from './seasonsApi';
import { seasonAfterGameText, seasonChoiceLabel, seasonUnavailableText } from './servingSeason';
import './EvidenceSeason.css';

/*
 * The Evidence season (crf04/statsplus#330) of the Matchup, the Slate and the
 * Target Lab: `?season=` in the URL, offered only from /seasons `choices`, and
 * never named on a request when it is the default. Signed out, there is no
 * choice: the page reads the default whatever the link says.
 *
 * `ready` holds a page's read until a linked season is known to be offered, so
 * a link never shows the default's answer first. A linked season the choices
 * do not offer leaves the URL and is named in `fallbackFrom`.
 */
export const SEASON_PARAM = 'season';

export function useEvidenceSeason() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const signedIn = !authLoading && isAuthenticated;
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get(SEASON_PARAM);
  const [read, setRead] = useState({ status: 'loading', seasons: null });
  const [fallbackFrom, setFallbackFrom] = useState(null);

  useEffect(() => {
    if (!signedIn) return undefined;
    let current = true;
    fetchSeasons()
      .then((seasons) => current && setRead({ status: 'ready', seasons }))
      .catch(() => current && setRead({ status: 'failed', seasons: null }));
    return () => {
      current = false;
    };
  }, [signedIn]);

  const choices = read.seasons?.choices;
  const defaultSeason = read.seasons?.defaultSeason ?? null;
  const settled = read.status !== 'loading';
  const offered = Boolean(linked && choices?.some((choice) => choice.season === linked));

  useEffect(() => {
    if (!signedIn || !settled || !linked || offered) return;
    setFallbackFrom(linked);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(SEASON_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [signedIn, settled, linked, offered, setSearchParams]);

  const season = signedIn && offered && linked !== defaultSeason ? linked : null;
  const choose = useCallback(
    (next) => {
      setFallbackFrom(null);
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next && next !== defaultSeason) params.set(SEASON_PARAM, next);
          else params.delete(SEASON_PARAM);
          return params;
        },
        { replace: false },
      );
    },
    [defaultSeason, setSearchParams],
  );

  // Nothing new is shown until a season not yet published is offered, unless
  // a link already chose another one and needs a way back.
  const showControl =
    signedIn && Boolean(choices?.some((choice) => choice.mode === 'unpublished') || season);
  return {
    ready: !signedIn || !linked || (settled && offered),
    season,
    defaultSeason,
    choices: showControl ? choices : null,
    choice: season ? choices.find((choice) => choice.season === season) : null,
    fallbackFrom: signedIn ? fallbackFrom : null,
    choose,
  };
}

/** `path` carrying the Evidence season, unchanged for the default. */
export const withSeason = (path, season) =>
  season ? `${path}${path.includes('?') ? '&' : '?'}${SEASON_PARAM}=${season}` : path;

function EvidenceSeasonSelect({ evidence }) {
  if (!evidence.choices) return null;
  return (
    <label className="evidence-season-field">
      <span>Evidence season</span>
      <select
        value={evidence.season ?? evidence.defaultSeason ?? ''}
        onChange={(event) => evidence.choose(event.target.value)}
      >
        {evidence.choices.map((choice) => (
          <option key={choice.season} value={choice.season}>
            {seasonChoiceLabel(choice)}
          </option>
        ))}
      </select>
    </label>
  );
}

/*
 * What the page reads, when it is not simply the default: a season not yet
 * published, named with its sample, or a linked season that fell back.
 */
function EvidenceSeasonChip({ evidence }) {
  if (evidence.fallbackFrom && evidence.defaultSeason) {
    return (
      <span className="evidence-season-chip" role="status">
        {evidence.fallbackFrom} isn&rsquo;t offered, so this is {evidence.defaultSeason} evidence.
      </span>
    );
  }
  if (evidence.choice?.mode !== 'unpublished') return null;
  return (
    <span className="evidence-season-chip" data-testid="evidence-season-chip">
      Evidence season {seasonChoiceLabel(evidence.choice)}
    </span>
  );
}

/** The control and what it reads, on a page that offers a choice. */
export function EvidenceSeasonBar({ evidence }) {
  if (!evidence.choices && !evidence.fallbackFrom) return null;
  return (
    <div className="evidence-season-bar">
      <EvidenceSeasonSelect evidence={evidence} />
      <EvidenceSeasonChip evidence={evidence} />
    </div>
  );
}

/*
 * A season refused in place of an answer: one not offered yet (503
 * season_unavailable), or one after the game's own (400 season_after_game,
 * named by `gameSeason`). Either way there is no answer to show, not an empty
 * one, and a way back to the default.
 */
export function SeasonRefusal({ selectedSeason, gameSeason, defaultSeason, onShowDefault }) {
  return (
    <div role="alert" className="season-unavailable">
      <p>
        {gameSeason
          ? seasonAfterGameText(selectedSeason, gameSeason)
          : seasonUnavailableText(selectedSeason)}
        {defaultSeason && ` CourtAI still reads ${defaultSeason} by default.`}
      </p>
      {defaultSeason && (
        <button type="button" onClick={onShowDefault}>
          Show {defaultSeason}
        </button>
      )}
    </div>
  );
}
