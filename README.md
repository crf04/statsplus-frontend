Evidence only (not code). Target Backtest season amendment, 2026-10-05.
staging/: T3 browser, hosted staging frontend 7e170a27 + backend dd88bfc9 (deployment 59467532; s07 under stage-only pin de3bc904), real Google session.
qa/: verify-statsplus helper, isolated QA (backend dd88bfc9, frontend 7e170a27, disposable DB, dedicated QA identity).
production/: verify-statsplus --environment production, local frontend 7e170a27 against deployed production backend (read-only).
