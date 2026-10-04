# Connect page screenshot evidence

Frontend revision: bdc3f192b12e4a121c7dae1d62bdb096bf4aec41.
Local frontend connected to production Railway with real Firebase authentication; no fixture auth. Desktop 1440×900, phone 390×844. Signed-in admin navigation is visible and fits at phone width.

Captured 2026-10-04 through the verify-statsplus production helper, using a temporary copy that grants browser clipboard permissions and captures scrolled viewport screenshots instead of full-page images. No application styles were changed for capture. Chromium full-page capture does not correctly paint the app's fixed background outside the viewport, so overlapping viewport captures show the actual rendered page.

The supplied journey checks route heading, document overflow and Copy → Copied at desktop and phone widths. All 15 steps passed, including cleanup. The page issues no API requests. This evidence does not verify ChatGPT/Claude connector OAuth; those acceptance checks remain pending deployment.

The step-number CSS fix passes two independent Astra review axes; its browser regression test fails when the decimal declaration is removed. Full frontend gate: lint, format, 831 Jest tests, build, 140 E2E passed/2 skipped.

Images were inspected: both clients have visible numbered steps, all sections remain dark/readable when scrolled, no phone overflow. The desktop heading outline is the app's route-focus indicator.
