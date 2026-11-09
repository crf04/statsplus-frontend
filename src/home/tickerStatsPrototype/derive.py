"""PROTOTYPE: derive every market's season Matchup cell per player from captured
Matchup payloads, with slate_edges.py's own rule (Blend, else a lone component;
8 PPG floor). Usage: python3 derive.py <live-shots --record file> <out.json>"""
import json, sys

rec = json.load(open(sys.argv[1]))
out = {}
for key, m in rec.items():
    if not key.startswith('/api/games/matchup?'):
        continue
    rows = []
    for p in m['players']:
        if (p.get('season_scoring') or 0) < 8:
            continue
        cells = {}
        for market, windows in (p.get('scores') or {}).items():
            w = windows.get('season')
            if not w:
                continue
            if w.get('blend'):
                cells[market] = [round(w['blend']['value'], 4), w['blend']['thin']]
            elif not w.get('missing_inputs') and len(w.get('components') or {}) == 1:
                (c,) = w['components'].values()
                if c['value'] is not None:
                    cells[market] = [round(c['value'], 4), c['thin']]
        if cells:
            rows.append({'id': p['canonical_id'], 'name': p['name'], 'tricode': p['tricode'],
                         'ppg': round(p['season_scoring'], 1), 'cells': cells})
    out[m['game']['game_id'] if 'game_id' in m['game'] else key.split('game_id=')[1].split('&')[0]] = rows
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print({g: len(r) for g, r in out.items()})
