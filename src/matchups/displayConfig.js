// A Defense Sheet reading with no league comparison says so rather than
// printing a relative figure it does not have. The Matchup sheet and a
// Target's readings show the same rows, so they refuse in the same words.
export const UNAVAILABLE_RELATIVE_LABEL = 'vs league: unavailable (not comparable)';

export const DIET_SHARE_DISPLAY_THRESHOLDS = Object.freeze({
  playTypes: Object.freeze({ minimumSigmaDeviation: 1, minimumVolumePerGame: 1 }),
  shotZones: Object.freeze({ minimumSigmaDeviation: 1, minimumVolumePerGame: 1 }),
  shotTypes: Object.freeze({ minimumSigmaDeviation: 1, minimumVolumePerGame: 4 }),
  assistLocations: Object.freeze({ minimumSigmaDeviation: 1, minimumVolumePerGame: 1 }),
});

export const shouldDisplayDietShare = (base, value) => {
  const threshold = DIET_SHARE_DISPLAY_THRESHOLDS[base];
  return (
    Boolean(threshold) &&
    value.sigmaDeviation !== null &&
    value.sigmaDeviation >= threshold.minimumSigmaDeviation &&
    value.volumePerGame >= threshold.minimumVolumePerGame
  );
};

// The focal outcome reads the same in the rail and the dossier. The rail scopes
// to the selected category; the dossier dates the game it is contextualizing.
export const formatFocalGameLine = (focalGameLine, categories, { includeDate = false } = {}) =>
  [
    `Focal game ${focalGameLine.matchup}`,
    ...(includeDate ? [focalGameLine.gameDate] : []),
    `${focalGameLine.minutes.toFixed(1)} MIN`,
    ...categories.map((category) => `${focalGameLine.stats[category].toFixed(1)} ${category}`),
  ].join(' · ');

// One player's season diet fact for one slice, whether or not it is displayable.
// Capture reads it for the league average the slice is measured against, which
// the display gate has no say over.
export const findDietShare = (player, base, sliceKey) =>
  player.dietShares[base]?.find((entry) => entry.key === sliceKey)?.season || null;

export const getDisplayableDietShare = (player, base, sliceKey) => {
  const value = findDietShare(player, base, sliceKey);
  return value && shouldDisplayDietShare(base, value) ? value : null;
};
