/*
 * PROTOTYPE — throwaway. In-memory only; nothing here is persisted.
 *
 * Density is the thing a list design lives or dies on, so these exist to fill
 * the variants when the real API has nothing (or is not running). Newest-first,
 * the way the backend returns the real list.
 */
export const FIXTURE_SAVED_FILTER_SETS = [
  {
    id: 'fx-1',
    name: 'Luka vs drop coverage',
    queryString:
      'player_name=Luka+Doncic&season_filter=2025-26&teams_against%5B%5D=MIN&teams_against%5B%5D=OKC&rank_filter%5B%5D=5&rank_filter%5B%5D=12&minutes_filter=32,48',
  },
  {
    id: 'fx-2',
    name: 'SGA road nights',
    queryString: 'player_name=Shai+Gilgeous-Alexander&location_filter=Away&game_filter=15',
  },
  {
    id: 'fx-3',
    name: 'Jokic without Murray',
    queryString:
      'player_name=Nikola+Jokic&season_filter=2025-26&players_off%5B%5D=Jamal+Murray&self_filters%5BAST%5D=8,999',
  },
  {
    id: 'fx-4',
    name: 'Wemby blocks floor',
    queryString: 'player_name=Victor+Wembanyama&self_filters%5BBLK%5D=2,999&game_filter=25',
  },
  {
    id: 'fx-5',
    name: 'Tatum home, heavy minutes',
    queryString: 'player_name=Jayson+Tatum&location_filter=Home&minutes_filter=36,48',
  },
  {
    id: 'fx-6',
    name: 'Ant with Gobert on',
    queryString: 'player_name=Anthony+Edwards&players_on%5B%5D=Rudy+Gobert&season_filter=2025-26',
  },
  {
    id: 'fx-7',
    name: 'Luka since the trade',
    queryString: 'player_name=Luka+Doncic&date_filter=2026-02-01',
  },
  {
    id: 'fx-8',
    name: 'Halibuton pace check',
    queryString: 'player_name=Tyrese+Haliburton&game_filter=10&self_filters%5BAST%5D=10,999',
  },
  {
    id: 'fx-9',
    // A link the app now refuses: game_filter=0 asks for the last nothing.
    name: 'old link, kept anyway',
    queryString: 'player_name=Kawhi+Leonard&game_filter=0',
  },
];
