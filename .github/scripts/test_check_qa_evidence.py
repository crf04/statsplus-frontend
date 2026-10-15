import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("check_qa_evidence.py")


def evidence(environment: str, revision: str, result: str = "passed") -> str:
    return (
        "| Evidence | Value |\n"
        "| --- | --- |\n"
        f"| Result | {result} |\n"
        f"| Environment | {environment} |\n"
        f"| Frontend | feature/x@{revision[:12]} |\n"
        "| Journey SHA-256 | abc |\n"
    )


class CheckQaEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.repo = Path(self.directory.name)
        self.git("init", "-q", "-b", "master")
        self.commit({"src/App.jsx": "v1", "docs/a.md": "a"})
        self.base = self.rev()
        self.git("checkout", "-q", "-b", "feature")

    def tearDown(self):
        self.directory.cleanup()

    def git(self, *arguments):
        return subprocess.run(
            ["git", "-c", "user.name=t", "-c", "user.email=t@t", *arguments],
            cwd=self.repo,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    def commit(self, files):
        for name, content in files.items():
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "change")
        return self.rev()

    def rev(self):
        return self.git("rev-parse", "HEAD")

    def check(self, body):
        (self.repo / ".body").write_text(body)
        # The workflow runs from .github/scripts, below the repository root.
        (self.repo / ".github/scripts").mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--body-file", str(self.repo / ".body"), "--base", self.base, "--head", self.rev()],
            cwd=self.repo / ".github/scripts",
            capture_output=True,
            text=True,
            env={**os.environ, "GITHUB_EVENT_PATH": ""},
        )
        return result.returncode, result.stdout

    def test_a_user_visible_change_without_evidence_fails(self):
        self.commit({"src/App.jsx": "v2"})
        code, output = self.check("Live checks: user-visible\n\nScreenshots from live-shots only.")
        self.assertEqual(code, 1)
        self.assertIn("needs a passed qa evidence.md table", output)

    def test_a_user_visible_change_with_qa_evidence_at_the_head_passes(self):
        head = self.commit({"src/App.jsx": "v2"})
        code, _ = self.check("**Live checks:** user-visible\n\n" + evidence("qa", head).replace("\n", "\r\n"))
        self.assertEqual(code, 0)

    def test_evidence_from_before_the_change_does_not_count(self):
        self.commit({"src/App.jsx": "v2"})
        code, _ = self.check("Live checks: user-visible\n\n" + evidence("qa", self.base))
        self.assertEqual(code, 1)

    def test_a_runtime_commit_after_qa_needs_a_new_run(self):
        tested = self.commit({"src/App.jsx": "v2"})
        self.commit({"src/App.jsx": "v3"})
        code, _ = self.check("Live checks: user-visible\n\n" + evidence("qa", tested))
        self.assertEqual(code, 1)

    def test_test_and_doc_commits_after_qa_keep_the_evidence(self):
        tested = self.commit({"src/App.jsx": "v2"})
        self.commit({"src/App.test.jsx": "t", "docs/a.md": "b", "e2e/flow.spec.js": "f"})
        code, _ = self.check("Live checks: user-visible\n\n" + evidence("qa", tested))
        self.assertEqual(code, 0)

    def test_failed_or_unknown_evidence_does_not_count(self):
        head = self.commit({"src/App.jsx": "v2"})
        for table in [
            evidence("qa", head, result="failed: 1 journey commands did not finish"),
            evidence("qa", "0123456789ab"),
            evidence("qa", "not-a-sha"),
        ]:
            with self.subTest(table=table):
                self.assertEqual(self.check("Live checks: user-visible\n\n" + table)[0], 1)

    def test_a_boundary_change_needs_production_evidence_too(self):
        head = self.commit({"src/api.js": "v2"})
        code, output = self.check("Live checks: boundary\n\n" + evidence("qa", head))
        self.assertEqual(code, 1)
        self.assertIn("needs a passed production evidence.md table", output)
        self.assertNotIn("passed qa", output)
        code, _ = self.check("Live checks: boundary\n\n" + evidence("qa", head) + "\n" + evidence("production", head))
        self.assertEqual(code, 0)

    def test_a_runtime_change_must_say_which_live_checks_apply(self):
        head = self.commit({"package.json": "{}"})
        for body in [evidence("qa", head), "Live checks: <!-- user-visible, boundary, or gates only -->"]:
            with self.subTest(body=body):
                code, output = self.check(body)
                self.assertEqual(code, 1)
                self.assertIn("does not say which live checks apply", output)

    def test_a_gates_only_change_needs_no_evidence(self):
        self.commit({"src/App.jsx": "v2"})
        self.assertEqual(self.check("Live checks: gates only\n\nsrc/App.test.jsx covers the refactor.")[0], 0)

    def test_a_gates_only_change_must_name_its_tests(self):
        self.commit({"src/App.jsx": "v2"})
        code, output = self.check("Live checks: gates only\n\nRefactor; Jest covers it.")
        self.assertEqual(code, 1)
        self.assertIn("names the tests", output)

    def test_merging_a_runtime_change_from_master_after_qa_needs_a_new_run(self):
        tested = self.commit({"src/App.jsx": "v2"})
        self.git("checkout", "-q", "master")
        self.commit({"src/api.js": "new endpoint"})
        self.git("checkout", "-q", "feature")
        self.git("-c", "core.editor=true", "merge", "-q", "--no-ff", "master")
        code, _ = self.check("Live checks: user-visible\n\n" + evidence("qa", tested))
        self.assertEqual(code, 1)

    def test_a_change_to_no_runtime_file_needs_nothing(self):
        self.commit({"docs/a.md": "b", ".github/workflows/ci.yml": "x", "src/App.test.jsx": "t"})
        self.assertEqual(self.check("")[0], 0)


if __name__ == "__main__":
    unittest.main()
