/* ============================================================
This file is part of DataLaVista
09-qb-advanced.js: Advanced query builder - visual join graph, nodes, and options panel.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
Summary: Advanced query builder - visual join graph, nodes, and options panel.
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
      // ============================================================
      // QUERY BUILDER — ADVANCED MODE
      // ============================================================
      let advNodeCounter = 0;
      let draggingNode = null;
      let draggingOffset = { x: 0, y: 0 };
      let drawingJoin = null; // { fromNode, fromSide, startX, startY }
      let selectedNode = null;
      let selectedJoin = null;
      let _advOptsFieldsExpanded = false; // track expand/collapse of fields list in options panel

      function renderAdvancedQB() {
        const canvas = document.getElementById('qb-canvas');
        // Remove existing nodes (not SVG)
        canvas.querySelectorAll('.qb-table-node').forEach(n => n.remove());
        document.getElementById('qb-svg').innerHTML = '';

        for (const [id, nd] of Object.entries(state.advancedQB.nodes)) {
          createAdvNode(id, nd);
        }
        redrawJoins();
        setupClearButtonDrop();

        // Click on empty canvas background → deselect everything
        canvas._dlvClickHandler && canvas.removeEventListener('click', canvas._dlvClickHandler);
        canvas._dlvClickHandler = (e) => {
          if (e.target === canvas || e.target === document.getElementById('qb-svg')) {
            document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
            selectedNode = null;
            state.advancedQB.activeJoinIdx = -1;
            renderAdvOptionsPanel(null, null);
          }
        };
        canvas.addEventListener('click', canvas._dlvClickHandler);
      }

      // ── Wire the in-canvas trash as drag-drop target for AQB items ──────────
      function setupClearButtonDrop() {
        const trash = document.getElementById('adv-canvas-trash');
        if (!trash || trash._dlvDropReady) return;
        trash._dlvDropReady = true;

        const AQB_DROP_TYPES = new Set(['adv-node-trash','adv-field-pill','adv-join-trash',
                                         'adv-node-cond','adv-node-sort','adv-node-gb']);

        trash.addEventListener('dragover', e => {
          // Browsers block dataTransfer content during dragover — only .types is readable.
          // Accept any drag carrying our MIME type or text/plain (fallback).
          const types = e.dataTransfer && e.dataTransfer.types;
          if (types && (types.includes('application/x-datalavista') || types.includes('text/plain'))) {
            e.preventDefault();
            trash.classList.add('drag-over');
          }
        });
        trash.addEventListener('dragleave', () => trash.classList.remove('drag-over'));
        trash.addEventListener('drop', e => {
          e.preventDefault();
          trash.classList.remove('drag-over');
          const data = safeDragParse(e);
          if (!data) return;

          const trashR = trash.getBoundingClientRect();
          const tx = trashR.left + trashR.width / 2;
          const ty = trashR.top  + trashR.height / 2;

          if (data.type === 'adv-node-trash') {
            const nodeId = data.nodeId;
            const nodeEl = document.getElementById('adv-' + nodeId);
            if (nodeEl) {
              const nr = nodeEl.getBoundingClientRect();
              shootLightning(tx, ty, nr.left + nr.width/2, nr.top + nr.height/2, () => {
                poofAndRemove(nodeEl, () => {
                  delete state.advancedQB.nodes[nodeId];
                  state.advancedQB.joins = state.advancedQB.joins.filter(j => j.fromNode !== nodeId && j.toNode !== nodeId);
                  redrawJoins(); rebuildAdvancedSQL(); renderAdvOptionsPanel(null, null);
                });
              });
            }
          } else if (data.type === 'adv-field-pill') {
            const { nodeId, field } = data;
            const pillEl = document.querySelector(`#adv-pills-${nodeId} [data-field="${field}"]`);
            if (pillEl) {
              const pr = pillEl.getBoundingClientRect();
              shootLightning(tx, ty, pr.left + pr.width/2, pr.top + pr.height/2, () => {
                poofPill(nodeId, field, () => { advNodeToggleField(nodeId, field); });
              });
            } else {
              poofPill(nodeId, field, () => { advNodeToggleField(nodeId, field); });
            }
          } else if (data.type === 'adv-join-trash') {
            const idx = data.idx;
            const doRemoveJoin = () => {
              if (idx != null && idx >= 0 && idx < state.advancedQB.joins.length) {
                state.advancedQB.joins.splice(idx, 1);
                if (state.advancedQB.activeJoinIdx === idx) state.advancedQB.activeJoinIdx = -1;
                redrawJoins(); rebuildAdvancedSQL(); renderAdvOptionsPanel(null, null);
              }
            };
            const badges = document.querySelectorAll('.join-venn-badge');
            const badgeEl = badges[idx];
            if (badgeEl) {
              const br = badgeEl.getBoundingClientRect();
              shootLightning(tx, ty, br.left + br.width/2, br.top + br.height/2, doRemoveJoin);
            } else {
              doRemoveJoin();
            }
          } else if (data.type === 'adv-node-cond') {
            const nd = state.advancedQB.nodes[data.nodeId];
            if (nd && nd.conditions) {
              nd.conditions.splice(data.idx, 1);
              rebuildAdvancedSQL();
              if (selectedNode === data.nodeId) renderAdvOptionsPanel('node', data.nodeId);
            }
          } else if (data.type === 'adv-node-sort') {
            const nd = state.advancedQB.nodes[data.nodeId];
            if (nd && nd.sorts) {
              nd.sorts.splice(data.idx, 1);
              rebuildAdvancedSQL();
              if (selectedNode === data.nodeId) renderAdvOptionsPanel('node', data.nodeId);
            }
          } else if (data.type === 'adv-node-gb') {
            const nd = state.advancedQB.nodes[data.nodeId];
            if (nd && nd.groupBy) {
              nd.groupBy.splice(data.idx, 1);
              rebuildAdvancedSQL();
              if (selectedNode === data.nodeId) renderAdvOptionsPanel('node', data.nodeId);
            }
          }
        });
      }

      function clearSQLEditor() {
        if (window._cmEditor) window._cmEditor.setValue('');
        state.sql = '';
        hideUseInDesign();
      }

      function onDropToAdvancedQB(event) {
        event.preventDefault();
        const data = safeDragParse(event);
        if (!data) return;

        const canvas = document.getElementById('qb-canvas');
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - 80;
        const y = event.clientY - rect.top - 40;

        if (data.type === 'table') {
          addAdvNode(data.table, x, y);
          return;
        }

        if (data.type === 'field') {
          // Check if dropped onto an existing node
          const targetNodeEl = event.target?.closest('.qb-table-node');
          if (targetNodeEl) {
            const nodeId = targetNodeEl.id.replace(/^adv-/, '');
            const nd = state.advancedQB.nodes[nodeId];
            // Only add if field belongs to this exact table
            if (nd && nd.tableName === data.table) {
              if (!nd.selectedFields.includes(data.field)) {
                nd.selectedFields.push(data.field);
                updateAdvNodePills(nodeId);
                rebuildAdvancedSQL();
                if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
              }
            }
            // Different table: do nothing (silent ignore)
            return;
          }
          // Drop on canvas background — add table with this field pre-selected
          addAdvNode(data.table, x, y, data.field);
        }
      }

      function addAdvNode(tableName, x, y, preselectedField) {
        const id = 'node_' + (++advNodeCounter);
        const t = state.tables[tableName];
        if (!t) return;

        let defaultFields = [];
        if (preselectedField) {
          // Caller specified which field to pre-select
          defaultFields = [preselectedField];
        } else {
          // Auto-select Title/Name fields — same logic as basic QB
          for (const f of t.fields) {
            if (f.isAutoId) continue;
            if (f.internalName === 'Title' ||
                (f.alias || '').toLowerCase() === 'name' ||
                (f.alias || '').toLowerCase().includes('fullname') ||
                (f.alias || '').toLowerCase() === 'uniqname') {
              defaultFields.push(f.alias);
            }
          }
          // Fallback: if nothing matched, select the first non-auto field
          if (!defaultFields.length) {
            const first = t.fields.find(f => !f.isAutoId);
            if (first) defaultFields.push(first.alias);
          }
        }

        state.advancedQB.nodes[id] = {
          tableName, x, y,
          selectedFields: defaultFields,
          alias: t.alias || tableName,
          conditions: [],
          sorts: [],
          groupBy: [],
          fieldAggs: {}
        };
        createAdvNode(id, state.advancedQB.nodes[id]);
        ensureTableData(tableName);
        rebuildAdvancedSQL();
        selectAdvNode(id);
      }

      function getAllFieldAliases(tableName) {
        const t = state.tables[tableName];
        if (!t) return [];
        return t.fields.filter(f => !f.isAutoId).map(f => f.alias);
      }

      function createAdvNode(id, nd) {
        const t = state.tables[nd.tableName];
        if (!t) return;
        const canvas = document.getElementById('qb-canvas');

        // Remove any existing element with this id (re-render case)
        document.getElementById('adv-' + id)?.remove();

        const el = document.createElement('div');
        el.className = 'qb-table-node';
        el.id = 'adv-' + id;
        el.style.cssText = `left:${nd.x}px;top:${nd.y}px;min-width:160px;max-width:280px`;

        const descHTML = t.description ? `<div class="qb-node-desc" title="${t.description.replace(/"/g,'&quot;')}">${t.description}</div>` : '';
        const rowCount = (t.itemCount || (t.data && t.data.length) || 0).toLocaleString();

        el.innerHTML = `
    <div class="qb-node-header">
      <span class="qb-node-join-icon" title="Drag to another table to create a join">🔗</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 4px">${nd.alias || nd.tableName}</span>
      <span class="qb-node-trash-icon" draggable="true" title="Drag to Clear button to remove">⠿</span>
      <button style="background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;padding:0 2px;font-size:13px;line-height:1" onclick="removeAdvNode('${id}')">✕</button>
    </div>
    <div class="qb-node-body">
      ${descHTML}
      <div class="qb-node-count" id="adv-count-${id}">${rowCount} rows</div>
      <div class="qb-node-pills" id="adv-pills-${id}"></div>
    </div>
    <div class="qb-node-resize tl"></div>
    <div class="qb-node-resize tr"></div>
    <div class="qb-node-resize bl"></div>
    <div class="qb-node-resize br"></div>
  `;

        canvas.appendChild(el);

        // Fill pills now that element is in DOM
        updateAdvNodePills(id);

        // Drag header to move node (ignore join/trash icons and buttons)
        el.querySelector('.qb-node-header').addEventListener('mousedown', e => {
          if (e.target.closest('.qb-node-join-icon') || e.target.closest('.qb-node-trash-icon') || e.target.closest('button')) return;
          startNodeDrag(e, id, el);
        });

        // Click node to select (ignore action elements)
        el.addEventListener('click', e => {
          if (!e.target.closest('.qb-node-join-icon') && !e.target.closest('.qb-node-trash-icon') &&
              !e.target.closest('button') && !e.target.closest('.qb-node-resize')) {
            selectAdvNode(id);
          }
        });

        // Join icon: mousedown → start drawing join to another node
        el.querySelector('.qb-node-join-icon').addEventListener('mousedown', e => {
          e.stopPropagation(); startJoinDrag(e, id);
        });

        // Trash icon: HTML5 drag → drop on clear button
        const trashHandle = el.querySelector('.qb-node-trash-icon');
        trashHandle.addEventListener('dragstart', e => {
          e.stopPropagation();
          safeDragSet(e, { type: 'adv-node-trash', nodeId: id });
          setTimeout(() => { el.style.opacity = '.45'; }, 0);
        });
        trashHandle.addEventListener('dragend', () => { el.style.opacity = '1'; });

        // Corner resize handles
        el.querySelectorAll('.qb-node-resize').forEach(rh => {
          const corner = Array.from(rh.classList).find(c => ['tl','tr','bl','br'].includes(c)) || 'br';
          rh.addEventListener('mousedown', e => { e.stopPropagation(); startNodeResize(e, id, el, corner); });
        });
      }

      function startNodeDrag(e, id, el) {
        e.preventDefault();
        const nd = state.advancedQB.nodes[id];
        const startX = e.clientX - nd.x;
        const startY = e.clientY - nd.y;

        const onMove = mv => {
          nd.x = mv.clientX - startX;
          nd.y = mv.clientY - startY;
          el.style.left = nd.x + 'px';
          el.style.top = nd.y + 'px';
          redrawJoins();
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      function toggleAdvField(nodeId, field, el) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const idx = nd.selectedFields.indexOf(field);
        if (idx >= 0) { nd.selectedFields.splice(idx, 1); el && el.classList.remove('selected'); }
        else { nd.selectedFields.push(field); el && el.classList.add('selected'); }
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
      }

      // ── Returns a short icon/label for an aggregate function ─────────────────
      function getAggIcon(agg) {
        const m = { COUNT:'🔢', COUNT_DISTINCT:'🔢*', SUM:'∑', AVG:'x̄', MEDIAN:'med', MIN:'↓', MAX:'↑', FIRST:'⟨', LAST:'⟩', STDEV:'σ', VAR:'σ²' };
        return m[agg] || '∑';
      }

      // ── Returns an inline SVG Venn diagram for the given join type ────────────
      let _vennIdCounter = 0;
      function getVennSVG(type, size) {
        size = size || 36;
        const uid = 'vcp' + (++_vennIdCounter);
        const r = size * 0.32, cx1 = size * 0.37, cx2 = size * 0.63, cy = size / 2;
        const cfgs = {
          'INNER':    { l:'none',                       r:'none',                       mid:'rgba(0,120,212,.75)' },
          'LEFT':     { l:'rgba(0,120,212,.45)',         r:'none',                       mid:'rgba(0,120,212,.75)' },
          'RIGHT':    { l:'none',                       r:'rgba(0,120,212,.45)',         mid:'rgba(0,120,212,.75)' },
          'CROSS':    { l:'rgba(0,120,212,.3)',          r:'rgba(0,120,212,.3)',          mid:'rgba(0,120,212,.55)' },
          'UNION':    { l:'rgba(0,120,212,.5)',          r:'rgba(0,120,212,.5)',          mid:'rgba(0,120,212,.25)' },
          'UNION ALL':{ l:'rgba(0,120,212,.5)',          r:'rgba(0,120,212,.5)',          mid:'rgba(0,120,212,.5)' }
        };
        const c = cfgs[type] || cfgs['INNER'];
        return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block">
          <defs><clipPath id="${uid}"><circle cx="${cx2}" cy="${cy}" r="${r}"/></clipPath></defs>
          <circle cx="${cx1}" cy="${cy}" r="${r}" fill="${c.l}" stroke="#0078d4" stroke-width="1.5"/>
          <circle cx="${cx2}" cy="${cy}" r="${r}" fill="${c.r}" stroke="#0078d4" stroke-width="1.5"/>
          <circle cx="${cx1}" cy="${cy}" r="${r}" fill="${c.mid}" clip-path="url(#${uid})" stroke="none"/>
        </svg>`;
      }

      // ── Poof-animate an element then remove it (calls callback after) ─────────
      function poofAndRemove(el, callback) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (!el) { callback && callback(); return; }
        el.classList.add('dlv-poof');
        el.addEventListener('animationend', () => { el.remove(); callback && callback(); }, { once: true });
      }

      // ── Poof a specific pill in a node then deselect that field ──────────────
      function poofPill(nodeId, field, callback) {
        const pillEl = document.querySelector(`#adv-pills-${nodeId} [data-field="${field}"]`);
        if (pillEl) {
          pillEl.classList.add('dlv-poof');
          pillEl.addEventListener('animationend', () => { pillEl.remove(); callback && callback(); }, { once: true });
        } else {
          callback && callback();
        }
      }

      // ── Lightning bolt from trash can to deleted element ─────────────────────
      function shootLightning(x1, y1, x2, y2, callback) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;overflow:visible';
        document.body.appendChild(svg);

        const segments = 10;
        const spread = Math.max(20, Math.hypot(x2-x1, y2-y1) * 0.15);

        const makeBolt = () => {
          let d = `M${x1},${y1}`;
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            d += ` L${x1+(x2-x1)*t+(Math.random()-.5)*spread*2},${y1+(y2-y1)*t+(Math.random()-.5)*spread*2}`;
          }
          return d + ` L${x2},${y2}`;
        };

        const layers = [
          { color:'rgba(60,140,255,0.3)',  width:18 },
          { color:'rgba(140,210,255,0.7)', width:6  },
          { color:'white',                 width:2  },
        ];
        const paths = layers.map(({ color, width }) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg','path');
          p.setAttribute('stroke', color);
          p.setAttribute('stroke-width', width);
          p.setAttribute('fill','none');
          p.setAttribute('stroke-linecap','round');
          svg.appendChild(p);
          return p;
        });

        const mkCircle = (cx, cy, r, fill) => {
          const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
          c.setAttribute('cx', cx); c.setAttribute('cy', cy);
          c.setAttribute('r', r);  c.setAttribute('fill', fill);
          svg.appendChild(c); return c;
        };
        mkCircle(x1, y1, 8, 'rgba(140,210,255,0.8)');
        mkCircle(x2, y2, 8, 'rgba(140,210,255,0.8)');

        let flickers = 0;
        const FLICKER_COUNT = 5;
        const flicker = () => {
          const d = makeBolt();
          paths.forEach(p => p.setAttribute('d', d));
          flickers++;
          if (flickers < FLICKER_COUNT) {
            setTimeout(flicker, 27);
          } else {
            svg.style.transition = 'opacity 90ms ease-out';
            svg.style.opacity = '0';
            setTimeout(() => { svg.remove(); callback && callback(); }, 100);
          }
        };
        flicker();
      }

      const MAX_NODE_PILLS = 10;

      // ── Rebuild the pills display for one node ────────────────────────────────
      function updateAdvNodePills(nodeId) {
        const nd = state.advancedQB.nodes[nodeId];
        const pillsEl = document.getElementById('adv-pills-' + nodeId);
        if (!nd || !pillsEl) return;
        const fieldAggs = nd.fieldAggs || {};

        if (!nd.selectedFields.length) {
          pillsEl.innerHTML = '<span style="font-size:10px;color:var(--text-disabled);font-style:italic">No fields — select in Options</span>';
          return;
        }

        const visible = nd.selectedFields.slice(0, MAX_NODE_PILLS);
        const extra   = nd.selectedFields.length - MAX_NODE_PILLS;

        let html = visible.map(f => {
          const agg = fieldAggs[f];
          const isAgg = agg && agg !== '';
          const label = isAgg ? `${f} (${getAggIcon(agg)})` : f;
          return `<span class="qb-node-pill${isAgg ? ' agg-pill' : ''}" data-field="${f}" draggable="true">${label
            }<span class="pill-x" data-node-id="${nodeId}" data-field="${f}">×</span></span>`;
        }).join('');

        if (extra > 0) {
          html += `<span class="qb-node-pill" style="background:var(--text-disabled);cursor:default"
            title="Do you really need this many fields?">+${extra}</span>`;
        }

        pillsEl.innerHTML = html;

        pillsEl.querySelectorAll('.qb-node-pill[data-field]').forEach(pill => {
          pill.addEventListener('dragstart', e => {
            e.stopPropagation();
            safeDragSet(e, { type: 'adv-field-pill', nodeId, field: pill.dataset.field });
          });
        });
        pillsEl.querySelectorAll('.pill-x').forEach(x => {
          x.addEventListener('click', e => {
            e.stopPropagation();
            advNodeToggleField(x.dataset.nodeId, x.dataset.field);
          });
        });
      }

      // ── Toggle a field's selected state on a node (pill-based) ───────────────
      function advNodeToggleField(nodeId, field) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const idx = nd.selectedFields.indexOf(field);
        if (idx >= 0) {
          nd.selectedFields.splice(idx, 1);
          if (nd.fieldAggs) delete nd.fieldAggs[field];
        } else {
          nd.selectedFields.push(field);
        }
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
      }

      // ── Set (or clear) an aggregate for a field on a node ────────────────────
      function setAdvNodeFieldAgg(nodeId, field, agg) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        if (!nd.fieldAggs) nd.fieldAggs = {};
        if (!agg) delete nd.fieldAggs[field]; else nd.fieldAggs[field] = agg;
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
      }

      // ── Show a small aggregate-picker popup near a button ────────────────────
      function showAdvAggPopup(nodeId, field, btn) {
        document.querySelectorAll('.adv-agg-popup').forEach(p => p.remove());
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = state.tables[nd.tableName];
        const fm = t ? t.fields.find(f => f.alias === field) : null;
        const aggs = aggsForType(fm ? fm.displayType : 'text');
        const current = (nd.fieldAggs || {})[field] || '';
        const popup = document.createElement('div');
        popup.className = 'adv-agg-popup';
        popup.innerHTML = aggs.map(a =>
          `<div class="agg-opt${a.val === current ? ' selected' : ''}"
            onclick="setAdvNodeFieldAgg('${nodeId}','${field}','${a.val}'); document.querySelectorAll('.adv-agg-popup').forEach(p=>p.remove())">${a.label}</div>`
        ).join('');
        document.body.appendChild(popup);
        const rect = btn.getBoundingClientRect();
        popup.style.top  = (rect.bottom + 2) + 'px';
        popup.style.left = Math.max(0, rect.left - popup.offsetWidth + rect.width) + 'px';
        setTimeout(() => {
          document.addEventListener('click', function close(e) {
            if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', close); }
          });
        }, 10);
      }

      // ── Start drawing a join line from a node's join icon ─────────────────────
      function startJoinDrag(e, nodeId) {
        e.preventDefault();
        const canvas = document.getElementById('qb-canvas');
        const crect  = canvas.getBoundingClientRect();
        const el = document.getElementById('adv-' + nodeId);
        if (!el) return;
        const nd = state.advancedQB.nodes[nodeId];
        const startX = nd.x + el.offsetWidth / 2;
        const startY = nd.y;
        drawingJoin = { fromNode: nodeId, fromSide: 'top', startX, startY };

        const tmpLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tmpLine.setAttribute('stroke', '#0078d4');
        tmpLine.setAttribute('stroke-width', '2');
        tmpLine.setAttribute('stroke-dasharray', '6 3');
        tmpLine.id = 'tmp-join-line';
        document.getElementById('qb-svg').appendChild(tmpLine);

        const onMove = mv => {
          const x2 = mv.clientX - crect.left, y2 = mv.clientY - crect.top;
          tmpLine.setAttribute('x1', startX); tmpLine.setAttribute('y1', startY);
          tmpLine.setAttribute('x2', x2);     tmpLine.setAttribute('y2', y2);
        };
        const onUp = mv => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          tmpLine.remove();
          const target = document.elementFromPoint(mv.clientX, mv.clientY);
          const targetNode = target?.closest('.qb-table-node');
          if (targetNode) {
            const toId = targetNode.id.replace(/^adv-/, '');
            if (toId && toId !== nodeId) addJoin(nodeId, 'right', toId, 'left');
          }
          drawingJoin = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      // ── Resize a node by dragging a corner handle ─────────────────────────────
      function startNodeResize(e, nodeId, el, corner) {
        e.preventDefault();
        const startMouseX = e.clientX;
        const startW = el.offsetWidth;
        const nd = state.advancedQB.nodes[nodeId];
        const startNdX = nd.x;

        const onMove = mv => {
          const dx = mv.clientX - startMouseX;
          let newW;
          if (corner === 'br' || corner === 'tr') {
            newW = Math.max(160, startW + dx);
          } else {
            newW = Math.max(160, startW - dx);
            nd.x = startNdX + (startW - newW);
            el.style.left = nd.x + 'px';
          }
          el.style.width = newW + 'px';
          el.style.minWidth = newW + 'px';
          el.style.maxWidth = newW + 'px';
          redrawJoins();
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      function removeAdvNode(id) {
        delete state.advancedQB.nodes[id];
        state.advancedQB.joins = state.advancedQB.joins.filter(j => j.fromNode !== id && j.toNode !== id);
        document.getElementById('adv-' + id)?.remove();
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel(null, null);
      }

      function selectAdvNode(id) {
        // No canvas selection highlight — the options panel shows which table is active
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        if (selectedNode !== id) _advOptsFieldsExpanded = false; // reset expand on new node
        selectedNode = id;
        state.advancedQB.activeJoinIdx = -1;
        renderAdvOptionsPanel('node', id);
      }

      function showNodeProps(nodeId) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = state.tables[nd.tableName];
        const props = document.getElementById('node-props');
        const el = document.getElementById('adv-' + nodeId);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const canvas = document.getElementById('qb-canvas');
        const crect = canvas.getBoundingClientRect();

        props.style.left = (rect.right - crect.left + 10) + 'px';
        props.style.top = Math.max(0, rect.top - crect.top) + 'px';
        document.getElementById('node-props-title').textContent = nd.alias || nd.tableName;

        const body = document.getElementById('node-props-body');
        body.innerHTML = `
    <div class="form-group">
      <label>Alias</label>
      <input type="text" class="form-input" style="height:28px" value="${nd.alias}" oninput="state.advancedQB.nodes['${nodeId}'].alias=this.value; rebuildAdvancedSQL()"/>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-disabled);text-transform:uppercase;margin-bottom:4px">Fields — click to toggle</div>
      ${t.fields.filter(f => !f.isAutoId).map(f => {
          const sel = nd.selectedFields.includes(f.alias);
          return `<div class="basic-field-row" onclick="toggleAdvFieldInProps('${nodeId}','${f.alias}',this)">
          <input type="checkbox" ${sel ? 'checked' : ''} onclick="event.stopPropagation();" onchange="toggleAdvFieldInProps('${nodeId}','${f.alias}',this.closest('.basic-field-row'))"/>
          <label>${f.alias}</label>
        </div>`;
        }).join('')}
    </div>
  `;
        props.classList.add('visible');
      }

      function toggleAdvFieldInProps(nodeId, field, rowEl) {
        // Delegate to advNodeToggleField which also refreshes pills + options panel
        advNodeToggleField(nodeId, field);
      }

      function closeNodeProps() { selectedNode = null; }

      // ============================================================
      // ADVANCED QB — RIGHT OPTIONS PANEL
      // ============================================================
      function renderAdvOptionsPanel(mode, id) {
        const body = document.getElementById('adv-options-body');
        const titleEl = document.getElementById('adv-opts-title-text');
        if (!body) return;

        const setTitle = t => { if (titleEl) titleEl.textContent = t; };

        // ── NO SELECTION: show row-count ──────────────────────────
        if (!mode || (!id && id !== 0)) {
          setTitle('Options');
          body.innerHTML = `
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">ROW COUNT (LIMIT)</div>
              <input type="number" class="form-input" style="height:28px;width:100%"
                min="1" max="100000" value="${state.advancedQB.rowLimit || 500}"
                oninput="state.advancedQB.rowLimit=parseInt(this.value)||500; rebuildAdvancedSQL()"/>
              <div style="font-size:11px;color:var(--text-disabled);margin-top:4px">Applies LIMIT to the full query.</div>
            </div>`;
          return;
        }

        // ── JOIN SELECTION ────────────────────────────────────────
        if (mode === 'join') {
          const j = state.advancedQB.joins[id];
          if (!j) return;
          const fromND = state.advancedQB.nodes[j.fromNode];
          const toND   = state.advancedQB.nodes[j.toNode];
          const fromT  = state.tables[fromND?.tableName];
          const toT    = state.tables[toND?.tableName];
          const fromAlias = fromND?.alias || fromND?.tableName || '';
          const toAlias   = toND?.alias   || toND?.tableName   || '';

          const JOIN_TYPES = [
            { val: 'INNER', label: 'Inner Join',    desc: 'ℹ️ Matching rows in both sides' },
            { val: 'LEFT',  label: 'Left Join',     desc: 'ℹ️ Everything on the left, only matching rows on the right' },
            { val: 'RIGHT', label: 'Right Join',    desc: 'ℹ️ Everything on the right, only matching rows on the left' },
            { val: 'CROSS', label: 'Cross Join',    desc: 'ℹ️ Combine tables, repeating all rows in 2nd table for every row in 1st table' },
            { val: 'UNION', label: 'Union',         desc: 'ℹ️ Combine tables, removing duplicate rows' },
            { val: 'UNION ALL', label: 'Union All', desc: 'ℹ️ Combine tables, keeping duplicate rows' }
          ];

          const fromFieldOpts = (fromT?.fields || []).filter(f => !f.isAutoId)
            .map(f => `<option value="${f.alias}" ${f.alias === j.fromKey ? 'selected' : ''}>${f.alias}</option>`).join('');
          const toFieldOpts = (toT?.fields || []).filter(f => !f.isAutoId)
            .map(f => `<option value="${f.alias}" ${f.alias === j.toKey ? 'selected' : ''}>${f.alias}</option>`).join('');

          setTitle('Join Options');
          body.innerHTML = `
            <div class="adv-join-grid">
              <div class="adv-join-col">
                <div class="adv-join-col-label">LEFT: ${fromAlias}</div>
                <div class="form-group">
                  <label>Alias</label>
                  <input type="text" class="form-input" style="height:26px" value="${fromAlias}"
                    oninput="if(state.advancedQB.nodes['${j.fromNode}']) { state.advancedQB.nodes['${j.fromNode}'].alias=this.value; rebuildAdvancedSQL(); }"/>
                </div>
                <div class="form-group">
                  <label>Key Field</label>
                  <select class="form-input" style="height:26px" onchange="setActiveJoinProp('fromKey',this.value)">
                    ${fromFieldOpts}
                  </select>
                </div>
              </div>
              <div class="adv-join-mid">
                <div style="font-size:18px;color:var(--text-disabled)">⇔</div>
              </div>
              <div class="adv-join-col">
                <div class="adv-join-col-label">RIGHT: ${toAlias}</div>
                <div class="form-group">
                  <label>Alias</label>
                  <input type="text" class="form-input" style="height:26px" value="${toAlias}"
                    oninput="if(state.advancedQB.nodes['${j.toNode}']) { state.advancedQB.nodes['${j.toNode}'].alias=this.value; rebuildAdvancedSQL(); }"/>
                </div>
                <div class="form-group">
                  <label>Key Field</label>
                  <select class="form-input" style="height:26px" onchange="setActiveJoinProp('toKey',this.value)">
                    ${toFieldOpts}
                  </select>
                </div>
              </div>
            </div>
            <div class="form-group" style="margin-top:10px">
              <label>Join Type</label>
              <select class="form-input" style="height:28px" id="adv-join-type-sel"
                onchange="setActiveJoinProp('type',this.value); renderAdvOptionsPanel('join',${id})">
                ${JOIN_TYPES.map(jt => `<option value="${jt.val}" ${jt.val === j.type ? 'selected' : ''}>${jt.label}</option>`).join('')}
              </select>
              <div style="font-size:11px;color:var(--text-disabled);margin-top:2px" id="join-type-desc">
                ${JOIN_TYPES.find(jt => jt.val === j.type)?.desc || ''}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;margin-top:10px;gap:4px">
              <div id="adv-join-venn">${getVennSVG(j.type, 72)}</div>
              <div style="font-size:11px;color:var(--text-disabled)">${JOIN_TYPES.find(jt=>jt.val===j.type)?.label||j.type}</div>
            </div>
            <button class="btn btn-danger btn-sm" style="margin-top:8px;width:100%" onclick="removeActiveJoin()">✕ Remove Join</button>`;
          return;
        }

        // ── NODE (TABLE) SELECTION ────────────────────────────────
        if (mode === 'node') {
          const nd = state.advancedQB.nodes[id];
          if (!nd) return;
          const t = state.tables[nd.tableName];
          if (!t) return;
          const fields = t.fields.filter(f => !f.isAutoId);

          // Ensure state arrays / maps exist on older nodes
          if (!nd.conditions) nd.conditions = [];
          if (!nd.sorts)      nd.sorts = [];
          if (!nd.groupBy)    nd.groupBy = [];
          if (!nd.fieldAggs)  nd.fieldAggs = {};

          // ── FIELDS section ───────────────────────────────────────
          const FIELDS_COLLAPSED_COUNT = 5;
          const renderFieldRow = f => {
            const ti  = FIELD_TYPE_ICONS[f.displayType] || FIELD_TYPE_ICONS.default;
            const sel = nd.selectedFields.includes(f.alias);
            const agg = nd.fieldAggs[f.alias] || '';
            const aggActive = agg !== '';
            return `<div class="adv-field-row${sel ? ' selected' : ''}"
                onclick="advNodeToggleField('${id}','${f.alias}')" draggable="true"
                ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-field-pill',nodeId:'${id}',field:'${f.alias}'})">
              <input type="checkbox" ${sel ? 'checked' : ''}/>
              <span class="field-type-icon ${ti.cls}">${ti.icon}</span>
              <span class="field-name">${f.alias}</span>
              <button class="adv-agg-btn${aggActive ? ' has-agg' : ''}"
                title="${aggActive ? agg : 'No aggregate'}"
                onclick="event.stopPropagation();showAdvAggPopup('${id}','${f.alias}',this)">${aggActive ? getAggIcon(agg) : '∑'}</button>
            </div>`;
          };
          const renderFieldsSection = () => {
            const visible = _advOptsFieldsExpanded ? fields : fields.slice(0, FIELDS_COLLAPSED_COUNT);
            const extra   = fields.length - FIELDS_COLLAPSED_COUNT;
            let html = visible.map(renderFieldRow).join('');
            if (fields.length > FIELDS_COLLAPSED_COUNT) {
              if (_advOptsFieldsExpanded) {
                html += `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px;font-size:10px"
                  onclick="_advOptsFieldsExpanded=false; renderAdvOptionsPanel('node','${id}')">▲ Show less</button>`;
              } else {
                html += `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px;font-size:10px"
                  onclick="_advOptsFieldsExpanded=true; renderAdvOptionsPanel('node','${id}')">▼ Show ${extra} more</button>`;
              }
            }
            return html;
          };

          // ── FILTER CONDITIONS section ───────────────────────────
          const renderNodeConditions = () => {
            if (!nd.conditions.length)
              return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No filters — click + Add</div>';
            return nd.conditions.map((c, ci) => {
              const fieldMeta = fields.find(f => f.alias === c.field);
              const isDate = fieldMeta?.displayType === 'date';
              const ops = isDate ? [...QB_OPS, ...DATE_MACRO_OPS] : QB_OPS;
              const isMacro = DATE_MACRO_VALS.has(c.op);
              const macroMeta = DATE_MACRO_OPS.find(o => o.val === c.op);
              const needsValue = c.op !== 'NULL' && c.op !== 'NOTNULL' && !(isMacro && !macroMeta?.hasInput);
              return `<div class="qb-condition-row" draggable="true"
                  ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-node-cond',nodeId:'${id}',idx:${ci}})">
                ${ci === 0
                  ? `<span class="qb-where-badge">WHERE</span>`
                  : `<select class="form-input qb-conj-select" onchange="advNodeCond('${id}',${ci},'conj',this.value)">
                      <option ${c.conj==='AND'?'selected':''}>AND</option>
                      <option ${c.conj==='OR'?'selected':''}>OR</option></select>`}
                <select class="form-input qb-field-select" onchange="advNodeCond('${id}',${ci},'field',this.value)">
                  ${fields.map(f=>`<option value="${f.alias}" ${f.alias===c.field?'selected':''}>${f.alias}</option>`).join('')}
                </select>
                <select class="form-input qb-op-select" style="width:${isDate?'150px':'112px'}!important"
                  onchange="advNodeCond('${id}',${ci},'op',this.value)">
                  ${ops.map(o=>`<option value="${o.val}" ${o.val===c.op?'selected':''}>${o.label}</option>`).join('')}
                </select>
                ${needsValue
                  ? `<input type="${isMacro?'number':'text'}" class="form-input qb-val-input" value="${(c.value||'').replace(/"/g,'&quot;')}"
                       oninput="advNodeCond('${id}',${ci},'value',this.value)"/>`
                  : `<span class="qb-val-blank"></span>`}
                <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="advNodeRemoveCond('${id}',${ci})">✕</button>
              </div>`;
            }).join('');
          };

          // ── SORT section ────────────────────────────────────────
          const renderNodeSorts = () => {
            if (!nd.sorts.length)
              return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No sorts — click + Add</div>';
            return nd.sorts.map((s, si) => `
              <div class="qb-sort-row" draggable="true"
                  ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-node-sort',nodeId:'${id}',idx:${si}})">
                <select class="form-input qb-field-select" onchange="advNodeSort('${id}',${si},'field',this.value)">
                  ${fields.map(f=>`<option value="${f.alias}" ${f.alias===s.field?'selected':''}>${f.alias}</option>`).join('')}
                </select>
                <select class="form-input qb-dir-select" onchange="advNodeSort('${id}',${si},'dir',this.value)">
                  <option ${s.dir==='ASC'?'selected':''}>ASC</option>
                  <option ${s.dir==='DESC'?'selected':''}>DESC</option>
                </select>
                <button class="btn btn-ghost btn-sm btn-icon" onclick="advNodeRemoveSort('${id}',${si})">✕</button>
              </div>`).join('');
          };

          // ── GROUP BY section ────────────────────────────────────
          const renderNodeGroupBy = () => {
            if (!nd.groupBy.length)
              return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No grouping — click + Add</div>';
            return nd.groupBy.map((g, gi) => `
              <div class="qb-sort-row" draggable="true"
                  ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-node-gb',nodeId:'${id}',idx:${gi}})">
                <select class="form-input qb-field-select" onchange="advNodeGB('${id}',${gi},this.value)">
                  ${fields.map(f=>`<option value="${f.alias}" ${f.alias===g?'selected':''}>${f.alias}</option>`).join('')}
                </select>
                <button class="btn btn-ghost btn-sm btn-icon" onclick="advNodeRemoveGB('${id}',${gi})">✕</button>
              </div>`).join('');
          };

          // ── Drop-zone handler factories ─────────────────────────
          const makeDZHandlers = (zone, dropAction) => {
            zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', e => {
              e.preventDefault(); zone.classList.remove('drag-over');
              const data = safeDragParse(e);
              if (!data) return;
              dropAction(data);
            });
          };

          // ── GROUP BY auto-lock when aggregates active ────────────
          const activeAggs = nd.selectedFields.filter(f => (nd.fieldAggs || {})[f]);
          const hasAggs    = activeAggs.length > 0;
          const nonAggFields = nd.selectedFields.filter(f => !(nd.fieldAggs || {})[f]);
          const gbAutoHTML = hasAggs
            ? (nonAggFields.length
                ? `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${nonAggFields.join(', ')}</div>`
                : `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All fields aggregated — no GROUP BY needed</div>`)
            : null;

          setTitle(nd.alias || nd.tableName);
          body.innerHTML = `
            <div class="adv-node-section">
              <div class="adv-node-section-hdr"><span>FIELDS</span></div>
              <div id="adv-node-fields">${renderFieldsSection()}</div>
            </div>
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">
                <span>FILTER CONDITIONS</span>
                <button class="btn btn-ghost btn-sm" onclick="advNodeAddCond('${id}')">+ Add</button>
              </div>
              <div id="adv-node-conds" class="adv-drop-zone">${renderNodeConditions()}</div>
            </div>
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">
                <span>SORT ORDER</span>
                <button class="btn btn-ghost btn-sm" onclick="advNodeAddSort('${id}')">+ Add</button>
              </div>
              <div id="adv-node-sorts" class="adv-drop-zone">${renderNodeSorts()}</div>
            </div>
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">
                <span>${hasAggs ? 'GROUP BY (auto)' : 'GROUP BY'}</span>
                ${hasAggs ? '' : `<button class="btn btn-ghost btn-sm" onclick="advNodeAddGB('${id}')">+ Add</button>`}
              </div>
              <div id="adv-node-groupby" class="adv-drop-zone">${hasAggs ? gbAutoHTML : renderNodeGroupBy()}</div>
            </div>`;

          // Wire drop zones to accept field pills / field rows dropped onto them
          const condZone  = body.querySelector('#adv-node-conds');
          const sortZone  = body.querySelector('#adv-node-sorts');
          const groupZone = body.querySelector('#adv-node-groupby');

          makeDZHandlers(condZone, data => {
            if (data.type === 'adv-field-pill' || data.type === 'adv-field-row') {
              const fAlias = data.field;
              if (!nd.conditions) nd.conditions = [];
              nd.conditions.push({ conj:'AND', field: fAlias, op:'=', value:'' });
              rebuildAdvancedSQL(); renderAdvOptionsPanel('node', id);
            }
          });
          makeDZHandlers(sortZone, data => {
            if (data.type === 'adv-field-pill' || data.type === 'adv-field-row') {
              if (!nd.sorts) nd.sorts = [];
              nd.sorts.push({ field: data.field, dir:'ASC' });
              rebuildAdvancedSQL(); renderAdvOptionsPanel('node', id);
            }
          });
          makeDZHandlers(groupZone, data => {
            if (data.type === 'adv-field-pill' || data.type === 'adv-field-row') {
              if (!nd.groupBy) nd.groupBy = [];
              nd.groupBy.push(data.field);
              rebuildAdvancedSQL(); renderAdvOptionsPanel('node', id);
            }
          });
        }
      }

      // ── Helpers for per-node conditions / sorts / groupby ─────────────────────────
      function advNodeCond(nodeId, idx, prop, val) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd || !nd.conditions[idx]) return;
        nd.conditions[idx][prop] = val;
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeAddCond(nodeId) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = state.tables[nd.tableName];
        const fields = t ? t.fields.filter(f => !f.isAutoId) : [];
        if (!nd.conditions) nd.conditions = [];
        nd.conditions.push({ conj: 'AND', field: fields[0]?.alias || '', op: '=', value: '' });
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeRemoveCond(nodeId, idx) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.conditions.splice(idx, 1);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeSort(nodeId, idx, prop, val) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd || !nd.sorts[idx]) return;
        nd.sorts[idx][prop] = val;
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeAddSort(nodeId) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = state.tables[nd.tableName];
        const fields = t ? t.fields.filter(f => !f.isAutoId) : [];
        if (!nd.sorts) nd.sorts = [];
        nd.sorts.push({ field: fields[0]?.alias || '', dir: 'ASC' });
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeRemoveSort(nodeId, idx) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.sorts.splice(idx, 1);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeGB(nodeId, idx, val) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.groupBy[idx] = val;
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeAddGB(nodeId) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = state.tables[nd.tableName];
        const fields = t ? t.fields.filter(f => !f.isAutoId) : [];
        if (!nd.groupBy) nd.groupBy = [];
        nd.groupBy.push(fields[0]?.alias || '');
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeRemoveGB(nodeId, idx) {
        const nd = state.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.groupBy.splice(idx, 1);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }

      // Draw join line
      function startDrawJoin(e, nodeId, side) {
        e.preventDefault();
        const canvas = document.getElementById('qb-canvas');
        const crect = canvas.getBoundingClientRect();
        drawingJoin = { fromNode: nodeId, fromSide: side, startX: e.clientX - crect.left, startY: e.clientY - crect.top };

        const tmpLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tmpLine.setAttribute('stroke', '#0078d4');
        tmpLine.setAttribute('stroke-width', '2');
        tmpLine.setAttribute('stroke-dasharray', '4');
        tmpLine.id = 'tmp-join-line';
        document.getElementById('qb-svg').appendChild(tmpLine);

        const onMove = mv => {
          const x2 = mv.clientX - crect.left, y2 = mv.clientY - crect.top;
          tmpLine.setAttribute('x1', drawingJoin.startX); tmpLine.setAttribute('y1', drawingJoin.startY);
          tmpLine.setAttribute('x2', x2); tmpLine.setAttribute('y2', y2);
        };
        const onUp = mv => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          tmpLine.remove();
          // Find target snap point
          const target = document.elementFromPoint(mv.clientX, mv.clientY);
          if (target && target.classList.contains('snap-point')) {
            const toNode = target.dataset.node;
            const toSide = target.dataset.side;
            if (toNode && toNode !== drawingJoin.fromNode) {
              addJoin(drawingJoin.fromNode, drawingJoin.fromSide, toNode, toSide);
            }
          }
          drawingJoin = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      function addJoin(fromNode, fromSide, toNode, toSide) {
        const fromT = state.tables[state.advancedQB.nodes[fromNode]?.tableName];
        const toT = state.tables[state.advancedQB.nodes[toNode]?.tableName];
        if (!fromT || !toT) return;

        // Smart key detection
        let fromKey = 'ID', toKey = 'ID';
        // Check if toT has a field like fromTName + Id
        const fromAlias = state.advancedQB.nodes[fromNode]?.alias || state.advancedQB.nodes[fromNode]?.tableName;
        const toAlias = state.advancedQB.nodes[toNode]?.alias || state.advancedQB.nodes[toNode]?.tableName;
        for (const f of toT.fields) {
          if (f.alias.toLowerCase() === fromAlias.toLowerCase() + 'id' || f.alias.toLowerCase() === fromAlias.toLowerCase().replace(/s$/, '') + 'id') {
            toKey = f.alias; fromKey = 'ID'; break;
          }
        }
        for (const f of fromT.fields) {
          if (f.alias.toLowerCase() === toAlias.toLowerCase() + 'id' || f.alias.toLowerCase() === toAlias.toLowerCase().replace(/s$/, '') + 'id') {
            fromKey = f.alias; toKey = 'ID'; break;
          }
        }

        state.advancedQB.joins.push({ fromNode, fromSide, toNode, toSide, fromKey, toKey, type: 'LEFT' });
        redrawJoins();
        rebuildAdvancedSQL();
        // Auto-select the new join to show its options panel
        const newIdx = state.advancedQB.joins.length - 1;
        state.advancedQB.activeJoinIdx = newIdx;
        selectedNode = null;
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        renderAdvOptionsPanel('join', newIdx);
      }

      function getSnapPoint(nodeId, side) {
        const el = document.getElementById('adv-' + nodeId);
        if (!el) return { x: 0, y: 0 };
        const nd = state.advancedQB.nodes[nodeId];
        const r = el.getBoundingClientRect();
        const canvas = document.getElementById('qb-canvas');
        const cr = canvas.getBoundingClientRect();
        const x = nd.x + (side === 'left' ? 0 : side === 'right' ? el.offsetWidth : el.offsetWidth / 2);
        const y = nd.y + (side === 'top' ? 0 : side === 'bottom' ? el.offsetHeight : el.offsetHeight / 2);
        return { x, y };
      }

      function redrawJoins() {
        const svg = document.getElementById('qb-svg');
        svg.innerHTML = '';

        // Arrowhead marker (must be first)
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#0078d4"/>
  </marker>`;
        svg.appendChild(defs);

        for (let ji = 0; ji < state.advancedQB.joins.length; ji++) {
          const j = state.advancedQB.joins[ji];
          const from = getSnapPoint(j.fromNode, j.fromSide);
          const to   = getSnapPoint(j.toNode,   j.toSide);
          const dx   = (to.x - from.x) * 0.5;
          const d    = `M${from.x},${from.y} C${from.x+dx},${from.y} ${to.x-dx},${to.y} ${to.x},${to.y}`;

          // Invisible wide hit path
          const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hitPath.setAttribute('d', d);
          hitPath.setAttribute('stroke', 'transparent');
          hitPath.setAttribute('stroke-width', '12');
          hitPath.setAttribute('fill', 'none');
          hitPath.style.cursor = 'pointer';
          hitPath.style.pointerEvents = 'stroke';
          hitPath.addEventListener('click', e => { e.stopPropagation(); selectJoin(j, from, to); });
          svg.appendChild(hitPath);

          // Visible path
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', d);
          path.setAttribute('stroke', '#0078d4');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          path.setAttribute('marker-end', 'url(#arrowhead)');
          path.classList.add('join-line');
          path.style.cursor = 'pointer';
          path.style.pointerEvents = 'stroke';
          path.addEventListener('click', e => { e.stopPropagation(); selectJoin(j, from, to); });
          svg.appendChild(path);

          // Venn badge at midpoint via foreignObject (allows HTML drag events)
          const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
          const badgeW = 44, badgeH = 44;
          const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
          fo.setAttribute('x', mx - badgeW / 2);
          fo.setAttribute('y', my - badgeH / 2);
          fo.setAttribute('width', badgeW);
          fo.setAttribute('height', badgeH);
          fo.style.pointerEvents = 'all';
          fo.style.overflow = 'visible';

          const badge = document.createElement('div');
          badge.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
          badge.className = 'join-venn-badge';
          badge.draggable = true;
          badge.title = 'Drag to Clear to remove join • Click to edit';
          badge.innerHTML = getVennSVG(j.type, 32) + `<span class="join-venn-label">${j.type}</span>`;

          const jCapture = j;
          badge.addEventListener('click', e => { e.stopPropagation(); selectJoin(jCapture, from, to); });
          badge.addEventListener('dragstart', e => {
            e.stopPropagation();
            safeDragSet(e, { type: 'adv-join-trash', idx: ji });
          });
          fo.appendChild(badge);
          svg.appendChild(fo);
        }
      }

      function selectJoin(joinObj, from, to) {
        // Store reference by index so inline handlers can reach it safely
        const joinIdx = state.advancedQB.joins.indexOf(joinObj);
        if (joinIdx < 0) return;
        state.advancedQB.activeJoinIdx = joinIdx;
        selectedNode = null;
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        renderAdvOptionsPanel('join', joinIdx);
      }

      /** Called by inline onchange handlers inside the join props popup */
      function setActiveJoinProp(prop, value) {
        const idx = state.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        const j = state.advancedQB.joins[idx];
        if (!j) return;
        j[prop] = value;
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('join', idx);
      }

      /** Called by the Remove Join button inside the join props popup */
      function removeActiveJoin() {
        const idx = state.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        state.advancedQB.joins.splice(idx, 1);
        state.advancedQB.activeJoinIdx = -1;
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel(null, null);
      }

      // ── Enable / disable the Design › Preview › Generate toolbar buttons ──────
      function setDesignTabsEnabled(enabled, reason) {
        const ids = ['toolbar-button-design', 'toolbar-button-preview', 'toolbar-button-generate'];
        ids.forEach(id => {
          const btn = document.getElementById(id);
          if (!btn) return;
          btn.disabled = !enabled;
          btn.title = enabled ? '' : (reason || 'Disabled');
          btn.style.opacity = enabled ? '' : '.4';
          btn.style.pointerEvents = enabled ? '' : 'none';
        });
      }

      function rebuildAdvancedSQL() {
        if (state.sqlLocked) return;
        const nodes = Object.entries(state.advancedQB.nodes);
        if (!nodes.length) { if (window._cmEditor) window._cmEditor.setValue(''); return; }

        const joins = state.advancedQB.joins;
        const multiNode = nodes.length > 1;

        // ── Multiple tables (with or without joins) → disable Design/Preview/Generate ──
        if (multiNode) {
          setDesignTabsEnabled(false, 'Run the query first to use results in Design, Preview, and Generate');
        } else {
          setDesignTabsEnabled(true);
        }

        // Helper: field alias → internalName for SQL column refs
        const getInternal = (tableName, fieldAlias) => {
          const t = state.tables[tableName];
          if (!t) return fieldAlias;
          const f = t.fields.find(f => f.alias === fieldAlias);
          return f ? (f.internalName || fieldAlias) : fieldAlias;
        };

        const [mainId, mainNd] = nodes[0];
        const mainKey = mainNd.tableName;

        // Collect SELECT fields, detect duplicate output aliases, apply per-field aggregates
        const allFields = [];
        for (const [id, nd] of nodes) {
          const fieldAggs = nd.fieldAggs || {};
          for (const fa of nd.selectedFields) {
            allFields.push({ tkey: nd.tableName, fa, iname: getInternal(nd.tableName, fa), agg: fieldAggs[fa] || '' });
          }
        }
        const seenAliases = {};
        const selects = allFields.length ? allFields.map(({ tkey, fa, iname, agg }) => {
          const count = seenAliases[fa] = (seenAliases[fa] || 0) + 1;
          const outAlias = count === 1 ? fa : fa + (count - 1);
          if (agg === 'COUNT_DISTINCT') return `  COUNT(DISTINCT [${tkey}].[${iname}]) AS [${outAlias}]`;
          if (agg)                      return `  ${agg}([${tkey}].[${iname}]) AS [${outAlias}]`;
          return `  [${tkey}].[${iname}] AS [${outAlias}]`;
        }) : ['  *'];

        // Auto GROUP BY: if any field has an agg, non-agg fields need to be in GROUP BY
        const hasAnyAgg = allFields.some(f => f.agg);
        if (hasAnyAgg) {
          for (const [id, nd] of nodes) {
            if (!nd.groupBy) nd.groupBy = [];
            const fieldAggs = nd.fieldAggs || {};
            for (const fa of nd.selectedFields) {
              if (!fieldAggs[fa] && !nd.groupBy.includes(fa)) nd.groupBy.push(fa);
            }
          }
        }

        const hasUnion = joins.some(j => j.type === 'UNION' || j.type === 'UNION ALL');

        if (hasUnion) {
          const parts = [];
          for (const [id, nd] of nodes) {
            const nodeKey = nd.tableName;
            const fAggs = nd.fieldAggs || {};
            const nodeSelects = nd.selectedFields.length
              ? nd.selectedFields.map(fa => {
                  const iname = getInternal(nodeKey, fa);
                  const agg = fAggs[fa] || '';
                  if (agg === 'COUNT_DISTINCT') return `  COUNT(DISTINCT [${nodeKey}].[${iname}]) AS [${fa}]`;
                  if (agg)                      return `  ${agg}([${nodeKey}].[${iname}]) AS [${fa}]`;
                  return `  [${nodeKey}].[${iname}] AS [${fa}]`;
                }).join(',\n')
              : '  *';
            let part = `SELECT\n${nodeSelects}\nFROM [${nodeKey}]`;
            const where = buildNodeWhere(nd, nodeKey);
            if (where) part += `\nWHERE ${where}`;
            parts.push({ sql: part });
          }
          let sql = '';
          for (let i = 0; i < parts.length; i++) {
            if (i === 0) { sql = parts[0].sql; continue; }
            const j = joins.find(j => j.toNode === Object.keys(state.advancedQB.nodes)[i]);
            sql += `\n${j ? j.type : 'UNION'}\n` + parts[i].sql;
          }
          sql += `\nLIMIT ${state.advancedQB.rowLimit || 500}`;
          state.sql = sql; if (window._cmEditor) window._cmEditor.setValue(sql); return;
        }

        let sql = `SELECT\n${selects.join(',\n')}\nFROM [${mainKey}]`;

        for (const j of joins) {
          const fromNd = state.advancedQB.nodes[j.fromNode];
          const toNd   = state.advancedQB.nodes[j.toNode];
          if (!fromNd || !toNd) continue;
          const fromKey   = fromNd.tableName;
          const toKey     = toNd.tableName;
          const fromIname = getInternal(fromKey, j.fromKey);
          const toIname   = getInternal(toKey,   j.toKey);
          if (j.type === 'CROSS') {
            sql += `\nCROSS JOIN [${toKey}]`;
          } else {
            sql += `\n${j.type} JOIN [${toKey}] ON [${fromKey}].[${fromIname}] = [${toKey}].[${toIname}]`;
          }
        }

        const allWhere = [];
        for (const [id, nd] of nodes) {
          if (nd.conditions && nd.conditions.length) {
            const w = buildNodeWhere(nd, nd.tableName);
            if (w) allWhere.push(`(${w})`);
          }
        }
        if (allWhere.length) sql += `\nWHERE ${allWhere.join(' AND ')}`;

        const allGB = [];
        for (const [id, nd] of nodes) {
          if (nd.groupBy && nd.groupBy.length)
            nd.groupBy.forEach(g => allGB.push(`[${nd.tableName}].[${getInternal(nd.tableName, g)}]`));
        }
        if (allGB.length) sql += `\nGROUP BY ${allGB.join(', ')}`;

        const allOrder = [];
        for (const [id, nd] of nodes) {
          if (nd.sorts && nd.sorts.length)
            nd.sorts.forEach(s => allOrder.push(`[${nd.tableName}].[${getInternal(nd.tableName, s.field)}] ${s.dir || 'ASC'}`));
        }
        if (allOrder.length) sql += `\nORDER BY ${allOrder.join(', ')}`;

        sql += `\nLIMIT ${state.advancedQB.rowLimit || 500}`;
        state.sql = sql; if (window._cmEditor) window._cmEditor.setValue(sql); hideUseInDesign();
      }

      // buildNodeWhere: tableKey is passed as the table prefix; resolves field alias → internalName
      function buildNodeWhere(nd, tableKey) {
        if (!nd.conditions || !nd.conditions.length) return '';
        const t = tableKey ? state.tables[tableKey] : null;
        const getInternal = (alias) => {
          if (!t) return alias;
          const f = t.fields.find(f => f.alias === alias);
          return f ? (f.internalName || alias) : alias;
        };
        const prefix = tableKey ? `[${tableKey}].` : '';
        return nd.conditions.map((c, i) => {
          const conj = i === 0 ? '' : (c.conj + ' ');
          const col = `${prefix}[${getInternal(c.field)}]`;
          if (c.op === 'NULL')    return conj + `${col} IS NULL`;
          if (c.op === 'NOTNULL') return conj + `${col} IS NOT NULL`;
          if (DATE_MACRO_VALS.has(c.op)) return conj + dateMacroToSQL(c.op, c.value, col);
          if (c.op === 'LIKE') return conj + `${col} LIKE '%${c.value}%'`;
          const raw = c.value || '';
          const val = (raw !== '' && !isNaN(raw)) ? raw : `'${raw.replace(/'/g, "''")}'`;
          return conj + `${col} ${c.op} ${val}`;
        }).join(' ');
      }
      function clearQueryBuilder() {
        if(document.getElementById('qmt-sql').classList.contains('active')) {
          if (window._cmEditor) window._cmEditor.setValue('');
          state.sql = '';
          hideUseInDesign();
        } else {
          state.basicQB = { tableName: null, selectedFields: [], filters: [] };
          state.advancedQB = { nodes: {}, joins: [], activeJoinIdx: -1 };
          if (window._cmEditor) window._cmEditor.setValue('');
          state.sql = '';
          renderBasicQB();
          if (state.queryMode === 'advanced') renderAdvancedQB();
        }
      }

