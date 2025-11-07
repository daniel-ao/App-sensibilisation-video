/*
 * Database Browser UI Logic
 * Provides a modal to explore SQLite-backed data (sessions, users) with search + pagination.
 */

(function(){
  // Support two modes:
  // - Modal mode (inside index.html with #dbBrowserOverlay)
  // - Page mode (standalone donnees.html without overlay)
  const openBtn = document.getElementById('openDbBrowserButton');
  const overlay = document.getElementById('dbBrowserOverlay');
  const closeBtn = document.getElementById('dbBrowserCloseBtn');
  // Select tabs globally to work in both modal and standalone page
  const tabs = document.querySelectorAll('.db-tab');
  const searchInput = document.getElementById('dbSearchInput');
  const searchBtn = document.getElementById('dbSearchBtn');
  const exportBtn = document.getElementById('dbExportBtn');
  const clearBtn = document.getElementById('dbClearFiltersBtn');
  const startDateInput = document.getElementById('dbStartDate');
  const endDateInput = document.getElementById('dbEndDate');
  const resolutionSelect = document.getElementById('dbResolutionSelect');
  const detailPanel = document.getElementById('dbDetailPanel');
  const detailCloseBtn = document.getElementById('dbDetailCloseBtn');
  const detailContent = document.getElementById('dbDetailContent');
  const headEl = document.getElementById('dbResultsHead');
  const bodyEl = document.getElementById('dbResultsBody');
  const paginationEl = document.getElementById('dbPagination');
  const summaryCards = document.getElementById('dbSummaryCards');

  let currentTab = 'sessions';
  let currentQuery = '';
  let currentOffset = 0;
  let currentStartDate = '';
  let currentEndDate = '';
  let currentResolution = '';
  let sortBy = '';
  let sortDir = 'ASC';
  const pageSize = 25;

  function show() {
    if (!overlay) {
      // In page mode, nothing to show; ensure data is loaded
      fetchSummary();
      loadData();
      return;
    }
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    fetchSummary();
    loadData();
  }
  function hide() {
    if (!overlay) return; // No-op in page mode
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
  function switchTab(tab) {
    if (tab === currentTab) return;
    currentTab = tab;
    currentOffset = 0;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    loadData();
  }
  function fetchSummary() {
    fetch('/api/db/summary').then(r=>r.json()).then(data => {
      summaryCards.innerHTML = '';
      const ts = data.latestSession;
      const parsed = ts ? new Date(ts) : null;
      const niceTs = (parsed && !isNaN(parsed.getTime())) ? parsed.toLocaleString() : '—';
      const items = [
        { title: 'Database', value: data.database },
        { title: 'Tables', value: data.tables?.length || 0 },
        { title: 'Sessions', value: data.counts?.sessions || 0 },
        { title: 'Utilisateurs', value: data.counts?.users || 0 },
        { title: 'Dernière Session', value: niceTs }
      ];
      items.forEach(it => {
        const card = document.createElement('div');
        card.className = 'db-card';
        card.innerHTML = `<div class="db-card-title">${it.title}</div><div class="db-card-value">${it.value}</div>`;
        summaryCards.appendChild(card);
      });
    }).catch(err => console.error('Summary fetch error', err));
  }

  function loadData() {
    const endpoint = currentTab === 'sessions' ? '/api/db/sessions' : '/api/db/users';
    const paramsObj = {
      q: currentQuery,
      limit: pageSize,
      offset: currentOffset
    };
    if (currentTab === 'sessions') {
      if (currentStartDate) paramsObj.startDate = currentStartDate;
      if (currentEndDate) paramsObj.endDate = currentEndDate;
      if (currentResolution) paramsObj.resolution = currentResolution;
      if (sortBy) { paramsObj.sortBy = sortBy; paramsObj.sortDir = sortDir; }
    }
    const params = new URLSearchParams(paramsObj);
    fetch(`${endpoint}?${params.toString()}`)
      .then(r=>r.json())
      .then(renderTable)
      .catch(err => console.error('Data fetch error', err));
  }
  function renderTable(resp) {
    const rows = resp.rows || [];
    bodyEl.innerHTML = '';
    headEl.innerHTML = '';
    if (!rows.length) {
      headEl.innerHTML = '<tr><th>Aucune donnée</th></tr>';
      return;
    }
    const cols = Object.keys(rows[0]);
    const headerRow = document.createElement('tr');
    cols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c;
      if (currentTab === 'sessions') {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          if (sortBy === c) {
            sortDir = sortDir === 'ASC' ? 'DESC' : 'ASC';
          } else {
            sortBy = c;
            sortDir = 'ASC';
          }
          currentOffset = 0;
          loadData();
        });
        if (sortBy === c) {
          const arrow = sortDir === 'ASC' ? ' ▲' : ' ▼';
          th.textContent = c + arrow;
        }
      }
      headerRow.appendChild(th);
    });
    headEl.appendChild(headerRow);
    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join('');
      if (currentTab === 'sessions') {
        // Be resilient to different id column names
        const sessionId = r.id ?? r.rowid ?? r.session_id ?? r.sessionId;
        if (sessionId !== undefined && sessionId !== null) {
          tr.addEventListener('click', () => openDetail(sessionId));
        } else {
          // As a last resort, try to infer from first column if named like 'id'
          tr.addEventListener('click', () => {
            console.warn('No id field found on session row; cannot open detail', r);
          });
        }
      }
      frag.appendChild(tr);
    });
    bodyEl.appendChild(frag);
    renderPagination(resp.total || 0);
  }
  function renderPagination(total) {
    paginationEl.innerHTML = '';
    const page = Math.floor(currentOffset / pageSize) + 1;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.disabled = currentOffset === 0;
    prevBtn.onclick = () => { currentOffset = Math.max(0, currentOffset - pageSize); loadData(); };
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.disabled = currentOffset + pageSize >= total;
    nextBtn.onclick = () => { currentOffset += pageSize; loadData(); };
    const info = document.createElement('span');
    info.className = 'current-page';
    info.textContent = `Page ${page}/${totalPages}`;
    paginationEl.append(prevBtn, info, nextBtn);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fetchResolutions() {
    fetch('/api/db/resolutions').then(r=>r.json()).then(data => {
      if (!resolutionSelect) return;
      (data.resolutions || []).forEach(res => {
        const opt = document.createElement('option');
        opt.value = res; opt.textContent = res;
        resolutionSelect.appendChild(opt);
      });
    }).catch(err => console.error('Resolutions fetch error', err));
  }

  function openDetail(id) {
    if (!detailPanel) return;
    if (id === undefined || id === null || id === '') {
      console.warn('openDetail called without a valid id');
      detailContent.innerHTML = '<div class="kv"><div class="k">Erreur</div><div class="v">Identifiant de session manquant.</div></div>';
      detailPanel.classList.add('open');
      detailPanel.setAttribute('aria-hidden','false');
      return;
    }
    fetch(`/api/db/session/${id}`).then(r=>{
      if (!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(row => {
      detailContent.innerHTML = '';
      const kv = document.createElement('div');
      kv.className = 'kv';
      const safeRow = row || {};
      const entries = Object.keys(safeRow).length ? Object.entries(safeRow) : [['Info','Aucune donnée pour cette session.']];
      entries.forEach(([k,v]) => {
        const kEl = document.createElement('div'); kEl.className='k'; kEl.textContent = k;
        const vEl = document.createElement('div'); vEl.className='v'; vEl.textContent = v;
        kv.append(kEl, vEl);
      });
      detailContent.appendChild(kv);
      detailPanel.classList.add('open');
      detailPanel.setAttribute('aria-hidden','false');
      // Focus close button for accessibility & ensure click binding active
      const btn = document.getElementById('dbDetailCloseBtn');
      if (btn) btn.focus();
    }).catch(err => {
      console.error('Detail fetch error', err);
      detailContent.innerHTML = '<div class="kv"><div class="k">Erreur</div><div class="v">Impossible de charger le détail de la session.</div></div>';
      detailPanel.classList.add('open');
      detailPanel.setAttribute('aria-hidden','false');
    });
  }

  function closeDetail(ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    if (!detailPanel) return;
    detailPanel.classList.remove('open');
    detailPanel.setAttribute('aria-hidden','true');
    // Optional: after transition, ensure it's completely hidden for hit-testing
    const onEnd = () => {
      detailPanel.style.visibility = 'hidden';
      detailPanel.removeEventListener('transitionend', onEnd);
      // Reset visibility so next open works
      requestAnimationFrame(() => { detailPanel.style.visibility = ''; });
    };
    detailPanel.addEventListener('transitionend', onEnd);
  }

  function exportCSV() {
    const endpoint = currentTab === 'sessions' ? '/api/db/sessions' : '/api/db/users';
    const paramsObj = { q: currentQuery, limit: pageSize, offset: currentOffset };
    if (currentTab === 'sessions') {
      if (currentStartDate) paramsObj.startDate = currentStartDate;
      if (currentEndDate) paramsObj.endDate = currentEndDate;
      if (currentResolution) paramsObj.resolution = currentResolution;
      if (sortBy) { paramsObj.sortBy = sortBy; paramsObj.sortDir = sortDir; }
    }
    const params = new URLSearchParams(paramsObj);
    fetch(`${endpoint}?${params.toString()}`)
      .then(r=>r.json())
      .then(data => {
        const rows = data.rows || [];
        if (!rows.length) return alert('Pas de données à exporter');
        const cols = Object.keys(rows[0]);
        const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => escapeCsv(r[c])).join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${currentTab}_${new Date().toISOString().slice(0,19)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(err => console.error('Export CSV error', err));
  }

  function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[,"\n]/.test(s)) {
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  }

  function applyFilters() {
    currentQuery = searchInput.value.trim();
    currentStartDate = startDateInput.value;
    currentEndDate = endDateInput.value;
    currentResolution = resolutionSelect.value;
    currentOffset = 0;
    loadData();
  }

  function clearFilters() {
    searchInput.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    resolutionSelect.value = '';
    sortBy = '';
    sortDir = 'ASC';
    currentQuery = '';
    currentStartDate = '';
    currentEndDate = '';
    currentResolution = '';
    currentOffset = 0;
    loadData();
  }

  if (openBtn) openBtn.addEventListener('click', show);
  if (closeBtn) closeBtn.addEventListener('click', hide);
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
  tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  if (searchBtn) searchBtn.addEventListener('click', applyFilters);
  if (exportBtn) exportBtn.addEventListener('click', exportCSV);
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);
  if (detailCloseBtn) {
    // Primary close handler on the button itself
    detailCloseBtn.addEventListener('click', closeDetail, { capture: true });
    detailCloseBtn.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); closeDetail(e);} });
  }

  if (detailPanel) detailPanel.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#dbDetailCloseBtn');
    if (btn) return closeDetail(e);
  });
  // Global delegated fallback in capture phase to ensure nothing blocks the click
  document.addEventListener('click', (e) => {
    const btn = e.target && (e.target.id === 'dbDetailCloseBtn' || (e.target.closest && e.target.closest('#dbDetailCloseBtn')));
    if (btn) { e.preventDefault(); closeDetail(e); }
  }, true);
  // Close detail on Escape in both modes
  (overlay || document).addEventListener('keydown', e => { if (e.key === 'Escape') { closeDetail(); } });
  resolutionSelect && fetchResolutions();
  if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') { applyFilters(); }});
  if (startDateInput) startDateInput.addEventListener('change', applyFilters);
  if (endDateInput) endDateInput.addEventListener('change', applyFilters);
  if (resolutionSelect) resolutionSelect.addEventListener('change', applyFilters);

  // Auto-initialize only when used as a standalone page (detected by .page-db-container)
  if (!overlay && document.querySelector('.page-db-container')) {
    fetchSummary();
    loadData();
  }
})();
