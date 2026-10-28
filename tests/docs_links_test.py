"""
This file is part of DataLaVista™
docs_links_test.py
Author(s): Gabriel Mongefranco.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Unit tests for the MkDocs hook that rewrites links leaving the docs folder.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.
"""

# Run from the repository root with:  python -m unittest tests/docs_links_test.py

import importlib.util
import pathlib
import unittest

### Load the Hook ###

# The hook file name has a hyphen, so it is loaded by path instead of imported by name
HOOK_PATH = pathlib.Path(__file__).resolve().parent.parent / "src" / "website" / "docs-links.py"
spec = importlib.util.spec_from_file_location("docs_links", HOOK_PATH)
docs_links = importlib.util.module_from_spec(spec)
spec.loader.exec_module(docs_links)

SITE_ROOT = "https://example.org/datalavista/"
GITHUB = docs_links.REPOSITORY_FILE_URL


class RewriteLinkTests(unittest.TestCase):

    def test_link_inside_docs_is_unchanged(self):
        self.assertEqual(docs_links.rewrite_link("how-to/get-started.md", "", SITE_ROOT), "how-to/get-started.md")
        self.assertEqual(docs_links.rewrite_link("../README.md", "how-to", SITE_ROOT), "../README.md")
        self.assertEqual(docs_links.rewrite_link("faq.md#slow", "", SITE_ROOT), "faq.md#slow")

    def test_repository_file_points_at_github(self):
        self.assertEqual(docs_links.rewrite_link("../README.md", "", SITE_ROOT), GITHUB + "README.md")
        self.assertEqual(docs_links.rewrite_link("../../AGENTS.md", "how-to", SITE_ROOT), GITHUB + "AGENTS.md")
        self.assertEqual(docs_links.rewrite_link("../skills/README.md", "", SITE_ROOT), GITHUB + "skills/README.md")

    def test_published_folder_points_at_the_website(self):
        self.assertEqual(docs_links.rewrite_link("../images/example.png", "", SITE_ROOT), SITE_ROOT + "images/example.png")
        self.assertEqual(docs_links.rewrite_link("../../dist/DataLaVista.html", "how-to", SITE_ROOT), SITE_ROOT + "dist/DataLaVista.html")
        self.assertEqual(docs_links.rewrite_link("../samples/data/studies.csv", "", SITE_ROOT), SITE_ROOT + "samples/data/studies.csv")

    def test_query_and_anchor_are_kept(self):
        self.assertEqual(docs_links.rewrite_link("../README.md#credits", "", SITE_ROOT), GITHUB + "README.md#credits")
        self.assertEqual(
            docs_links.rewrite_link("../dist/DataLaVista.html?reportMode=view#top", "", SITE_ROOT),
            SITE_ROOT + "dist/DataLaVista.html?reportMode=view#top",
        )

    def test_web_addresses_anchors_and_root_paths_are_unchanged(self):
        for target in ("https://example.org/page", "mailto:someone@example.org", "#section", "/root/file.md"):
            self.assertEqual(docs_links.rewrite_link(target, "", SITE_ROOT), target)

    def test_link_leaving_the_repository_is_unchanged(self):
        self.assertEqual(docs_links.rewrite_link("../../outside.md", "", SITE_ROOT), "../../outside.md")


class RewriteMarkdownTests(unittest.TestCase):

    def test_links_and_images_in_a_page_are_rewritten(self):
        page = (
            "[Back to help home](../README.md)\n"
            "![Screenshot](../images/shot.png \"The designer\")\n"
            "See [the notices](../THIRD-PARTY-NOTICES.md) and [the FAQ](faq.md).\n"
        )
        expected = (
            "[Back to help home](" + GITHUB + "README.md)\n"
            "![Screenshot](" + SITE_ROOT + "images/shot.png \"The designer\")\n"
            "See [the notices](" + GITHUB + "THIRD-PARTY-NOTICES.md) and [the FAQ](faq.md).\n"
        )
        self.assertEqual(docs_links.rewrite_markdown(page, "", SITE_ROOT), expected)

    def test_page_in_a_subfolder_resolves_from_its_own_folder(self):
        page = "[Help home](../README.md) and [the README](../../README.md)"
        expected = "[Help home](../README.md) and [the README](" + GITHUB + "README.md)"
        self.assertEqual(docs_links.rewrite_markdown(page, "how-to", SITE_ROOT), expected)


class SiteRootTests(unittest.TestCase):

    def test_docs_suffix_is_removed(self):
        self.assertEqual(docs_links.site_root_from("https://example.org/datalavista/docs/"), SITE_ROOT)
        self.assertEqual(docs_links.site_root_from("https://example.org/datalavista/docs"), SITE_ROOT)

    def test_address_without_docs_keeps_a_trailing_slash(self):
        self.assertEqual(docs_links.site_root_from("https://example.org/datalavista"), SITE_ROOT)


if __name__ == "__main__":
    unittest.main()
