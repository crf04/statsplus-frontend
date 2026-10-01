The change is correct and I found no blocking issues. CI on HEAD `297f06f` passed (run 36804425437): validate passed, and E2E had 134 passed, 2 flaky and 2 skipped. All 7 parity screenshots passed on the first attempt. The run before this change (36803722855, on plain `ubuntu-latest`) failed its desktop parity screenshots on every retry.

**What I checked**

- **Digest:** `sha256:dcc5531e…` is the multi-arch index that `v1.62.1-noble` currently points to. On the x64 `ubuntu-latest` runner it resolves to the amd64 manifest `c091b21…`, which is the platform your README says the baselines were captured on. The tag and digest match each other.
- **Chromium install:** `package-lock.json` pins `@playwright/test`, `playwright` and `playwright-core` to 1.62.1. The image sets `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` and ships `chromium-1234` and `chromium_headless_shell-1234`. I ran the pinned image locally with `HOME` set to `/github/home`: 1.62.1's `install --dry-run chromium` points at those exact folders, and the real install adds nothing. So the step does nothing, and CI uses the browser the baselines came from.
- **Dropping `--with-deps`:** this is right. The image already has the system libraries, and `--with-deps` would only run apt inside the container for no reason.
- **Rest of the container:** Node and git work. The image ships Node v24, and `setup-node` switches to 22.14.0 as the validate job uses, which doesn't affect rendering. Git is present, so checkout behaves normally. No application source changed.

**Fix before merging**

- **Version drift:** `package.json` has `"@playwright/test": "^1.62.1"`. If the lockfile is ever bumped (for example by Dependabot) without changing the image tag, `npx playwright install chromium` will quietly download a newer Chromium into `/ms-playwright` instead of failing. The screenshots would then differ from the baselines in confusing ways, and CI would no longer match the reference environment. To prevent this, pin `"@playwright/test": "1.62.1"` exactly, or replace the install step with a check that fails when the versions differ, e.g. `test "$(npx playwright --version)" = "Version 1.62.1"`.

**Optional**

- If you want the workflow to state "amd64 only", pin the platform manifest `@sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac` instead of the index. With the index, an arm64 runner would quietly pull arm64 and render differently. That can't happen on `ubuntu-latest` today.

**Not caused by this change**

- The two flaky tests were `core-flows.spec.js:202` ("a season the panel cannot express survives an unrelated apply") and `:780` ("removing every self filter clears its parameter"). They are behaviour checks, not screenshots, and both failed with `toBe` errors before passing on retry. The `:780` test also failed its first attempt in the earlier `ubuntu-latest` run, so it was flaky before the container change. It's worth its own issue, but it doesn't block this one.

I couldn't independently confirm that the Linux baselines came from the frozen reference deployment rather than the build. That rests on the README note in `976a9cb`. The parity kit passing with the 50-pixel tolerance unchanged fits that claim but doesn't prove it.
