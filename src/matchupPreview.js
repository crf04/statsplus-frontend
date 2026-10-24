import { parseCalendarDate } from './calendarDate';
import { SITE_NAME } from './linkPreview';

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

// The calendar date itself is formatted at noon UTC, so no zone can move it.
const describeDay = (date) => dayFormatter.format(new Date(`${date}T12:00:00Z`));

/**
 * Describe a shared Slate or Matchup link (crf04/statsplus#320). `today` is the
 * ET Slate Date: it versions the image URL so a chat app that kept the first
 * picture it fetched shows the new day's. Returns null for a path that is not
 * one of those pages, and for one we refuse, which keeps the static head.
 */
export const matchupPreviewFor = (pathname, searchParams, { today }) => {
  if (pathname === '/matchups') {
    const date = searchParams.has('date') ? parseCalendarDate(searchParams.get('date')) : today;
    if (date === null) return null;
    const params = new URLSearchParams();
    if (searchParams.has('date')) params.set('date', date);
    params.set('v', today);
    return {
      title: `NBA Slate · ${describeDay(date)} | ${SITE_NAME}`,
      description: 'Softest and toughest points matchups in every game.',
      image: `/api/games/slate/preview.png?${params}`,
    };
  }
  const gameId = /^\/matchups\/(\d{10})$/.exec(pathname)?.[1];
  if (!gameId) return null;
  const params = new URLSearchParams({ game_id: gameId, v: today });
  return {
    title: `NBA Matchup | ${SITE_NAME}`,
    description: "Every player's points Matchup Score in this game, softest to toughest.",
    image: `/api/games/matchup/preview.png?${params}`,
  };
};
