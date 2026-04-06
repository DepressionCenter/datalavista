/* ============================================================
This file is part of DataLaVista™
05-tooltip.js: Tooltip functionality for DataLaVista.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-27
Last Modified: 2026-04-06
Summary: Tooltip functionality for DataLaVista.
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
with this program. If not, see <https://www.gnu.org/licenses/>.
================================================================ */


/*
  DataLaVista — Rich-Text Tooltip (Speech Bubble) Helper
  -------------------------------------------------------
  Universal tooltip helper that renders a styled speech-bubble tooltip
  with support for arbitrary HTML content.

  Usage:
    // 1. Attach to any element imperatively:
    dlvTooltip.attach(element, '<strong>Hello</strong> world');

    // 2. Or declaratively via data attributes in HTML:
    <button data-dlv-tip="<b>Add widget</b><br>Drag to canvas">+ Add</button>

    // 3. Or via helper shortcuts:
    dlvTooltip.attachTree(tableOrFieldEl, htmlContent);
    dlvTooltip.attachWidget(widgetEl, htmlContent);
    dlvTooltip.attachButton(buttonEl, htmlContent);

  Options (third argument object):
    placement   'top' | 'bottom' | 'left' | 'right' | 'auto'  (default 'auto')
    delay       number in ms before showing  (default 500)
    maxWidth    CSS string  (default '360px')
    theme       'default' | 'info' | 'success' | 'warning' | 'error'
*/

/* ------------------------------------------------------------------ */
/*  Singleton tooltip element                                           */
/* ------------------------------------------------------------------ */
const dlvTooltip = (() => {
  let _tip = null;         // the DOM bubble
  let _arrow = null;       // the tail/arrow div
  let _showTimer = null;
  let _hideTimer = null;
  let _currentEl = null;

  const SHOW_DELAY = 500;  // ms
  const HIDE_DELAY = 100;  // ms
  const GAP = 10;          // px gap between anchor and bubble

  /* ---------- create the singleton DOM node once ---------- */
  function _ensureTip() {
    if (_tip) return;
    _tip = document.createElement('div');
    _tip.id = 'dlv-tooltip';
    _tip.setAttribute('role', 'tooltip');

    _arrow = document.createElement('div');
    _arrow.className = 'dlv-tooltip-arrow';
    _tip.appendChild(_arrow);

    const _body = document.createElement('div');
    _body.className = 'dlv-tooltip-body';
    // Ensure rich HTML content wraps properly
    _body.style.cssText = 'white-space:normal;word-break:break-word;overflow-wrap:break-word;line-height:1.5';
    _tip.appendChild(_body);

    document.body.appendChild(_tip);

    // Hide when mouse enters the tip itself (keeps it open for links)
    _tip.addEventListener('mouseenter', () => clearTimeout(_hideTimer));
    _tip.addEventListener('mouseleave', () => _scheduleHide());
  }

  /* ---------- position the bubble relative to an anchor ---------- */
  function _position(anchor, placement) {
    const aRect = anchor.getBoundingClientRect();
    const tRect = _tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // resolve 'auto' placement
    if (placement === 'auto') {
      const spaceAbove = aRect.top;
      const spaceBelow = vh - aRect.bottom;
      const spaceRight = vw - aRect.right;
      const spaceLeft  = aRect.left;
      if (spaceAbove >= tRect.height + GAP + 20) placement = 'top';
      else if (spaceBelow >= tRect.height + GAP + 20) placement = 'bottom';
      else if (spaceRight >= tRect.width  + GAP + 20) placement = 'right';
      else if (spaceLeft  >= tRect.width  + GAP + 20) placement = 'left';
      else placement = 'top'; // fallback
    }

    let top, left;

    if (placement === 'top') {
      top  = aRect.top  - tRect.height - GAP;
      left = aRect.left + aRect.width / 2 - tRect.width / 2;
    } else if (placement === 'bottom') {
      top  = aRect.bottom + GAP;
      left = aRect.left + aRect.width / 2 - tRect.width / 2;
    } else if (placement === 'left') {
      top  = aRect.top + aRect.height / 2 - tRect.height / 2;
      left = aRect.left - tRect.width - GAP;
    } else { // right
      top  = aRect.top + aRect.height / 2 - tRect.height / 2;
      left = aRect.right + GAP;
    }

    // clamp to viewport with 8px margin
    left = Math.max(8, Math.min(left, vw - tRect.width - 8));
    top  = Math.max(8, Math.min(top,  vh - tRect.height - 8));

    _tip.style.left = left + 'px';
    _tip.style.top  = top  + 'px';

    // arrow position & direction class
    _tip.className = 'dlv-tooltip dlv-tip-' + placement + (_tip.dataset.theme ? ' dlv-tip-theme-' + _tip.dataset.theme : '');

    // re-center arrow along the edge it points from
    if (placement === 'top' || placement === 'bottom') {
      const anchorCenterX = aRect.left + aRect.width / 2;
      const arrowLeft = Math.max(12, Math.min(anchorCenterX - left - 8, tRect.width - 28));
      _arrow.style.left = arrowLeft + 'px';
      _arrow.style.top  = '';
    } else {
      const anchorCenterY = aRect.top + aRect.height / 2;
      const arrowTop = Math.max(8, Math.min(anchorCenterY - top - 8, tRect.height - 24));
      _arrow.style.top  = arrowTop + 'px';
      _arrow.style.left = '';
    }
  }

  /* ---------- show ---------- */
  function _show(anchor, html, opts = {}) {
    _ensureTip();
    clearTimeout(_hideTimer);
    clearTimeout(_showTimer);

    const delay = opts.delay != null ? opts.delay : SHOW_DELAY;
    _showTimer = setTimeout(() => {
      const body = _tip.querySelector('.dlv-tooltip-body');
      body.innerHTML = html;
      _tip.style.maxWidth = (opts.maxWidth ? opts.maxWidth.replace('px','').trim() + 'px' : '360px');
      _tip.dataset.theme = opts.theme || '';
      _tip.className = 'dlv-tooltip'; // reset before measuring
      _tip.classList.add('dlv-tip-measuring');
      _tip.style.visibility = 'hidden';
      _tip.style.display = 'block';

      // measure then position
      requestAnimationFrame(() => {
        _position(anchor, opts.placement || 'auto');
        _tip.style.visibility = '';
        _tip.classList.remove('dlv-tip-measuring');
        _tip.classList.add('dlv-tip-visible');
        anchor.setAttribute('aria-describedby', 'dlv-tooltip');
      });
    }, delay);
  }

  /* ---------- hide ---------- */
  function _scheduleHide() {
    clearTimeout(_showTimer);
    _hideTimer = setTimeout(() => {
      if (_currentEl) _currentEl.removeAttribute('aria-describedby');
      if (_tip) {
        _tip.classList.remove('dlv-tip-visible');
        // wait for CSS transition, then display:none
        setTimeout(() => {
          if (_tip && !_tip.classList.contains('dlv-tip-visible')) {
            _tip.style.display = 'none';
          }
        }, 160);
      }
      _currentEl = null;
    }, HIDE_DELAY);
  }

  /* ---------- attach events to an element ---------- */
  function attach(el, html, opts = {}) {
    if (!el) return;
    // avoid double-binding
    if (el._dlvTipBound) {
      el._dlvTipHtml = html;
      el._dlvTipOpts = opts;
      return;
    }
    el._dlvTipHtml = html;
    el._dlvTipOpts = opts;
    el._dlvTipBound = true;

    el.addEventListener('mouseenter', () => {
      _currentEl = el;
      _show(el, el._dlvTipHtml, el._dlvTipOpts);
    });
    el.addEventListener('mouseleave', () => {
      if (_currentEl === el) _scheduleHide();
    });
    el.addEventListener('focus', () => {
      _currentEl = el;
      _show(el, el._dlvTipHtml, { ...(el._dlvTipOpts), delay: 0 });
    });
    el.addEventListener('blur', () => {
      if (_currentEl === el) _scheduleHide();
    });
  }

  /* ---------- convenience shorthands ---------- */
  function attachTree(el, html, opts = {})   { attach(el, html, { placement: 'right', ...opts }); }
  function attachWidget(el, html, opts = {}) { attach(el, html, { placement: 'top',   ...opts }); }
  function attachButton(el, html, opts = {}) { attach(el, html, { placement: 'bottom',...opts }); }

  /* ---------- scan DOM for data-dlv-tip attributes ---------- */
  function scanDOM(root = document) {
    root.querySelectorAll('[data-dlv-tip]').forEach(el => {
      if (el._dlvTipBound) return;
      const html = el.getAttribute('data-dlv-tip');
      const placement = el.getAttribute('data-dlv-tip-placement') || 'auto';
      const theme     = el.getAttribute('data-dlv-tip-theme')     || '';
      const maxWidth  = el.getAttribute('data-dlv-tip-maxwidth')  || '';
      attach(el, html, { placement, theme, maxWidth: maxWidth || undefined });
    });
  }

  /* ---------- update content for an already-attached element ---------- */
  function update(el, html, opts) {
    if (!el) return;
    el._dlvTipHtml = html;
    if (opts) el._dlvTipOpts = { ...el._dlvTipOpts, ...opts };
  }

  /* ---------- detach ---------- */
  function detach(el) {
    if (!el || !el._dlvTipBound) return;
    // Replace element with a shallow clone to drop all listeners
    const clone = el.cloneNode(true);
    el.parentNode?.replaceChild(clone, el);
    clone._dlvTipBound = false;
  }

  /* ---------- hide immediately ---------- */
  function hide() {
    clearTimeout(_showTimer);
    clearTimeout(_hideTimer);
    if (_currentEl) _currentEl.removeAttribute('aria-describedby');
    if (_tip) {
      _tip.classList.remove('dlv-tip-visible');
      _tip.style.display = 'none';
    }
    _currentEl = null;
  }

  /* ---------- auto-scan on DOMContentLoaded + MutationObserver ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scanDOM());
  } else {
    scanDOM();
  }

  // Watch for new nodes added dynamically
  new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.hasAttribute?.('data-dlv-tip')) scanDOM(node.parentElement || document);
          else if (node.querySelector?.('[data-dlv-tip]')) scanDOM(node);
        }
      }
    }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  return { attach, attachTree, attachWidget, attachButton, scanDOM, update, detach, hide };
})();