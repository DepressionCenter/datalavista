# This file is part of DataLaVista™
# tests/test_launchers.py
# Author(s): PHJ2000.
# Created: 2026-10-26
# Last Modified: 2026-10-26
# Summary: Checks the local launcher and HTTP serving contract.
# Notes: See README file for documentation and full license information.
# 
# Copyright © 2026 The Regents of the University of Michigan
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License along
# with this program. If not, see <https://www.gnu.org/licenses/>.

import os
import pathlib
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]


class LauncherTests(unittest.TestCase):
    def test_invalid_ports(self):
        for args in (["0"], ["65536"], ["abc"], ["8010", "extra"], ["1;touch injected"]):
            with self.subTest(args=args):
                result = subprocess.run(["bash", str(ROOT / "run.sh"), *args], capture_output=True)
                self.assertEqual(result.returncode, 2)
                self.assertIn(b"Usage:", result.stderr)

    def test_platform_selection(self):
        for system, arch, binary in (("Darwin", "arm64", "ZippyServe-mac-arm64"),
                                     ("Darwin", "x86_64", "ZippyServe-mac-amd64"),
                                     ("Linux", "x86_64", "ZippyServe-linux-amd64")):
            with self.subTest(system=system, arch=arch), tempfile.TemporaryDirectory(prefix="dlv platform ") as tmp:
                root = pathlib.Path(tmp)
                shutil.copy2(ROOT / "run.sh", root)
                (root / "DataLaVista.html").write_text("synthetic app")
                (root / "bin").mkdir()
                stub = root / "bin" / binary
                stub.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\n')
                stub.chmod(0o755)
                uname = root / "bin/uname"
                uname.write_text(f'#!/bin/sh\ncase "$1" in -s) echo {system};; -m) echo {arch};; esac\n')
                uname.chmod(0o755)
                result = subprocess.run(["bash", str(root / "run.sh"), "09000"], capture_output=True,
                                        env={**os.environ, "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"]})
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.decode().splitlines()[1:],
                                 ["-port", "9000", "-index", str(root / "DataLaVista.html")])

    def test_missing_binary(self):
        with tempfile.TemporaryDirectory(prefix="dlv missing ") as tmp:
            shutil.copy2(ROOT / "run.sh", tmp)
            result = subprocess.run(["bash", str(pathlib.Path(tmp) / "run.sh")], capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn(b"ZippyServe is missing", result.stderr)

    def test_http_from_another_directory(self):
        with tempfile.TemporaryDirectory(prefix="dlv space ") as tmp:
            root = pathlib.Path(tmp)
            shutil.copy2(ROOT / "run.sh", root)
            shutil.copy2(ROOT / "DataLaVista.html", root)
            (root / "bin").mkdir()
            shutil.copy2(ROOT / "bin/ZippyServe-linux-amd64", root / "bin")
            (root / "samples/data").mkdir(parents=True)
            sample = ROOT / "samples/data/studies.csv"
            shutil.copy2(sample, root / "samples/data")
            (root / ".secret").write_text("synthetic-hidden-value")
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", 0))
                port = probe.getsockname()[1]
            with tempfile.TemporaryFile() as log:
                process = subprocess.Popen(["bash", str(root / "run.sh"), str(port)], cwd="/", stdout=log, stderr=log)
                try:
                    url = f"http://127.0.0.1:{port}"
                    for attempt in range(50):
                        try:
                            response = urllib.request.urlopen(url + "/DataLaVista.html", timeout=1)
                            break
                        except urllib.error.HTTPError:
                            raise
                        except urllib.error.URLError:
                            if process.poll() is not None:
                                self.fail("Server exited before accepting HTTP requests")
                            time.sleep(0.05)
                    else:
                        self.fail("Server did not accept HTTP requests")
                    with response:
                        self.assertEqual(response.read(), (ROOT / "DataLaVista.html").read_bytes())
                    with urllib.request.urlopen(url + "/samples/data/studies.csv") as response:
                        self.assertEqual(response.read(), sample.read_bytes())
                    for path in ("/.secret", "/.git/config", "/%2e%2e/%2e%2e/etc/passwd", "/__mcp"):
                        with self.subTest(path=path), self.assertRaises(urllib.error.HTTPError) as error:
                            urllib.request.urlopen(url + path)
                        self.assertIn(error.exception.code, (400, 403, 404))
                        error.exception.close()
                finally:
                    process.terminate()
                    process.wait(timeout=10)


if __name__ == "__main__":
    unittest.main()
