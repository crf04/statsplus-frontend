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

export const getDisplayableDietShare = (player, base, rowKey) => {
  const value = player.dietShares[base]?.find((entry) => entry.key === rowKey)?.season;
  return value && shouldDisplayDietShare(base, value) ? value : null;
};
