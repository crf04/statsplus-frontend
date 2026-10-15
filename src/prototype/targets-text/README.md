# PROTOTYPE — Targets page text size (throwaway)

Question: the Targets page text is hard to read; how much bigger, and where?

Four variants on the real `/targets` page, switched by the URL hash `#v=<key>`
and the floating bar (← → keys work too):

| Key | Variant | What changes |
| --- | --- | --- |
| Now | Current sizes | nothing (comparison) |
| A | Every size +15% | every rem/px font size ×1.15; spacing unchanged |
| B | Small print raised | 9.6–14px text maps to 12.5–14.5px, body +6%, headings unchanged |
| C | Whole page zoomed 115% | CSS `zoom`: type and spacing together, like browser zoom |

`variants.css` is generated: `node src/prototype/targets-text/generate-variants.mjs`
rewrites it from the Targets stylesheets. Its rules double as the size table a
real change would apply.

Standalone build (no sign-in, captured production payloads for the owner's
11 Targets, 2026-04-10 slate): `REACT_APP_PROTOTYPE=targets-text npm run build`.
Writes and links off the page are not mocked.

Hosted: https://statsplus-text-proto.vercel.app/targets#v=A
