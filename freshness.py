import json, sys, datetime, os
d = json.load(open(sys.argv[1])); p = d["freshness"]["pool"]
print("file_mtime", datetime.datetime.fromtimestamp(os.path.getmtime(sys.argv[1]), datetime.UTC).isoformat(timespec="seconds"),
      "pool.state=", p.get("state"), "pool.status=", p.get("status"), "pool.retrieved_at=", p.get("retrieved_at"),
      {k: v["status"] for k, v in p["providers"].items()},
      [(g["away_team"]["tricode"] + " @ " + g["home_team"]["tricode"], g["projection_state"]["state"]) for g in d["games"]])
