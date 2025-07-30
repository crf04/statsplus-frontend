# Missing NBA Stats Documentation

## Available Stats (from team_service.py)

### Traditional Category
Based on NBA API `LeagueDashTeamStats` endpoint:
- ✅ **Points (PTS)** - Available
- ✅ **Rebounds (REB)** - Available  
- ✅ **Assists (AST)** - Available
- ✅ **Field Goals Made/Attempted (FGM/FGA)** - Available
- ✅ **3-Point Made/Attempted (FG3M/FG3A)** - Available
- ✅ **Free Throws Made/Attempted (FTM/FTA)** - Available
- ✅ **Steals (STL)** - Available
- ✅ **Blocks (BLK)** - Available
- ✅ **Turnovers (TOV)** - Available
- ✅ **Wins/Losses (W/L)** - Available

### Advanced Stats (Likely Available)
From NBA API Advanced stats:
- ✅ **Offensive Rating (OFF_RATING)** - Available via API
- ✅ **Defensive Rating (DEF_RATING)** - Available via API
- ✅ **Pace (PACE)** - Available via API
- ✅ **True Shooting % (TS_PCT)** - Available via API
- ✅ **Effective FG % (EFG_PCT)** - Available via API
- ✅ **Turnover % (TOV_PCT)** - Available via API

### Playtypes Category
- ✅ **Pick and Roll** - Available
- ✅ **Isolation** - Available
- ✅ **Post-up** - Available
- ✅ **Spot-up** - Available
- ✅ **Transition** - Available
- ✅ **Cut** - Available
- ✅ **Hand-off** - Available
- ✅ **Off Screen** - Available

### Assists Category  
- ✅ **Assist patterns** - Available (processed_team_assists table)

### Zone Shooting Category
- ✅ **Paint shooting** - Available
- ✅ **Mid-range shooting** - Available
- ✅ **3-point shooting by zone** - Available
- ✅ **At rim shooting** - Available

### Shooting Type Category
- ✅ **Catch and Shoot** - Available
- ✅ **Pull-ups** - Available
- ✅ **Less Than 10 ft** - Available

## Potentially Missing Stats

### Team Efficiency Metrics
- ❓ **Net Rating** - Can be calculated (OFF_RATING - DEF_RATING)
- ❓ **Plus/Minus** - May need to be calculated from game logs
- ❓ **Team Rebounding %** - May need calculation from total rebounds

### Advanced Defensive Stats
- ❓ **Opponent Field Goal % by Zone** - Available through Zone Shooting
- ❓ **Defensive Rebounding %** - May need calculation
- ❓ **Steals + Blocks combined** - Available (already calculated in service)

### Team Chemistry Stats
- ❓ **Bench Points** - May need calculation from player data
- ❓ **Points in Paint** - May be available in zone shooting
- ❓ **Fast Break Points** - May need calculation
- ❓ **Second Chance Points** - May need calculation

## Action Items

### Immediate (Available Now)
1. **Basic Stats**: Points, Rebounds, Assists ✅
2. **Advanced Efficiency**: ORTG, DRTG, PACE ✅  
3. **Shooting**: FG%, 3P%, FT% ✅
4. **Turnovers and Steals/Blocks** ✅

### Needs API Testing
1. Test if NET_RATING is directly available or needs calculation
2. Verify which shooting zone stats are available
3. Check if pace calculation matches expected values

### Future Enhancements
1. Add play-type breakdowns for offense/defense analysis
2. Include zone shooting visualizations
3. Add assist pattern analysis for team chemistry

## Backend Endpoints to Use

1. **GET /api/teams/stats?team={team}&category=Traditional**
   - For basic stats, ORTG, DRTG, PACE
   
2. **GET /api/teams/stats?team={team}&category=Playtypes**  
   - For detailed offensive/defensive play breakdowns
   
3. **GET /api/teams/stats?team={team}&category=Zone Shooting**
   - For shot location analysis
   
4. **GET /api/teams/stats?team={team}&category=Assists**
   - For team chemistry and ball movement

## Notes
- All basic stats (Points, Rebounds, Assists, ORTG, DRTG, PACE) are definitely available
- The existing backend structure supports comprehensive team analysis
- Focus should be on clean presentation of available data rather than missing metrics