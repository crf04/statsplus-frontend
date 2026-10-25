// /api/games/seasons as fetchSeasons decodes it (crf04/statsplus#330).

// A backend before season choices: seasons only, nothing new to offer.
export const legacySeasons = {
  seasons: ['2025-26', '2024-25'],
  defaultSeason: '2025-26',
  choices: undefined,
};

// Choices without a season not yet published.
export const publishedOnlySeasons = {
  ...legacySeasons,
  choices: [
    { season: '2025-26', mode: 'published', families: {}, teamGames: null },
    { season: '2024-25', mode: 'retained', families: {}, teamGames: null },
  ],
};

// 2026-27 served early, beside the Published and a retained season.
export const unpublishedSeasons = {
  ...legacySeasons,
  choices: [
    {
      season: '2026-27',
      mode: 'unpublished',
      families: { game_logs: { servedSeason: '2026-27', state: 'serving', reason: null } },
      teamGames: { min: 2, max: 4 },
    },
    ...publishedOnlySeasons.choices,
  ],
};
