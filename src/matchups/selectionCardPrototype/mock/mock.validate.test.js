// PROTOTYPE — throwaway. Both captured datasets must pass the real decoders.
import { decodeMatchup, decodeMatchupSelection } from '../../matchupApi';
import matchup from './matchup.json';
import matchupPregame from './matchup-pregame.json';
import s from './selection-1630552.json';
import p from './selection-pregame-1630552.json';

test('completed capture decodes', () => {
  const m = decodeMatchup(matchup);
  const jj = m.players.find((x) => x.id === 1630552);
  expect(jj.focalGameLine).not.toBeNull();
  expect(decodeMatchupSelection(s, jj.statCategories, 1630552, { gameId: m.game.gameId, mode: 'historical', focalGameLine: jj.focalGameLine }).h2h.rows.length).toBe(4);
});

test('pregame synthesis decodes as a current-mode matchup', () => {
  const m = decodeMatchup(matchupPregame);
  expect(m.experience.mode).toBe('current');
  expect(m.game.status).toBe('scheduled');
  const jj = m.players.find((x) => x.id === 1630552);
  expect(jj.focalGameLine).toBeNull();
  expect(jj.provenance.prizepicks).toEqual(jj.statCategories);
  const sel = decodeMatchupSelection(p, jj.statCategories, 1630552, { gameId: m.game.gameId, mode: 'current', focalGameLine: null });
  expect(sel.experience.samples.context).toBe('season_to_date');
  expect(sel.h2h.rows.length).toBe(4);
});
