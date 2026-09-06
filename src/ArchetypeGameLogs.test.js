import { render, screen } from '@testing-library/react';
import ArchetypeGameLogs from './ArchetypeGameLogs';

const archetypeLog = (playerName, gameDate) => ({
  PLAYER_NAME: playerName,
  GAME_DATE: gameDate,
  MIN: 30,
  FGM: 5,
  FGA: 10,
  FG3M: 2,
  FG3A: 4,
  FTM: 3,
  FTA: 4,
  PTS: 17,
  TOV: 1,
  'FGM/36MIN': 6,
  'FGA/36MIN': 12,
  'FG3M/36MIN': 2.4,
  'FG3A/36MIN': 4.8,
  'FTA/36MIN': 4.8,
  'PTS/36MIN': 20.4,
  'FGM/36MIN_DIFF': 0,
  'FGA/36MIN_DIFF': 0,
  'FG3M/36MIN_DIFF': 0,
  'FG3A/36MIN_DIFF': 0,
  'FTA/36MIN_DIFF': 0,
  'PTS/36MIN_DIFF': 0,
});

describe('ArchetypeGameLogs', () => {
  test('formats serialized game dates through the table', () => {
    render(
      <ArchetypeGameLogs
        gameLogs={[
          archetypeLog('LeBron James', '2026-04-12'),
          archetypeLog('Anthony Davis', '2026-04-12T00:00:00'),
          archetypeLog('Stephen Curry', 'Sun, 12 Apr 2026 00:00:00 GMT'),
        ]}
      />,
    );

    expect(screen.getAllByRole('cell', { name: '4/12/2026', exact: true })).toHaveLength(3);
  });
});
