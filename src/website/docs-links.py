"""
This file is part of DataLaVista™
docs-links.py
Author(s): Gabriel Mongefranco.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: MkDocs hook that rewrites links leaving the docs folder so they work on the published website.
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

# The pages in docs/ link to repository files with relative paths, such as ../README.md,
# so they work on GitHub. The website publishes only docs/ and a few sibling folders,
# so this hook rewrites each link that leaves docs/ before MkDocs converts the page:
#   - a link into a published folder (dist, images, samples, styles, presentations)
#     points at that folder on the website;
#   - any other repository file points at its page on GitHub.
# Links that stay inside docs/, web addresses, and anchors are left unchanged.

import posixpath
import re
from urllib.parse import urlsplit

### Settings ###

# Folders the publish workflow copies to the website next to docs/
PUBLISHED_FOLDERS = ("dist", "images", "samples", "styles", "presentations")

# Address of a repository file on GitHub, followed by its path from the repository root
REPOSITORY_FILE_URL = "https://github.com/DepressionCenter/datalavista/blob/main/"

# Folder inside the repository that MkDocs builds
DOCS_FOLDER = "docs"

# A Markdown link or image: optional "!", the text in brackets, then the target in parentheses
LINK_PATTERN = re.compile(r"(!?\[[^\]]*\]\()([^)\s]+)((?:\s+\"[^\"]*\")?\))")

# A fenced code block (``` or ~~~, at any indentation) or an inline code span. Links written
# inside them are examples for the reader and must be published exactly as written.
CODE_PATTERN = re.compile(r"(```.*?```|~~~.*?~~~|`[^`\n]*`)", re.S)


### Rewrite One Link ###

def rewrite_link(target, page_folder, site_root):
    """Return the link target to publish for a link found on a page.

    target: the link target as written in the Markdown, such as "../README.md#credits".
    page_folder: the page's folder relative to docs/, such as "" or "how-to".
    site_root: the website address that holds docs/ and the published folders,
        such as "https://code.depressioncenter.org/datalavista/".
    Returns the target unchanged when it is a web address, an anchor, a root-relative
    path, or a path that stays inside docs/.
    """
    parts = urlsplit(target)
    if parts.scheme or parts.netloc or not parts.path or target.startswith("/"):
        return target

    # Path of the linked file from the repository root, with ".." segments resolved
    repository_path = posixpath.normpath(posixpath.join(DOCS_FOLDER, page_folder, parts.path))
    if repository_path == DOCS_FOLDER or repository_path.startswith(DOCS_FOLDER + "/"):
        return target
    if repository_path.startswith("../"):
        # The link leaves the repository, which no rewrite can fix, so it is left for MkDocs to report
        return target

    suffix = ""
    if parts.query:
        suffix += "?" + parts.query
    if parts.fragment:
        suffix += "#" + parts.fragment

    first_folder = repository_path.split("/", 1)[0]
    if first_folder in PUBLISHED_FOLDERS:
        return site_root + repository_path + suffix
    return REPOSITORY_FILE_URL + repository_path + suffix


### Rewrite a Page ###

def rewrite_markdown(markdown, page_folder, site_root):
    """Return the Markdown of one page with every link target passed through rewrite_link.

    Text inside fenced code blocks and inline code spans is left exactly as written.
    """
    def replace(match):
        return match.group(1) + rewrite_link(match.group(2), page_folder, site_root) + match.group(3)
    parts = CODE_PATTERN.split(markdown)
    # split() returns prose and code alternately, with the code in the odd positions
    for index in range(0, len(parts), 2):
        parts[index] = LINK_PATTERN.sub(replace, parts[index])
    return "".join(parts)


def site_root_from(site_url):
    """Return the website address above the docs folder, with a trailing slash.

    site_url is the MkDocs site_url, which ends in the docs folder, such as
    "https://example.org/datalavista/docs/".
    """
    root = site_url.rstrip("/")
    if root.endswith("/" + DOCS_FOLDER):
        root = root[: -len(DOCS_FOLDER) - 1]
    return root + "/"


### MkDocs Entry Point ###

def on_page_markdown(markdown, page, config, files):
    """Called by MkDocs for every page before it converts the Markdown to HTML."""
    page_folder = posixpath.dirname(page.file.src_uri)
    return rewrite_markdown(markdown, page_folder, site_root_from(config["site_url"]))
