# Diet Share chips show a lean relative to the league, not a fixed share

**Status:** accepted

A player chip under a Defense Sheet row ("Jordan Poole · 58% FGA · +1.8σ") appears when the player's Season Diet Share for that slice sits at least one population standard deviation above the league mean for the slice, and the player's volume in the slice clears a small per-game floor. The backend delivers `league_average_share` and `sigma_deviation` on every Diet Share fact; the frontend owns only the display gate, in `src/matchups/displayConfig.js`:

| Base            | Minimum sigma deviation | Minimum volume per game |
| --------------- | ----------------------- | ----------------------- |
| playTypes       | 1                       | 1 possession            |
| shotZones       | 1                       | 1 FGA                   |
| shotTypes       | 1                       | 4 FGA                   |
| assistLocations | 1                       | 1 assist                |

A fact whose `sigma_deviation` is `null` (the backend had no baseline population for the slice) never renders. The chip text is `<name> · <share>% <unit> · <sign><σ>σ`, one decimal, sign always shown, matching the sheet row's own "vs league" sigma.

## Considered options

**A fixed share per Base** (the original rule: play types ≥15%, zones ≥25%, shot types ≥35%, assist locations ≥30%). Rejected because slice shares are far from uniform. Against 2025-26 production data the fixed gate showed 212 of 304 rotation players on Above the Break 3, where the league mean is 32%, and never showed a Corner 3 lean, where the league mean is 10%. Most chips were below league average and the word "leaning" was untrue.

**A ratio to the league mean** (show at 1.5× league share). Simpler to explain, but spread differs too much by slice: post-up and cut shares have a standard deviation about equal to their mean, while transition and at-rim assist shares are tight. One ratio is either noisy on the wide slices or silent on the tight ones. Sigma self-calibrates per slice and reuses the vocabulary the sheet already shows.

## Consequences

The frontend cannot compute the gate alone; it sees only the matchup's own players, so the baseline must come from the backend, which holds the whole league's facts. The decoder is strict: a payload missing either field is rejected rather than gated by share, so this frontend deploys after the backend that emits them.

The thresholds stay in named config so they can be tuned on real early-season data without a redesign. Changing a threshold changes which chips appear on every matchup, so the browser fixture carries at least one fact per branch that is hidden on purpose, and the Playwright journey asserts the exact chip text that must and must not render.
