import { getItJobs } from './jobs-db.js';

(() => {
  const PAGE_SIZE = 12;
  const COMPANY_PAGE_SIZE = 8;

  const EXPERIENCE_OPTIONS = ['Fresher', '0-2 Years', '1-3 Years', '2-5 Years', '5+ Years'];
  const ROLE_OPTIONS = [
    'Software Engineer',
    'Software Developer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Mobile Developer',
    'Embedded Engineer',
    'DevOps Engineer',
    'Cloud Engineer',
    'AI / ML Engineer',
    'Data Analyst',
    'Data Scientist',
    'Cyber Security Engineer',
    'QA Engineer',
    'UI / UX Designer',
    'Product Manager',
    'Business Analyst',
    'Network Engineer',
    'System Administrator'
  ];
  const TYPE_OPTIONS = ['Full Time', 'Internship', 'Contract'];
  const QUICK_SEARCHES = ['Google', 'Amazon', 'Microsoft', 'Infosys', 'TCS', 'Zoho', 'Adobe', 'Fresher'];

  const state = {
    entries: [],
    companies: [],
    filtered: [],
    query: '',
    visible: PAGE_SIZE,
    companyVisible: COMPANY_PAGE_SIZE,
    companiesRendered: false,
    saved: new Set(SavedJobs.get().filter(item => item.page === 'private-it').map(item => item.id)),
    filters: {
      experience: new Set(),
      role: new Set(),
      type: new Set(),
      company: new Set()
    }
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  let revealObserver;

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

  function debounce(fn, wait) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), wait);
    };
  }

  function init() {
    setupTheme();
    bindChrome();
    renderQuickSearches();
    showSkeletons();
    loadDirectoryData();

    if (window.SavedJobs) {
      window.SavedJobs.addListener((list) => {
        state.saved = new Set(list.filter(item => item.page === 'private-it').map(item => item.id));
        updateSavedCount();
      });
    }
  }

  async function loadDirectoryData() {
    try {
      const data = await getItJobs();
      const rows = Array.isArray(data) ? data : data.jobs || [];
      state.entries = rows.map(normalizeEntry);
      state.companies = makeCompanyList(state.entries);
      populateFilters();
      renderAll();
    } catch (error) {
      console.error(error);
      $('#jobList').innerHTML = '<div class="empty-inline"><h3>Unable to load directory data</h3><p>Please try refreshing the page.</p></div>';
      toast('Unable to load directory data');
    }
  }

  function normalizeEntry(row, index) {
    const company = row.company || 'Company';
    const role = inferRole(row.title || row.role || '');
    const experience = normalizeExperience(row.experience);
    const type = TYPE_OPTIONS.includes(row.type) ? row.type : 'Full Time';
    return {
      id: row.id || slug(company),
      company,
      logo: row.logo || `assets/logos/${slug(company)}.svg`,
      role,
      sourceTitle: row.title || role,
      experience,
      type,
      officialLink: row.officialLink || '#'
    };
  }

  function normalizeExperience(value) {
    const text = String(value || '').trim();
    if (EXPERIENCE_OPTIONS.includes(text)) return text;
    if (/fresher/i.test(text)) return 'Fresher';
    if (/^0|0-2/i.test(text)) return '0-2 Years';
    if (/1-3|2-4/i.test(text)) return '1-3 Years';
    if (/2-5|3-5|3-6|4-6/i.test(text)) return '2-5 Years';
    if (/5|6|7|8|10|\+/i.test(text)) return '5+ Years';
    return 'Fresher';
  }

  function inferRole(title) {
    const text = String(title).toLowerCase();
    if (/ui\/ux|ux|designer|figma/.test(text)) return 'UI / UX Designer';
    if (/product manager|crm specialist/.test(text)) return 'Product Manager';
    if (/business analyst/.test(text)) return 'Business Analyst';
    if (/data scientist|research scientist|deep learning|machine learning|ai/.test(text)) return 'AI / ML Engineer';
    if (/data analyst/.test(text)) return 'Data Analyst';
    if (/data engineer/.test(text)) return 'Data Scientist';
    if (/security|cyber/.test(text)) return 'Cyber Security Engineer';
    if (/qa|quality|test/.test(text)) return 'QA Engineer';
    if (/network/.test(text)) return 'Network Engineer';
    if (/system administrator|systems engineer|assistant system/.test(text)) return 'System Administrator';
    if (/devops|sre|site reliability|infrastructure|kubernetes/.test(text)) return 'DevOps Engineer';
    if (/cloud|azure|aws/.test(text)) return 'Cloud Engineer';
    if (/mobile|ios|android|swift/.test(text)) return 'Mobile Developer';
    if (/embedded|firmware|vlsi|analog|gpu|cuda/.test(text)) return 'Embedded Engineer';
    if (/frontend|front-end|ui engineer|react|angular/.test(text)) return 'Frontend Developer';
    if (/backend|back-end|microservices|platform|support engineer/.test(text)) return 'Backend Developer';
    if (/full stack|fullstack/.test(text)) return 'Full Stack Developer';
    if (/developer|development|programmer|application/.test(text)) return 'Software Developer';
    return 'Software Engineer';
  }

  function makeCompanyList(entries) {
    const map = new Map();
    entries.forEach(entry => {
      if (!map.has(entry.company)) {
        map.set(entry.company, {
          name: entry.company,
          logo: entry.logo,
          officialLink: entry.officialLink
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function bindChrome() {
    $('#searchForm')?.addEventListener('submit', event => {
      event.preventDefault();
      state.query = $('#searchInput')?.value || '';
      state.visible = PAGE_SIZE;
      if (!state.query.trim()) state.companyVisible = COMPANY_PAGE_SIZE;
      renderAll({ scrollCompanyMatch: true });
    });

    $('#searchInput')?.addEventListener('input', debounce(event => {
      state.query = event.target.value;
      state.visible = PAGE_SIZE;
      if (!state.query.trim()) state.companyVisible = COMPANY_PAGE_SIZE;
      renderAll();
    }, 150));

    $('#sortSelect')?.addEventListener('change', renderJobs);
    $('#loadMore')?.addEventListener('click', () => {
      state.visible += PAGE_SIZE;
      renderJobs();
    });

    $('#companyLoadMore')?.addEventListener('click', event => {
      const previousVisible = state.companyVisible;
      state.companyVisible += COMPANY_PAGE_SIZE;
      applyCompanyVisibility({ animateFrom: previousVisible, scrollToNew: true });
      createRipple(event.currentTarget, event);
    });

    $('#clearFilters')?.addEventListener('click', clearFilters);
    $('#emptyClear')?.addEventListener('click', clearFilters);
    $('#showSaved')?.addEventListener('click', openSaved);
    $('#bottomSaved')?.addEventListener('click', openSaved);
    $('#closeSaved')?.addEventListener('click', () => $('#savedDialog')?.close());

    $('#openFilters')?.addEventListener('click', openFilters);
    $('#bottomFilters')?.addEventListener('click', openFilters);
    $('#closeFilters')?.addEventListener('click', closeFilters);
    $('#scrim')?.addEventListener('click', closeFilters);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeFilters();
    });

    $('#navToggle')?.addEventListener('click', () => {
      const nav = $('#navLinks');
      const expanded = nav?.classList.toggle('open') || false;
      $('#navToggle')?.setAttribute('aria-expanded', String(expanded));
    });

    $('#topBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => $('#topBtn')?.classList.toggle('show', window.scrollY > 520), { passive: true });

    document.addEventListener('click', event => {
      const save = event.target.closest('.bookmark-button[data-save]');
      if (save) {
        event.preventDefault();
        toggleSave(save.dataset.save);
        return;
      }
    });
  }

  function setupTheme() {
    const savedTheme = localStorage.getItem('jb-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    updateThemeButton(savedTheme);

    window.addEventListener('themechanged', (e) => {
      updateThemeButton(e.detail.theme);
    });
  }

  function updateThemeButton(theme) {
    const button = $('#theme-toggle') || $('#themeToggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  function populateFilters() {
    renderFilterGroup('experienceFilters', 'experience', EXPERIENCE_OPTIONS);
    renderFilterGroup('roleFilters', 'role', ROLE_OPTIONS);
    renderFilterGroup('typeFilters', 'type', TYPE_OPTIONS);
    renderFilterGroup('companyFilters', 'company', state.companies.map(company => company.name));
  }

  function renderFilterGroup(containerId, filterKey, options) {
    const container = $(`#${containerId}`);
    if (!container) return;
    container.innerHTML = options.map(option => `
      <label class="filter-option">
        <input type="checkbox" value="${esc(option)}" data-filter="${filterKey}">
        <span>${esc(option)}</span>
      </label>
    `).join('');
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', event => {
        const set = state.filters[filterKey];
        if (event.target.checked) set.add(event.target.value);
        else set.delete(event.target.value);
        state.visible = PAGE_SIZE;
        renderAll();
      });
    });
  }

  function renderQuickSearches() {
    const container = $('#quickSearches');
    if (!container) return;
    container.innerHTML = QUICK_SEARCHES.map(term => `<button type="button" data-search="${esc(term)}">${esc(term)}</button>`).join('');
    container.querySelectorAll('[data-search]').forEach(button => {
      button.addEventListener('click', () => {
        const input = $('#searchInput');
      state.query = button.dataset.search || '';
      if (input) input.value = state.query;
      state.visible = PAGE_SIZE;
      if (!state.query.trim()) state.companyVisible = COMPANY_PAGE_SIZE;
      renderAll({ scrollCompanyMatch: true });
      });
    });
  }

  function renderAll(options = {}) {
    renderCompanies();
    renderJobs();
    renderActiveTags();
    updateSavedCount();
    setupReveal();
    if (options.scrollCompanyMatch) scrollToCompanyMatch();
  }

  function renderCompanies() {
    const container = $('#companyGrid');
    if (!container) return;
    if (!state.companiesRendered) {
      container.innerHTML = state.companies.map((company, index) => {
        const companyId = SavedJobs.getCompanyId(company);
        const companyName = SavedJobs.getCompanyName(company.name);
        const isSaved = SavedJobs.has(companyId, 'private-it');
        return `
          <article class="company-card reveal-card" data-company-index="${index}" data-company-name="${esc(company.name)}">
            <button class="bookmark-button ${isSaved ? 'saved' : ''}" 
                    type="button" 
                    data-save="${companyId}" 
                    data-page="private-it" 
                    data-name="${companyName}"
                    data-tooltip="${isSaved ? 'Saved' : 'Save'}"
                    aria-label="${isSaved ? 'Remove from saved' : 'Save to saved'}">
              <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
            </button>
            <div class="logo-wrap logo-wrap-lg">
              <img src="${safe(company.logo)}" loading="lazy" alt="${esc(company.name)} logo" onerror="this.onerror=null;this.src=createLogoDataUrl('${esc(company.name)}')">
            </div>
            <b>${highlight(company.name, state.query)}</b>
            <span class="verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified</span>
            <a class="primary-btn career-btn" href="${safe(company.officialLink)}" target="_blank" rel="noopener" aria-label="Visit ${esc(company.name)} official career portal">
              Visit Career Portal <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </a>
          </article>
        `;
      }).join('');
      state.companiesRendered = true;
    }
    applyCompanyVisibility();
    syncBookmarkButtons();
  }

  function applyCompanyVisibility(options = {}) {
    const container = $('#companyGrid');
    const loadMore = $('#companyLoadMore');
    if (!container) return;
    const queryTokens = tokenize(state.query);
    const matches = queryTokens.length ? state.companies
      .map((company, index) => ({ company, index, score: companySearchScore(company, queryTokens) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index) : [];

    if (!queryTokens.length) {
      state.companyVisible = Math.min(state.companyVisible, Math.max(COMPANY_PAGE_SIZE, state.companies.length));
    } else if (matches.length) {
      state.companyVisible = Math.max(state.companyVisible, matches[0].index + 1);
    }

    const visibleLimit = Math.min(state.companyVisible, state.companies.length);
    const matchIndexes = new Set(matches.map(item => item.index));
    const visibleCards = [];
    container.querySelectorAll('.company-card').forEach(card => {
      const index = Number(card.dataset.companyIndex || 0);
      const isVisible = index < visibleLimit;
      card.hidden = !isVisible;
      card.classList.toggle('company-card-hidden', !isVisible);
      card.classList.toggle('company-match', isVisible && matchIndexes.has(index));
      card.classList.toggle('is-visible', isVisible);
      card.style.animationDelay = isVisible ? `${Math.min(index % COMPANY_PAGE_SIZE, 7) * 45}ms` : '';
      if (isVisible) visibleCards.push(card);
      if (typeof options.animateFrom === 'number' && index >= options.animateFrom && isVisible) {
        card.classList.remove('company-card-enter');
        void card.offsetWidth;
        card.classList.add('company-card-enter');
      }
    });

    if (loadMore) {
      const allVisible = visibleLimit >= state.companies.length;
      loadMore.hidden = allVisible;
      loadMore.classList.toggle('is-hidden', allVisible);
    }

    if (options.scrollToNew && visibleCards.length) {
      const target = visibleCards[Math.min(options.animateFrom || 0, visibleCards.length - 1)];
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function companySearchScore(company, tokens) {
    const related = state.entries.filter(entry => entry.company === company.name);
    const name = company.name.toLowerCase();
    const haystack = [
      company.name,
      'official career portal verified full time internship contract',
      ...related.flatMap(entry => [entry.role, entry.experience, entry.type, entry.sourceTitle])
    ].join(' ').toLowerCase();
    if (!tokens.every(token => haystack.includes(token))) return 0;
    if (tokens.every(token => name.includes(token))) return 100;
    if (tokens.some(token => name.startsWith(token))) return 70;
    return 35;
  }

  function scrollToCompanyMatch() {
    const queryTokens = tokenize(state.query);
    if (!queryTokens.length) {
      $('#companies')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const target = $('.company-card.company-match:not([hidden])');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    $('#jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderJobs() {
    const list = $('#jobList');
    const count = $('#resultCount');
    const empty = $('#emptyState');
    const loadMore = $('#loadMore');
    if (!list) return;

    const tokens = tokenize(state.query);
    const filtered = state.entries.filter(entry => {
      const haystack = [entry.company, entry.role, entry.experience, entry.type, entry.sourceTitle].join(' ').toLowerCase();
      if (tokens.length && !tokens.every(token => haystack.includes(token))) return false;
      if (state.filters.experience.size && !state.filters.experience.has(entry.experience)) return false;
      if (state.filters.role.size && !state.filters.role.has(entry.role)) return false;
      if (state.filters.type.size && !state.filters.type.has(entry.type)) return false;
      if (state.filters.company.size && !state.filters.company.has(entry.company)) return false;
      return true;
    });

    const sorted = sortEntries(filtered);
    state.filtered = sorted;
    if (count) count.textContent = sorted.length.toLocaleString('en-IN');

    const visible = sorted.slice(0, state.visible);
    if (empty) empty.hidden = visible.length > 0;
    if (loadMore) loadMore.hidden = state.visible >= sorted.length;

    if (!visible.length) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = visible.map(jobCard).join('');
  }

  function sortEntries(entries) {
    const value = $('#sortSelect')?.value || 'relevance';
    const items = [...entries];
    if (value === 'company') items.sort((a, b) => a.company.localeCompare(b.company) || a.role.localeCompare(b.role));
    if (value === 'role') items.sort((a, b) => a.role.localeCompare(b.role) || a.company.localeCompare(b.company));
    return items;
  }

  function jobCard(entry) {
    const companyId = SavedJobs.getCompanyId(entry);
    const companyName = SavedJobs.getCompanyName(entry.company);
    const isSaved = SavedJobs.has(companyId, 'private-it');
    return `
      <article class="job-card reveal-card">
        <button class="bookmark-button ${isSaved ? 'saved' : ''}" 
                type="button" 
                data-save="${companyId}" 
                data-page="private-it" 
                data-name="${companyName}"
                data-tooltip="${isSaved ? 'Saved' : 'Save'}"
                aria-label="${isSaved ? 'Remove from saved' : 'Save to saved'}">
          <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
        </button>
        <div class="job-main">
          <div class="logo-wrap">
            <img src="${safe(entry.logo)}" loading="lazy" alt="${esc(entry.company)} logo" onerror="this.onerror=null;this.src=createLogoDataUrl('${esc(entry.company)}')">
          </div>
          <div class="job-copy">
            <h3>${highlight(entry.company, state.query)}</h3>
            <span class="verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified</span>
          </div>
        </div>
        <div class="job-actions">
          <a class="primary-btn career-btn" href="${safe(entry.officialLink)}" target="_blank" rel="noopener">Visit Career Portal <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
        </div>
      </article>
    `;
  }

  function renderActiveTags() {
    const container = $('#activeTags');
    if (!container) return;
    const tags = [];
    if (state.query.trim()) tags.push({ type: 'search', value: state.query.trim(), label: `Search: ${state.query.trim()}` });
    Object.entries(state.filters).forEach(([type, values]) => {
      values.forEach(value => tags.push({ type, value, label: value }));
    });

    container.innerHTML = tags.map(tag => `
      <button class="tag" type="button" data-remove-type="${esc(tag.type)}" data-remove-value="${esc(tag.value)}">
        ${esc(tag.label)} <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    `).join('');

    container.querySelectorAll('[data-remove-type]').forEach(button => {
      button.addEventListener('click', () => removeTag(button.dataset.removeType, button.dataset.removeValue));
    });
  }

  function removeTag(type, value) {
    if (type === 'search') {
      state.query = '';
      state.companyVisible = COMPANY_PAGE_SIZE;
      const input = $('#searchInput');
      if (input) input.value = '';
    } else {
      state.filters[type]?.delete(value);
      $$(`input[data-filter="${type}"]`).forEach(input => {
        if (input.value === value) input.checked = false;
      });
    }
    state.visible = PAGE_SIZE;
    renderAll();
  }

  function clearFilters() {
    state.query = '';
    state.visible = PAGE_SIZE;
    state.companyVisible = COMPANY_PAGE_SIZE;
    Object.values(state.filters).forEach(set => set.clear());
    const input = $('#searchInput');
    if (input) input.value = '';
    $$('.filter-option input').forEach(checkbox => { checkbox.checked = false; });
    closeFilters();
    renderAll();
  }

  function createRipple(button, event) {
    if (!button) return;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'button-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  function openFilters() {
    $('#filtersPanel')?.classList.add('open');
    document.body.classList.add('filters-open');
    const scrim = $('#scrim');
    if (scrim) scrim.hidden = false;
  }

  function closeFilters() {
    $('#filtersPanel')?.classList.remove('open');
    document.body.classList.remove('filters-open');
    const scrim = $('#scrim');
    if (scrim) scrim.hidden = true;
  }

  function toggleSave(id) {
    if (!window.SavedJobs) return;
    
    // Find the company or job entry by companyId or jobId
    const entry = state.entries.find(e => SavedJobs.getCompanyId(e) === id || e.id === id);
    const company = state.companies.find(c => SavedJobs.getCompanyId(c) === id || c.id === id);
    
    let jobData;
    if (entry) {
      const companyName = SavedJobs.getCompanyName(entry.company);
      const roleName = entry.role || entry.sourceTitle || "Software Engineer";
      jobData = {
        id: entry.id,
        company: entry.company,
        role: roleName,
        category: "Private IT",
        page: "private-it",
        qualification: entry.qualification || "Graduate / Post Graduate",
        experience: entry.experience || "Fresher",
        skills: entry.skills || [],
        logo: entry.logo || "",
        officialWebsite: entry.officialLink,
        applyLink: entry.officialLink,
        rawData: entry
      };
    } else if (company) {
      const companyName = SavedJobs.getCompanyName(company.name);
      jobData = {
        id: SavedJobs.getCompanyId(company),
        company: company.name,
        role: "Official Career Portal",
        category: "Private IT",
        page: "private-it",
        qualification: "Graduate",
        experience: "Any Experience",
        skills: [],
        logo: company.logo || "",
        officialWebsite: company.officialLink,
        applyLink: company.officialLink,
        rawData: company
      };
    }
    
    if (jobData) {
      window.SavedJobs.toggle(jobData);
    }
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
      count.textContent = String(SavedJobs.get().filter(item => item.page === 'private-it').length);
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
      container.innerHTML = '<div class="saved-empty"><h2>Saved Portals</h2><p>No saved portals yet.</p></div>';
      return;
    }
    
    const itemsHtml = list.map(item => {
      if (item.page === 'private-it') {
        const entry = state.entries.find(e => SavedJobs.getCompanyId(e) === item.id);
        const officialLink = entry ? entry.officialLink : '#';
        return `
          <article class="saved-item">
            <div>
              <b>${esc(item.name)}</b>
              <span class="verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified · IT</span>
            </div>
            <div>
              <a class="primary-btn" href="${safe(officialLink)}" target="_blank" rel="noopener">Visit Career Portal</a>
              <button class="ghost-btn" type="button" data-save="${esc(item.id)}" data-page="private-it">Remove</button>
            </div>
          </article>
        `;
      } else {
        return `
          <article class="saved-item">
            <div>
              <b>${esc(item.name)}</b>
              <span class="verified-badge"><i class="fa-solid fa-industry" aria-hidden="true"></i> Manufacturing</span>
            </div>
            <div>
              <a class="primary-btn" href="manufacturing.html" rel="noopener">Go to Manufacturing</a>
              <button class="ghost-btn" type="button" data-save="${esc(item.id)}" data-page="manufacturing">Remove</button>
            </div>
          </article>
        `;
      }
    }).join('');
    
    container.innerHTML = `
      <h2>Saved Portals</h2>
      <div class="saved-list">
        ${itemsHtml}
      </div>
    `;
    
    container.querySelectorAll('button[data-save]').forEach(btn => {
      btn.addEventListener('click', () => {
        const saveId = btn.dataset.save;
        const savePage = btn.dataset.page;
        SavedJobs.remove(saveId, savePage);
        
        if (savePage === 'private-it') {
          state.saved.delete(saveId);
          syncBookmarkButtons();
        }
        
        updateSavedCount();
        renderSaved();
        toast('Removed');
      });
    });
  }

  function setupReveal() {
    const cards = $$('.reveal-card:not(.is-visible)');
    if (!cards.length) return;
    if (!('IntersectionObserver' in window)) {
      cards.forEach(card => card.classList.add('is-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '80px 0px', threshold: 0.08 });
    }
    cards.forEach(card => revealObserver.observe(card));
  }

  function showSkeletons() {
    const companyGrid = $('#companyGrid');
    if (companyGrid) companyGrid.innerHTML = Array.from({ length: 10 }).map(() => '<div class="skeleton"></div>').join('');
    const jobList = $('#jobList');
    if (jobList) jobList.innerHTML = Array.from({ length: 3 }).map(() => '<div class="job-skeleton"></div>').join('');
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

  function tokenize(value) {
    return String(value || '').toLowerCase().split(/\s+/).map(token => token.trim()).filter(Boolean);
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function highlight(text, query) {
    const escapedText = esc(text);
    if (!query || !query.trim()) return escapedText;
    const escapedQuery = esc(query.trim()).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function safe(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return '#';
    }
  }

  window.createLogoDataUrl = name => {
    const label = String(name || 'IT').trim().slice(0, 2).toUpperCase();
    const color = colorFromString(name || 'JobBridge');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="800" fill="#fff">${esc(label)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  function colorFromString(value) {
    let hash = 0;
    String(value).split('').forEach(char => { hash = char.charCodeAt(0) + ((hash << 5) - hash); });
    return `hsl(${Math.abs(hash) % 360} 72% 42%)`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
