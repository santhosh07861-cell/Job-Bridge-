(() => {
    const DATA_URL = 'data/manufacturing-jobs.json';
    const THEME_KEY = 'jb-theme';
    const PAGE_SIZE = 9;

    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));

    let state = {
      jobs: [],
      filtered: [],
      query: '',
      filters: { branch: new Set(), exp: new Set(), type: new Set(), workMode: new Set() },
      sort: 'latest',
      theme: localStorage.getItem(THEME_KEY) || 'dark',
      shown: PAGE_SIZE,
      saved: new Set(SavedJobs.get().filter(item => item.page === 'manufacturing').map(item => item.id))
    };

    function init() {
      applyTheme(state.theme);
      bindUI();
      loadData();

      if (window.SavedJobs) {
        window.SavedJobs.addListener((list) => {
          state.saved = new Set(list.filter(item => item.page === 'manufacturing').map(item => item.id));
          updateSavedCount();
        });
      }
    }

    function bindUI() {
      const form = $('#manu-search');
      const input = $('#manu-search-input');
      const loadMore = $('#manu-loadmore');
      const themeBtn = $('#theme-toggle') || $('#themeToggle');

      form?.addEventListener('submit', (e) => { e.preventDefault(); state.query = (input?.value||'').trim(); state.shown = PAGE_SIZE; applyFilters(); scrollToResults(); });
      input?.addEventListener('input', debounce((e) => { state.query = (e.target.value||'').trim(); state.shown = PAGE_SIZE; applyFilters(); }, 180));

      // sidebar filter events will be bound after we render the lists

      $('#manu-sort')?.addEventListener('change', (e) => { state.sort = e.target.value; state.shown = PAGE_SIZE; sortFiltered(); renderJobs(); });
      $('#manu-clear')?.addEventListener('click', (e) => { createRipple(e); clearAllFilters(); });
      $('#manu-clear-sidebar')?.addEventListener('click', (e) => { createRipple(e); clearAllFilters(); });
      loadMore?.addEventListener('click', (e) => { createRipple(e); state.shown += PAGE_SIZE; renderJobs(); });
      $('#manu-search button[type="submit"]')?.addEventListener('click', createRipple);
      $('#applyFiltersBtn')?.addEventListener('click', createRipple);

      // mobile filters drawer
      $('#openFiltersBtn')?.addEventListener('click', ()=>{ document.body.classList.add('drawer-open'); });
      $('#bottomFilters')?.addEventListener('click', ()=>{ document.body.classList.add('drawer-open'); });
      $('#sidebar-close')?.addEventListener('click', ()=>{ document.body.classList.remove('drawer-open'); });
      $('#applyFiltersBtn')?.addEventListener('click', ()=>{ document.body.classList.remove('drawer-open'); scrollToResults(); });

      // Click outside drawer to close it
      document.addEventListener('click', (e) => {
        if (document.body.classList.contains('drawer-open')) {
          const sidebar = $('#manu-sidebar');
          const openFiltersBtn = $('#openFiltersBtn');
          const bottomFilters = $('#bottomFilters');
          if (sidebar && !sidebar.contains(e.target) && 
              openFiltersBtn && !openFiltersBtn.contains(e.target) && 
              bottomFilters && !bottomFilters.contains(e.target)) {
            document.body.classList.remove('drawer-open');
          }
        }
      });

      // mobile menu
      const mobileBtn = $('#mobileMenuBtn');
      mobileBtn?.addEventListener('click', ()=>{
        const nav = $('#mainNav'); if(!nav) return; nav.classList.toggle('open');
      });

      // close mobile menu when a link is clicked
      $$('#mainNav .nav-link').forEach(a=> a.addEventListener('click', ()=>{ const nav = $('#mainNav'); if(nav && nav.classList.contains('open')) nav.classList.remove('open'); }));

      // clear search button
      $('#clearSearch')?.addEventListener('click', ()=>{ if($('#manu-search-input')) { $('#manu-search-input').value=''; state.query=''; state.shown = PAGE_SIZE; applyFilters(); } });

      // Bookmark and Saved Jobs listeners
      document.addEventListener('click', (e) => {
        const save = e.target.closest('.bookmark-button[data-save]');
        if (save) {
          e.preventDefault();
          toggleSave(save.dataset.save);
          return;
        }
      });

      $('#showSaved')?.addEventListener('click', openSaved);
      $('#bottomSaved')?.addEventListener('click', openSaved);
      $('#closeSaved')?.addEventListener('click', () => $('#savedDialog')?.close());
    }

    function toggleTheme(){ 
      state.theme = state.theme==='dark'?'light':'dark'; 
      applyTheme(state.theme); 
      localStorage.setItem(THEME_KEY, state.theme); 
      window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: state.theme } }));
    }
    function applyTheme(t){ 
      state.theme = t;
      document.documentElement.setAttribute('data-theme', t); 
      document.documentElement.dataset.theme = t;
      const btn = $('#theme-toggle') || $('#themeToggle'); 
      if(btn) { 
        btn.setAttribute('aria-pressed', String(t === 'dark')); 
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
      } 
    }

    window.addEventListener('themechanged', (e) => {
      applyTheme(e.detail.theme);
    });

    async function fetchWithCache(url, cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(`${cacheKey}_time`);
      const now = Date.now();
      const CACHE_VALID_DURATION = 300000; // 5 minutes

      if (cached && cachedTime && (now - Number(cachedTime) < CACHE_VALID_DURATION)) {
        try {
          return JSON.parse(cached);
        } catch (_) {
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}_time`, String(now));
        return data;
      } catch (error) {
        console.warn(`Fetch failed for ${url}, trying fallback cache`, error);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch (_) {}
        }
        throw error;
      }
    }

    async function loadData(){
      try{
          const j = await fetchWithCache(DATA_URL, 'jb-cache-manufacturing');
          state.jobs = (Array.isArray(j)?j:j.jobs||[]).map((job, idx) => normalize(job, idx));
          state.filtered = state.jobs.slice(); renderSidebarFilters(); renderHeroCategories(); sortFiltered(); renderJobs(); updateResultCount(); updateActiveFilters(); updateStats();
          syncBookmarkButtons(); updateSavedCount();
      }catch(err){ console.error('Failed to load manufacturing jobs', err); }
    }

    function normalize(it, index){ return Object.assign({ id: it.id || `${slug(it.company)}-${slug(it.title || '')}-${index}`, company: it.company||'Unknown', title: it.title||'', location: it.location||'Remote', experience: it.experience||'', qualification: it.qualification||'', skills: it.skills||[], logo: it.logo||'', postedDate: it.postedDate||'' }, it); }

    function applyFilters(){
      const q = (state.query||'').toLowerCase();
      state.filtered = state.jobs.filter(j => {
        // search query
        if(q){ const hay = [j.title, j.company, j.branch || '', (j.skills||[]).join(' ')].join(' ').toLowerCase(); if(!hay.includes(q)) return false; }

        // branch
        if(state.filters.branch.size){ const okB = Array.from(state.filters.branch).some(v=> v.toLowerCase() === (j.branch||'').toLowerCase()); if(!okB) return false; }
        // experience
        if(state.filters.exp.size){ const ok = Array.from(state.filters.exp).some(v=> v.toLowerCase() === (j.experience||'').toLowerCase()); if(!ok) return false; }
        // type
        if(state.filters.type.size){ const ok2 = Array.from(state.filters.type).some(v=> v.toLowerCase() === (j.type||'').toLowerCase()); if(!ok2) return false; }
        // workMode
        if(state.filters.workMode.size){ const ok3 = Array.from(state.filters.workMode).some(v=> v.toLowerCase() === (j.workMode||'').toLowerCase()); if(!ok3) return false; }
        // no skills filter (removed)

        return true;
      });
      sortFiltered(); state.shown = Math.min(state.shown, Math.max(PAGE_SIZE, state.filtered.length)); renderJobs(); updateResultCount(); updateActiveFilters(); updateStats(); }

    function clearAllFilters(){ state.query=''; if($('#manu-search-input')) $('#manu-search-input').value=''; state.filters = { branch: new Set(), exp: new Set(), type: new Set(), workMode: new Set() }; // remove checked boxes
      $$('#manu-sidebar input[type=checkbox]').forEach(i=>i.checked=false);
      // remove active classes on pills and hero categories
      $$('#manu-sidebar .pill.active').forEach(p=>p.classList.remove('active'));
      $$('#hero-categories .category-pill.active').forEach(p=>p.classList.remove('active'));
      state.shown = PAGE_SIZE; applyFilters(); updateActiveFilters(); document.body.classList.remove('drawer-open'); }

    function sortFiltered(){
      if(state.sort==='company'){
        state.filtered.sort((a,b)=> (a.company||'').localeCompare(b.company||''));
      } else if(state.sort==='latest'){
        state.filtered.sort((a,b)=> new Date(b.postedDate||0) - new Date(a.postedDate||0));
      } else if(state.sort==='oldest'){
        state.filtered.sort((a,b)=> new Date(a.postedDate||0) - new Date(b.postedDate||0));
      } else if(state.sort==='experience'){
        const expVal = (s)=>{
          if(!s) return 9999;
          const sl = s.toLowerCase(); if(sl.includes('fresher') || sl.includes('entry')) return 0;
          const m = s.match(/(\d+)(?:\s*-\s*(\d+))?/); if(m){ return parseInt(m[1],10) || 0; } return 9999;
        };
        state.filtered.sort((a,b)=> (expVal(a.experience) - expVal(b.experience)));
      } else if(state.sort==='relevance'){
        // compute relevance-sorted list
        state.filtered = sortByRelevance(state.filtered);
      }
    }

    // Enhanced relevance sort: score matches on query & selected filters
    function sortByRelevance(arr){
      const q = (state.query||'').toLowerCase();
      return arr.slice().map(j=>{
        let score = 0;
        if(q){ const hay = [j.title,j.company,j.branch,(j.skills||[]).join(' ')].join(' ').toLowerCase(); if(hay.includes(q)) score += 50; }
        // matches selected filter groups add score
        if(state.filters.branch.size && Array.from(state.filters.branch).some(v=> v.toLowerCase() === (j.branch||'').toLowerCase())) score += 12;
        if(state.filters.exp.size && Array.from(state.filters.exp).some(v=> v.toLowerCase() === (j.experience||'').toLowerCase())) score += 9;
        if(state.filters.type.size && Array.from(state.filters.type).some(v=> v.toLowerCase() === (j.type||'').toLowerCase())) score += 7;
        if(state.filters.workMode.size && Array.from(state.filters.workMode).some(v=> v.toLowerCase() === (j.workMode||'').toLowerCase())) score += 6;
        // skills filter removed
        // recentness
        const d = new Date(j.postedDate||0); const age = (Date.now()-d)/1000/60/60/24; if(!isNaN(age)) score += Math.max(0, 20 - Math.min(20, age/7));
        return { job:j, score };
      }).sort((a,b)=> b.score - a.score).map(x=>x.job);
    }

    function renderJobs(){
      const list = $('#manu-list'); if(!list) return;
      const items = state.filtered || [];
      if(!items || items.length === 0){
        list.innerHTML = `<div class="no-results"><h3>No Matching Jobs Found</h3><p>Try changing filters or search keywords.</p><button id="no-results-reset" class="button button-primary">Reset Filters</button></div>`;
        updateLoadMoreState(0, 0);
        // hook reset button
        const reset = $('#no-results-reset'); reset?.addEventListener('click', ()=>{ clearAllFilters(); });
        return;
      }
      const shown = items.slice(0, state.shown||PAGE_SIZE);
      list.innerHTML = shown.map(jobCard).join('');
      updateLoadMoreState(items.length, shown.length);
      // animate newly rendered cards
      Array.from(list.children).forEach((c, i)=>{
        c.style.animationDelay = (i*40)+'ms';
        c.classList.add('job-appear');
        c.querySelectorAll('.apply, .official').forEach(btn => {
          btn.addEventListener('click', createRipple);
        });
      });
    }

    // build sidebar filter lists from data
    function renderSidebarFilters(){
      // Use fixed option lists to ensure consistent filters
      const BRANCHES = ['Electrical','Mechanical','Production','Industrial','Automobile','Embedded'];
      const EXPS = ['Fresher','0-2 Years','1-3 Years','3-5 Years'];
      const TYPES = ['Full Time','Graduate Trainee'];
      const WORK = ['On-site','Hybrid'];

      const nodeFor = (id) => document.getElementById(id);
      const countFor = (prop, val) => state.jobs.filter(j=> ((j[prop]||'').toLowerCase() === (val||'').toLowerCase())).length;

      const renderFixedPills = (id, items, key, propName) => {
        const node = nodeFor(id); if(!node) return;
        node.innerHTML = items.map(v=>{
          const raw = encodeURIComponent(String(v));
          const count = countFor(propName, v) || 0;
          return `<button class="pill" data-filter="${key}" data-value="${raw}">${esc(v)} <span class="count">(${count})</span></button>`;
        }).join('');
        node.querySelectorAll('.pill').forEach(btn=> btn.addEventListener('click', ()=>{
          const f = btn.dataset.filter; const v = decodeURIComponent(btn.dataset.value||''); if(!f) return;
          if(state.filters[f].has(v)){
            state.filters[f].delete(v);
            btn.classList.remove('active');
            if (f === 'branch') {
              const hero = document.querySelector(`#hero-categories button[data-branch="${encodeURIComponent(v)}"]`);
              if (hero) hero.classList.remove('active');
            }
          } else {
            state.filters[f].add(v);
            btn.classList.add('active');
            if (f === 'branch') {
              const hero = document.querySelector(`#hero-categories button[data-branch="${encodeURIComponent(v)}"]`);
              if (hero) hero.classList.add('active');
            }
          }
          state.shown = PAGE_SIZE; applyFilters(); updateActiveFilters();
        }));
      };

      renderFixedPills('filter-branch-pills', BRANCHES, 'branch', 'branch');
      renderFixedPills('filter-exp-pills', EXPS, 'exp', 'experience');
      renderFixedPills('filter-type-pills', TYPES, 'type', 'type');
      renderFixedPills('filter-workmode-pills', WORK, 'workMode', 'workMode');
      // collapsible toggles
      $$('.collapsible .collapsible-toggle').forEach(btn=> btn.addEventListener('click', ()=>{
        const target = btn.dataset.target; const node = document.getElementById(target); if(!node) return; const open = node.getAttribute('aria-hidden') === 'false'; node.setAttribute('aria-hidden', String(!open)); btn.querySelector('.chev').textContent = open? '▾' : '▴';
      }));
      
    }

      // render hero category pills (popular branches)
      function renderHeroCategories(){
        const container = document.getElementById('hero-categories'); if(!container) return;
        const top = ['Electrical','Mechanical','Production','Industrial','Automobile','Embedded'];
          container.innerHTML = top.map(b=>`<button class="category-pill" data-branch="${encodeURIComponent(b)}">${esc(b)} <span>(${countBranch(b)})</span></button>`).join('');
              container.querySelectorAll('.category-pill').forEach(btn=> btn.addEventListener('click', (e)=> {
                const b = decodeURIComponent(e.currentTarget.dataset.branch||''); if(!b) return;
              if(state.filters.branch.has(b)){
                state.filters.branch.delete(b); e.currentTarget.classList.remove('active');
                // unmark side pill if present
                  const side = document.querySelector(`#filter-branch-pills button[data-value="${encodeURIComponent(b)}"]`); if(side) side.classList.remove('active');
              } else {
                state.filters.branch.add(b); e.currentTarget.classList.add('active'); const side = document.querySelector(`#filter-branch-pills button[data-value="${encodeURIComponent(b)}"]`); if(side) side.classList.add('active');
              }
              state.shown = PAGE_SIZE; applyFilters(); updateActiveFilters();
            }));
      }

      function updateActiveFilters(){
        const node = document.getElementById('manu-active-filters'); if(!node) return; const parts = [];
        Object.keys(state.filters).forEach(k=>{ state.filters[k].forEach(v=> parts.push({k,v})); });
        node.innerHTML = parts.map(p=>`<button class="filter-tag" data-key="${esc(p.k)}" data-val="${encodeURIComponent(p.v)}">${esc(p.v)} ✕</button>`).join('');
        // bind remove
        node.querySelectorAll('.filter-tag').forEach(b=> b.addEventListener('click',(e)=>{
          const k=b.dataset.key, v=decodeURIComponent(b.dataset.val||''); if(!k) return; state.filters[k].delete(v);
          // remove active state on side pills
          const side = document.querySelector(`#filter-${k.toLowerCase()}-pills button[data-value="${encodeURIComponent(v)}"]`);
          if(side) side.classList.remove('active');
          // also remove from hero categories if branch
          if(k==='branch'){
            const hero = document.querySelector(`#hero-categories button[data-branch="${encodeURIComponent(v)}"]`);
            if(hero) hero.classList.remove('active');
          }
          applyFilters(); updateActiveFilters();
        }));
      }

    function updateLoadMoreState(total, shown){
      const lm = $('#manu-loadmore');
      const end = $('#manu-end-message');
      if(!lm || !end) return;
      if(total === 0){
        lm.style.display = 'none';
        end.hidden = true;
        return;
      }
      const hasMore = total > shown;
      lm.style.display = hasMore ? 'inline-flex' : 'none';
      end.hidden = hasMore;
    }

    function countBranch(branch){ return state.jobs.filter(j=> (j.branch||'').toLowerCase() === branch.toLowerCase()).length; }

    function updateResultCount(){ const el = $('#manu-result-count'); if(!el) return; const n = state.filtered ? state.filtered.length : 0; el.textContent = String(n); }

    function updateStats(){
      // Total jobs
      const total = state.jobs.length || 0;
      const companies = Array.from(new Set(state.jobs.map(j=>j.company)));
      const totalCompanies = companies.length;
      const freshers = state.jobs.filter(j=> (j.experience||'').toLowerCase().includes('fresher') || (j.experience||'').includes('0-')).length;
      const interns = state.jobs.filter(j=> (j.type||'').toLowerCase().includes('intern')).length;
      const sj = $('#live-job-count'); if(sj) sj.textContent = String(total);
      const sc = $('#stat-companies'); if(sc) sc.textContent = String(totalCompanies);
      const sf = $('#stat-freshers'); if(sf) sf.textContent = String(freshers);
      const si = $('#stat-interns'); if(si) si.textContent = String(interns);
    }

    function jobCard(j){ 
      const logoSrc = logoToSrc(j.logo, j.company); 
      const skills = (j.skills||[]).slice(0,6).map(s=>`<span class="skill">${esc(s)}</span>`).join(' ');
      const isSaved = SavedJobs.has(j.id, 'manufacturing');
      const companyName = SavedJobs.getCompanyName(j.company);
      const name = `${companyName} - ${j.title}`;
      return `
      <article class="job-card">
        <button class="bookmark-button ${isSaved ? 'saved' : ''}" 
                type="button" 
                data-save="${j.id}" 
                data-page="manufacturing" 
                data-name="${esc(name)}"
                data-tooltip="${isSaved ? 'Saved' : 'Save'}"
                aria-label="${isSaved ? 'Remove from saved' : 'Save to saved'}">
          <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
        </button>
        <div class="logo"><img src="${escapeAttr(logoSrc)}" alt="${escapeAttr(j.company)} logo" onerror="this.onerror=null;this.src='${escapeAttr(logoFallbackDataUrl(j.company))}'"/></div>
        <div class="details">
          <p class="company-name">${highlight(j.company, state.query)}</p>
          <h3>${highlight(j.title, state.query)}</h3>
          <div class="job-facts">
            <span><strong>Experience</strong>${esc(j.experience)}</span>
            <span><strong>Qualification</strong>${esc(j.qualification)}</span>
          </div>
          <div class="skills">${skills}</div>
        </div>
        <div class="actions">
          <a class="apply" href="${escapeAttr(j.officialLink||'#')}" target="_blank" rel="noopener">Apply Now</a>
          <a class="official" href="${escapeAttr(j.officialLink||'#')}" target="_blank" rel="noopener">Official Careers</a>
        </div>
      </article>
    ` }

    function logoToSrc(logo, company){ if(!logo) return logoFallbackDataUrl(company); if(logo.includes('/')) return logo; if(logo.endsWith('.svg')) return `assets/logos/${logo}`; return `assets/logos/${logo}`; }

    function logoFallbackDataUrl(company){ const initials = (company||'?').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(); const bg = state.theme==='dark' ? '#092036' : '#eef6ff'; const fg = state.theme==='dark' ? '#7dd3fc' : '#0847a3'; const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial' font-size='96' fill='${fg}'>${initials}</text></svg>`; return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`; }

    /* helpers */
    function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; }
    function esc(s){ return (s||'').toString().replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }
    function highlight(text, query) {
      const escapedText = esc(text);
      if (!query || !query.trim()) return escapedText;
      const escapedQuery = esc(query.trim()).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
    function escapeAttr(s){ return esc(s); }

    function scrollToResults(){ const el = $('#manu-list'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }

    function toggleSave(id) {
      if (!window.SavedJobs) return;
      
      const j = state.jobs.find(item => item.id === id);
      if (!j) return;

      const jobData = {
        id: j.id,
        company: j.company,
        role: j.title,
        category: "Manufacturing",
        page: "manufacturing",
        qualification: j.qualification || "Diploma / BE / B.Tech",
        experience: j.experience || "Fresher",
        skills: j.skills || [],
        logo: j.logo || "",
        officialWebsite: j.officialLink || "#",
        applyLink: j.officialLink || "#",
        rawData: j
      };

      window.SavedJobs.toggle(jobData);
    }

    function syncBookmarkButtons() {
      $$('.bookmark-button').forEach(btn => {
        const id = btn.dataset.save;
        const page = btn.dataset.page;
        const isSaved = SavedJobs.has(id, page);
        btn.classList.toggle('saved', isSaved);
        btn.setAttribute('data-tooltip', isSaved ? 'Saved' : 'Save');
        btn.setAttribute('aria-label', isSaved ? 'Remove from saved' : 'Save to saved');
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        }
      });
    }

    function updateSavedCount() {
      const count = $('#savedCount');
      if (count) {
        count.textContent = String(SavedJobs.get().filter(item => item.page === 'manufacturing').length);
      }
    }

    function openSaved() {
      renderSaved();
      const dialog = $('#savedDialog');
      if (!dialog) return;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function renderSaved() {
      const container = $('#savedContent');
      if (!container) return;
      const list = SavedJobs.get();
      if (!list.length) {
        container.innerHTML = '<div class="saved-empty"><h2>Saved Jobs</h2><p>No saved jobs yet.</p></div>';
        return;
      }
      
      const itemsHtml = list.map(item => {
        if (item.page === 'manufacturing') {
          const job = state.jobs.find(j => j.id === item.id);
          const officialLink = job ? job.officialLink : '#';
          return `
            <article class="saved-item">
              <div>
                <b>${esc(item.name)}</b>
                <span class="verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified · Manufacturing</span>
              </div>
              <div>
                <a class="primary-btn" href="${escapeAttr(officialLink)}" target="_blank" rel="noopener">Apply Now</a>
                <button class="ghost-btn" type="button" data-save="${esc(item.id)}" data-page="manufacturing">Remove</button>
              </div>
            </article>
          `;
        } else {
          return `
            <article class="saved-item">
              <div>
                <b>${esc(item.name)}</b>
                <span class="verified-badge"><i class="fa-solid fa-briefcase" aria-hidden="true"></i> IT</span>
              </div>
              <div>
                <a class="primary-btn" href="private-it.html" rel="noopener">Go to IT Jobs</a>
                <button class="ghost-btn" type="button" data-save="${esc(item.id)}" data-page="private-it">Remove</button>
              </div>
            </article>
          `;
        }
      }).join('');
      
      container.innerHTML = `
        <h2>Saved Jobs</h2>
        <div class="saved-list">
          ${itemsHtml}
        </div>
      `;
      
      container.querySelectorAll('button[data-save]').forEach(btn => {
        btn.addEventListener('click', () => {
          const saveId = btn.dataset.save;
          const savePage = btn.dataset.page;
          SavedJobs.remove(saveId, savePage);
          
          if (savePage === 'manufacturing') {
            state.saved.delete(saveId);
            syncBookmarkButtons();
          }
          
          updateSavedCount();
          renderSaved();
          toast('Removed');
        });
      });
    }

    function toast(message) {
      const region = $('#toastRegion');
      if (!region) return;
      const toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.textContent = message;
      region.appendChild(toastEl);
      setTimeout(() => toastEl.remove(), 2400);
    }

    function slug(s) { 
      return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); 
    }

    function createRipple(event) {
      const btn = event.currentTarget;
      if (!btn) return;
      
      const style = window.getComputedStyle(btn);
      if (style.position !== 'relative' && style.position !== 'absolute') {
        btn.style.position = 'relative';
      }
      btn.style.overflow = 'hidden';

      const circle = document.createElement('span');
      const diameter = Math.max(btn.clientWidth, btn.clientHeight);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      const rect = btn.getBoundingClientRect();
      circle.style.left = `${event.clientX - rect.left - radius}px`;
      circle.style.top = `${event.clientY - rect.top - radius}px`;
      circle.className = 'ripple';

      const oldRipple = btn.querySelector('.ripple');
      if (oldRipple) oldRipple.remove();

      btn.appendChild(circle);
      circle.addEventListener('animationend', () => circle.remove());
    }

    document.addEventListener('DOMContentLoaded', init);
  })();
