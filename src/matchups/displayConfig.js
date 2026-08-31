export const DIET_SHARE_DISPLAY_THRESHOLDS = Object.freeze({
  playTypes: Object.freeze({ minimumShare: 0.15, minimumVolumePerGame: 0 }),
  shotZones: Object.freeze({ minimumShare: 0.25, minimumVolumePerGame: 0 }),
  shotTypes: Object.freeze({ minimumShare: 0.35, minimumVolumePerGame: 4 }),
  assistLocations: Object.freeze({ minimumShare: 0.3, minimumVolumePerGame: 1 }),
});

export const shouldDisplayDietShare = (base, value) => {
  const threshold = DIET_SHARE_DISPLAY_THRESHOLDS[base];
  return (
    Boolean(threshold) &&
    value.share >= threshold.minimumShare &&
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

export const getDisplayableDietShare = (player, base, sliceKey) => {
  const value = player.dietShares[base]?.find((entry) => entry.key === sliceKey)?.season;
  return value && shouldDisplayDietShare(base, value) ? value : null;
};
