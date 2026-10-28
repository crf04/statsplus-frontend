/* How a report names its grades and its cards, in the page and in Edit mode. */

export const TAG_LABEL = {
  strong: 'Strong',
  lean: 'Lean',
  thin: 'Thin',
  pass: 'Pass',
  tipped: 'Tipped',
};

const lastName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(-1)[0];

/* A chip's name for one card: whose card and what it shows ("Bane PTS w/o Banchero", "ORL on/off"). */
export const cardLabel = (call) => {
  const s = call.structured || {};
  const player = s.player && (s.player.name || s.player);
  const who = typeof player === 'string' ? lastName(player) : '';
  const applied = s.applied || {};
  if (call.tool === 'query_game_logs') {
    const without = (applied.without || []).map((w) => lastName(w.name || w));
    const minutes = applied.minutes;
    const scope = without.length
      ? `w/o ${without.join(', ')}`
      : minutes
        ? minutes.high >= 48
          ? `${minutes.low}+ min`
          : `${minutes.low}-${minutes.high} min`
        : (applied.filters || []).length
          ? 'vs defenses'
          : applied.last_n
            ? `last ${applied.last_n}`
            : 'season';
    return `${who} ${s.chart_stat || ''} ${scope}`.replace(/\s+/g, ' ').trim();
  }
  const named = {
    get_on_off: `${s.team || ''} on/off`,
    get_matchup: `${who} matchup`,
    get_rotation: 'Rotation',
    get_injuries: 'Report',
    get_injury_scenarios: 'Scenarios',
  }[call.tool];
  return (named || 'Card').trim();
};
