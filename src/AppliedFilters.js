import { Badge } from 'react-bootstrap';

const AppliedFilters = ({ filters }) => {
  const renderBadge = (key, value, bg = 'primary') => (
    <Badge key={key} bg={bg} className="me-1">
      {value}
    </Badge>
  );

  const renderFilterBadge = (key, value) => {
    if (key === 'teams_against[]' && filters['rank_filter[]']) {
      const teamsArray = Array.isArray(value) ? value : [value];
      const ranksArray = Array.isArray(filters['rank_filter[]'])
        ? filters['rank_filter[]']
        : [filters['rank_filter[]']];
      return teamsArray.map((team, index) => {
        const rank = ranksArray[index];
        return renderBadge(`${key}-${index}`, `${team} (${rank})`);
      });
    } else if (key === 'player_name') {
      return renderBadge(key, `Player: ${value}`);
    } else if (key === 'season_filter') {
      return renderBadge(key, `Season: ${value}`);
    } else if (key === 'playstyle_RTG_min' && filters.playstyle_RTG_max === undefined) {
      return renderBadge(key, `PLAYTYPE_RTG >= ${value}`);
    } else if (key === 'playstyle_RTG_max' && filters.playstyle_RTG_min === undefined) {
      return renderBadge(key, `PLAYTYPE_RTG <= ${value}`);
    } else if (key === 'date_filter') {
      return renderBadge(key, `Date >= ${value}`);
    } else if (key === 'game_filter') {
      return renderBadge(key, `GAMES <= ${value}`);
    } else if (key === 'players_on' || key === 'players_on[]') {
      const playerList = Array.isArray(value) ? value : [value];
      return renderBadge(key, `(ON) ${playerList.join(', ')}`, 'success');
    } else if (key === 'players_off' || key === 'players_off[]') {
      const playerList = Array.isArray(value) ? value : [value];
      return renderBadge(key, `(OFF) ${playerList.join(', ')}`, 'danger');
    } else if (key.startsWith('self_filters[')) {
      const stat = key.match(/\[(.*?)\]/)[1];
      if (!value) return null;
      const [min, max] = value.split(',');

      if (max === '999') {
        return renderBadge(key, `${stat} >= ${min}`);
      } else if (min === '0') {
        return renderBadge(key, `${stat} <= ${max}`);
      }
      return renderBadge(key, `${min} <= ${stat} <= ${max}`);
    } else if (key === 'location_filter') {
      return renderBadge(key, `Location: ${value}`);
    } else if (key === 'minutes_filter') {
      if (!value) return null;
      const parts = value.split(',');
      if (parts.length !== 2) return null;
      return renderBadge(key, `${parts[0]} <= MIN <= ${parts[1]}`);
    }
    return null;
  };

  const playstyleMin = filters.playstyle_RTG_min;
  const playstyleMax = filters.playstyle_RTG_max;
  const playstyleBadge =
    playstyleMin !== undefined &&
    playstyleMax !== undefined &&
    renderBadge('playstyle_RTG', `${playstyleMin} <= PLAYTYPE_RTG <= ${playstyleMax}`);

  const appliedFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'rank_filter[]') return false;
    if (
      (key === 'playstyle_RTG_min' || key === 'playstyle_RTG_max') &&
      playstyleMin !== undefined &&
      playstyleMax !== undefined
    ) {
      return false;
    }
    return (
      typeof value === 'number' ||
      (typeof value === 'string' && value !== '') ||
      (Array.isArray(value) && value.length > 0)
    );
  });

  if (appliedFilters.length === 0 && !playstyleBadge) {
    return null;
  }

  return (
    <>
      {appliedFilters.map(([key, value]) => renderFilterBadge(key, value))}
      {playstyleBadge}
    </>
  );
};

export default AppliedFilters;
