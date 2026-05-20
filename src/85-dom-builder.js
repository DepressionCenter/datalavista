/* ============================================================
This file is part of DataLaVista™
85-dom-builder.js: CSP-safe DOM element builder helpers.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-05-19
Last Modified: 2026-05-19
Summary: dlvEl() and dlvActionBtn() replace innerHTML template strings
         with proper DOM construction — no backticks, no eval, SP-safe.
Notes: See README file for documentation and full license information.
Website: https://github.com/DepressionCenter/datalavista

Copyright (c) 2026 The Regents of the University of Michigan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
You should have received a copy of the GNU General Public License along
with this program. If not, see https://www.gnu.org/licenses.
================================================================ */

/* ─────────────────────────────────────────────────────────────────────────
   dlvEl(tag, attrs, children)

   Creates a DOM element without template literals or innerHTML.

   attrs keys:
     'text'      → el.textContent (safe text, not HTML)
     'data-*'    → el.dataset[rest]  (e.g. 'data-action' → dataset.action)
     anything else → el.setAttribute(k, v)

   children: array of Element | string.  Strings become text nodes.

   Example:
     dlvEl('button', {'class': 'btn', 'data-action': 'dd-close', 'text': 'Close'})
     dlvEl('div', {'class': 'card'}, [headerEl, bodyEl])
───────────────────────────────────────────────────────────────────────── */
function dlvEl(tag, attrs, children) {
  var el = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function(k) {
      if (k === 'text') {
        el.textContent = attrs[k];
      } else if (k.slice(0, 5) === 'data-') {
        el.dataset[k.slice(5)] = attrs[k];
      } else {
        el.setAttribute(k, attrs[k]);
      }
    });
  }
  if (children) {
    children.forEach(function(c) {
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return el;
}

/* ─────────────────────────────────────────────────────────────────────────
   dlvActionBtn(label, action, extraData)

   Shorthand for a <button> with data-action and optional extra data-* attrs.
   label    → button text content
   action   → value of data-action attribute (dispatched via _dlvActions)
   extraData → plain object of additional attrs merged onto the button
               (e.g. {'data-index': '3', 'class': 'btn btn-sm'})

   Example:
     dlvActionBtn('Remove', 'queue-remove-upload', {'data-index': String(i)})
───────────────────────────────────────────────────────────────────────── */
function dlvActionBtn(label, action, extraData) {
  var attrs = Object.assign({'data-action': action}, extraData);
  var btn = dlvEl('button', attrs);
  btn.textContent = label;
  return btn;
}
