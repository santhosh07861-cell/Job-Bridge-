(() => {
  'use strict';

  const DATA_URL = 'data/government-jobs.json';
  const PAGE_SIZE = 9;
  const state = {
    organizations: [],
    filtered: [],
    categories: [],
    resources: [],
    saved: new Set(),
    query: '',
    category: 'All',
    view: 'all',
    sort: 'priority',
    page: 1,
    visibleMobile: PAGE_SIZE
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const el = {};

  document.addEventListener('DOMContentLoaded', init);

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

  async function init() {
    cacheElements();
    restorePreferences();
    bindEvents();
    try {
      const data = await fetchWithCache(DATA_URL, 'jb-cache-government');
      state.organizations = Array.isArray(data.organizations) ? data.organizations : [];
      state.categories = data.categories || [];
      state.resources = data.resources || [];
      renderDataDrivenUI();
      applyFilters();
      animateCounters();
    } catch (error) {
      el.jobList.innerHTML = '';
      el.empty.hidden = false;
      $('h3', el.empty).textContent = 'Unable to load official directory';
      $('p', el.empty).textContent = 'Run this page through a local web server so the JSON data source can be loaded.';
      toast(error.message);
    }
  }

  function cacheElements() {
    Object.assign(el, {
      jobList: $('#job-list'),
      empty: $('#empty-state'),
      results: $('#results-count'),
      pagination: $('#pagination'),
      loadMore: $('#load-more-button'),
      activeFilters: $('#active-filters'),
      heroInput: $('#hero-search-input'),
      sort: $('#sort-select'),
      featured: $('#featured-track'),
      heroCategories: $('#hero-categories'),
      categoryFilters: $('#category-filter-list'),
      trending: $('#hero-trending-list'),
      resources: $('#resource-links'),
      modal: $('#job-modal'),
      modalBody: $('#modal-body'),
      toast: $('#toast-region'),
      sidebar: $('.left-sidebar'),
      themeToggle: $('#theme-toggle'),
      navLinks: $('#nav-links'),
      backTop: $('#back-to-top')
    });
  }

  function restorePreferences() {
    try {
      const theme = localStorage.getItem('jb-theme') || 'dark';
      setTheme(theme);
      
      // Subscribe to real-time bookmark updates
      if (window.SavedJobs) {
        window.SavedJobs.addListener((list) => {
          state.saved = new Set(list.filter(item => item.page === 'government').map(item => item.id));
          const sidebarCount = document.getElementById('sidebar-saved-count');
          if (sidebarCount) sidebarCount.textContent = state.saved.size;
          if (state.view === 'saved') {
            applyFilters();
          }
        });
      }
    } catch (_) {}
  }

  function bindEvents() {
    $('#hero-search').addEventListener('submit', event => {
      event.preventDefault();
      state.query = el.heroInput.value.trim();
      state.page = 1;
      applyFilters();
      scrollToDirectory();
    });
    el.sort.addEventListener('change', () => {
      state.sort = el.sort.value;
      state.page = 1;
      applyFilters();
    });
    $('#clear-filters-button')?.addEventListener('click', clearFilters);
    $('#clear-filters-mobile')?.addEventListener('click', clearFilters);
    $('#browse-jobs-button')?.addEventListener('click', scrollToDirectory);
    $('#notification-button')?.addEventListener('click', () => $('#official-resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    $('#saved-nav-button')?.addEventListener('click', () => setView('saved'));
    $('#featured-prev')?.addEventListener('click', () => scrollFeatured(-1));
    $('#featured-next')?.addEventListener('click', () => scrollFeatured(1));
    $('#filter-mobile-button')?.addEventListener('click', openSidebar);
    $('#sidebar-close')?.addEventListener('click', closeSidebar);
    $('#sidebar-overlay')?.addEventListener('click', closeSidebar);
    $('#bottom-categories')?.addEventListener('click', event => {
      addBottomNavRipple(event);
      $('#filter-mobile-button')?.click();
    });
    $('#bottom-saved')?.addEventListener('click', event => {
      addBottomNavRipple(event);
      $('#saved-nav-button')?.click();
    });
    $$('.bottom-nav a, .bottom-nav button').forEach(item => item.addEventListener('pointerdown', addBottomNavRipple));
    $('#modal-close').addEventListener('click', closeModal);
    el.modal.addEventListener('click', event => { if (event.target === el.modal) closeModal(); });
    $('#modal-share').addEventListener('click', () => shareOrganization(el.modal.dataset.orgId));
    $('#modal-copy').addEventListener('click', () => copyOrganizationLink(el.modal.dataset.orgId));
    el.loadMore.addEventListener('click', () => {
      state.visibleMobile += PAGE_SIZE;
      renderOrganizations();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && matchMedia('(max-width: 520px)').matches && !el.loadMore.hidden) {
          state.visibleMobile += PAGE_SIZE;
          renderOrganizations();
        }
      }, { rootMargin: '180px' }).observe(el.loadMore);
    }
    el.backTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    $$('.sidebar-nav button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    addEventListener('scroll', () => el.backTop.classList.toggle('visible', scrollY > 600), { passive: true });
  }

  function renderDataDrivenUI() {
    renderCategories();
    renderFeatured();
    renderTrending();
    renderResources();
    updateStats();
  }

  function renderCategories() {
    const categories = state.categories.length
      ? state.categories
      : [...new Set(state.organizations.map(org => org.category))].map(name => ({ name, color: '#155eef' }));
    el.heroCategories.innerHTML = categories.map(cat => `<button type="button" data-category="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</button>`).join('');
    el.categoryFilters.innerHTML = categories.map(cat => `<button type="button" data-category="${escapeHTML(cat.name)}"><i class="category-dot" style="--dot-color:${cat.color}"></i><span>${escapeHTML(cat.name)}</span></button>`).join('');
    $$('[data-category]', el.heroCategories).forEach(button => button.addEventListener('click', () => setCategory(button.dataset.category)));
    $$('[data-category]', el.categoryFilters).forEach(button => button.addEventListener('click', () => setCategory(button.dataset.category)));
  }

  function renderFeatured() {
    const organizations = state.organizations.filter(org => org.featured);
    el.featured.innerHTML = organizations.map(org => `
      <article class="featured-card" style="--card-color:${org.color}">
        <div class="featured-top"><span class="job-logo">${escapeHTML(org.logo)}</span><span class="official-badge"><i class="fa-solid fa-circle-check"></i> Official Source</span></div>
        <h3>${escapeHTML(org.name)}</h3><p>${escapeHTML(org.fullName)}</p>
        <div class="featured-meta"><span class="meta-chip"><i class="fa-solid fa-layer-group"></i>${escapeHTML(org.category)}</span><span class="meta-chip"><i class="fa-solid fa-location-dot"></i>${escapeHTML(org.location)}</span></div>
        <div class="portal-link-count">${number(org.links?.length || 0)} official links</div>
        <button class="button button-primary" type="button" data-details="${org.id}">View Official Links</button>
      </article>`).join('');
    $$('[data-details]', el.featured).forEach(button => button.addEventListener('click', () => openModal(button.dataset.details)));
  }

  function renderTrending() {
    el.trending.innerHTML = [...state.organizations].sort((a, b) => b.priority - a.priority).slice(0, 3).map(org => `
      <div class="trending-item" data-details="${org.id}" role="button" tabindex="0">
        <span class="job-logo" style="--card-color:${org.color}">${escapeHTML(org.logo)}</span>
        <div><strong>${escapeHTML(org.name)}</strong><span>${escapeHTML(org.category)} · Official Source</span></div>
      </div>`).join('');
    $$('[data-details]', el.trending).forEach(item => {
      item.addEventListener('click', () => openModal(item.dataset.details));
      item.addEventListener('keydown', event => { if (event.key === 'Enter') openModal(item.dataset.details); });
    });
  }

  function renderResources() {
    el.resources.innerHTML = state.resources.map(resource => `
      <a href="${safeURL(resource.url)}" target="_blank" rel="noopener noreferrer">
        <span><i class="fa-solid fa-circle-check"></i> ${escapeHTML(resource.label)}</span>
        <b>Official Source</b>
      </a>`).join('');
  }

  function applyFilters() {
    const query = state.query.toLowerCase();
    state.filtered = state.organizations.filter(org => {
      const linkLabels = (org.links || []).map(link => link.label).join(' ');
      const searchable = `${org.name} ${org.fullName} ${org.qualification} ${org.category} ${org.location} ${linkLabels}`.toLowerCase();
      const categoryMatch = state.category === 'All' || org.category === state.category;
      const viewMatch = state.view === 'saved' ? state.saved.has(org.id) : true;
      return (!query || searchable.includes(query)) && categoryMatch && viewMatch;
    });
    state.filtered.sort((a, b) => {
      if (state.sort === 'az') return a.name.localeCompare(b.name);
      if (state.sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return b.priority - a.priority || a.name.localeCompare(b.name);
    });
    renderOrganizations();
    renderActiveFilters();
    syncControls();
  }

  function renderOrganizations() {
    const maxPage = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, maxPage);
    const desktopOrganizations = state.filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const mobileOrganizations = state.filtered.slice(0, state.visibleMobile);
    el.jobList.innerHTML = desktopOrganizations.map(organizationCard).join('');
    el.jobList.dataset.mobileHtml = mobileOrganizations.map(organizationCard).join('');
    el.results.textContent = number(state.filtered.length);
    el.empty.hidden = state.filtered.length > 0;
    renderPagination(maxPage);
    bindOrganizationActions();
    el.loadMore.hidden = state.visibleMobile >= state.filtered.length;
    applyMobileOrganizationList();

    // Add sequential fade-up animation to cards
    $$('#job-list .job-card').forEach((card, index) => {
      card.style.animation = `cardFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both`;
      card.style.animationDelay = `${index * 45}ms`;
    });
  }

  function organizationCard(org) {
    const links = (org.links || []).slice(0, 6).map(link => `
      <a class="official-link-chip" href="${safeURL(link.url)}" target="_blank" rel="noopener noreferrer">
        <span>${escapeHTML(link.label)}</span>
        <b>Official Source</b>
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>`).join('');
    return `<article class="job-card" id="org-${escapeHTML(org.id)}">
      <div class="job-card-top">
        <div class="job-heading"><span class="job-logo" style="--card-color:${org.color}">${escapeHTML(org.logo)}</span><div><span class="official-badge"><i class="fa-solid fa-circle-check"></i> Official Source</span><h2>${highlight(org.name, state.query)}</h2><span class="department">${highlight(org.fullName, state.query)}</span></div></div>
        <button class="bookmark-button ${(window.SavedJobs && window.SavedJobs.has(org.id)) ? 'saved' : ''}" 
                type="button" 
                data-save="${org.id}" 
                data-page="government"
                data-name="${escapeHTML(org.name)}"
                data-tooltip="${(window.SavedJobs && window.SavedJobs.has(org.id)) ? 'Saved' : 'Save'}"
                aria-label="${(window.SavedJobs && window.SavedJobs.has(org.id)) ? 'Remove from saved' : 'Save to saved'}">
          <i class="${(window.SavedJobs && window.SavedJobs.has(org.id)) ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
        </button>
      </div>
      <div class="job-details-grid">
        <div class="job-detail"><span>Category</span><strong>${escapeHTML(org.category)}</strong></div>
        <div class="job-detail"><span>Organization</span><strong>${highlight(org.name, state.query)}</strong></div>
        <div class="job-detail"><span>Qualification</span><strong>${escapeHTML(org.qualification)}</strong></div>
        <div class="job-detail"><span>Official Website</span><strong>${domainLabel(org.officialUrl)}</strong></div>
      </div>
      <div class="official-link-grid">${links}</div>
      <div class="job-card-bottom">
        <div class="job-tags"><span>${escapeHTML(org.category)}</span><span>${number(org.links?.length || 0)} official links</span></div>
        <div class="job-actions"><button class="button button-ghost" type="button" data-details="${org.id}">View Official Links</button><a class="button button-primary" href="${safeURL(org.officialUrl)}" target="_blank" rel="noopener noreferrer">Visit Official Portal <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>
      </div>
    </article>`;
  }

  function bindOrganizationActions() {
    $$('[data-details]', el.jobList).forEach(button => button.addEventListener('click', () => openModal(button.dataset.details)));
    $$('[data-save]', el.jobList).forEach(button => button.addEventListener('click', () => toggleSave(button.dataset.save)));
  }

  function renderPagination(maxPage) {
    el.pagination.innerHTML = Array.from({ length: maxPage }, (_, index) => `<button type="button" class="${state.page === index + 1 ? 'active' : ''}" data-page="${index + 1}" aria-label="Page ${index + 1}">${index + 1}</button>`).join('');
    $$('[data-page]', el.pagination).forEach(button => button.addEventListener('click', () => {
      state.page = Number(button.dataset.page);
      renderOrganizations();
      scrollToDirectory();
    }));
  }

  function renderActiveFilters() {
    const tags = [];
    if (state.query) tags.push({ label: `Search: ${state.query}`, type: 'query' });
    if (state.category !== 'All') tags.push({ label: state.category, type: 'category' });
    if (state.view !== 'all') tags.push({ label: 'Saved Portals', type: 'view' });
    let html = tags.map(tag => `<button class="filter-tag" type="button" data-clear="${tag.type}">${escapeHTML(tag.label)} <i class="fa-solid fa-xmark"></i></button>`).join('');
    if (tags.length > 0) {
      html += `<button class="filter-tag-clear-all" type="button" id="clear-all-tags-btn">Clear All</button>`;
    }
    el.activeFilters.innerHTML = html;

    $$('[data-clear]', el.activeFilters).forEach(button => button.addEventListener('click', () => {
      if (button.dataset.clear === 'query') {
        state.query = '';
        el.heroInput.value = '';
      }
      if (button.dataset.clear === 'category') state.category = 'All';
      if (button.dataset.clear === 'view') state.view = 'all';
      state.page = 1;
      applyFilters();
    }));

    $('#clear-all-tags-btn')?.addEventListener('click', () => {
      clearFilters();
    });

    const isFilterActive = tags.length > 0;
    const clearMobileBtn = document.getElementById('clear-filters-mobile');
    if (clearMobileBtn) {
      clearMobileBtn.style.display = (isFilterActive && matchMedia('(max-width: 800px)').matches) ? 'inline-flex' : 'none';
    }
  }

  function syncControls() {
    $$('[data-category]').forEach(button => button.classList.toggle('active', button.dataset.category === state.category));
    $$('.sidebar-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    const count = state.saved.size;
    $('#saved-count').textContent = count;
    $('#sidebar-saved-count').textContent = count;
    $('#all-count').textContent = state.organizations.length;
  }

  function openModal(id) {
    const org = state.organizations.find(item => item.id === id);
    if (!org) return;
    el.modal.dataset.orgId = id;
    $('#modal-icon').innerHTML = `<span class="job-logo" style="--card-color:${org.color}">${escapeHTML(org.logo)}</span>`;
    $('#modal-title').textContent = org.name;
    $('#modal-department').textContent = org.fullName;
    $('#modal-apply').href = safeURL(org.officialUrl);
    el.modalBody.innerHTML = [
      modalSection('Category', org.category),
      modalSection('Organization', org.fullName),
      modalSection('Qualification', org.qualification),
      modalSection('Official Website', domainLabel(org.officialUrl)),
      modalSection('Official Recruitment Links', linkList(org.links), true)
    ].join('');
    el.modal.showModal();
    document.body.classList.add('modal-open');
  }

  function linkList(links = []) {
    return `<div class="modal-link-list">${links.map(link => `
      <a href="${safeURL(link.url)}" target="_blank" rel="noopener noreferrer">
        <span>${escapeHTML(link.label)}</span>
        <b>Official Source</b>
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>`).join('')}</div>`;
  }

  function modalSection(title, content, full = false) {
    return `<section class="modal-section ${full ? 'full' : ''}"><h3>${escapeHTML(title)}</h3>${typeof content === 'string' && content.trim().startsWith('<') ? content : `<p>${escapeHTML(content || 'Refer to the official website.')}</p>`}</section>`;
  }

  function closeModal() {
    el.modal.close();
    document.body.classList.remove('modal-open');
  }

  function toggleSave(id) {
    const org = state.organizations.find(item => item.id === id);
    if (!org) return;

    if (!window.SavedJobs) return;
    
    const jobData = {
      id: org.id,
      company: org.name,
      role: org.fullName || "Official Recruitment Portal",
      category: "Government",
      page: "government",
      qualification: org.qualification || "Graduate / Post Graduate",
      experience: "Not Required",
      skills: [],
      logo: org.logo || "GOV",
      officialWebsite: org.officialUrl,
      applyLink: org.officialUrl,
      rawData: org
    };

    window.SavedJobs.toggle(jobData);
  }

  function addBottomNavRipple(event) {
    const target = event.currentTarget;
    if (!target || !target.classList) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'bottom-nav-ripple';
    ripple.style.left = `${event.clientX - rect.left - 24}px`;
    ripple.style.top = `${event.clientY - rect.top - 24}px`;
    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  async function shareOrganization(id) {
    const org = state.organizations.find(item => item.id === id);
    if (!org) return;
    const shareData = { title: org.name, text: `${org.name} official recruitment portal`, url: `${location.href.split('#')[0]}#org-${org.id}` };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        toast('Official portal link copied');
      }
    } catch (_) {}
  }

  async function copyOrganizationLink(id) {
    const url = `${location.href.split('#')[0]}#org-${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Official portal link copied');
    } catch (_) {
      toast('Copying is unavailable in this browser');
    }
  }

  function setCategory(category) {
    state.category = category;
    state.view = 'all';
    state.page = 1;
    applyFilters();
    closeSidebar();
    scrollToDirectory();
  }

  function setView(view) {
    state.view = view;
    state.page = 1;
    applyFilters();
    closeSidebar();
    scrollToDirectory();
  }

  function clearFilters() {
    state.query = '';
    state.category = 'All';
    state.view = 'all';
    state.page = 1;
    el.heroInput.value = '';
    applyFilters();
    closeSidebar();
  }

  function scrollToDirectory() {
    $('#jobs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollFeatured(direction) {
    el.featured.scrollBy({ left: direction * 260, behavior: 'smooth' });
  }

  function updateStats() {
    const officialLinks = state.organizations.reduce((sum, org) => sum + (org.links?.length || 0), 0);
    const liveJobCountEl = $('#live-job-count');
    if (liveJobCountEl) {
      liveJobCountEl.setAttribute('data-counter', state.organizations.length);
      liveJobCountEl.textContent = number(state.organizations.length);
    }
    $('#department-count').textContent = number(state.organizations.length);
    $('#official-link-count').textContent = number(officialLinks);
  }

  function animateCounters() {
    $$('[data-counter]').forEach(node => {
      const target = Number(node.getAttribute('data-counter') || 0);
      let current = 0;
      const timer = setInterval(() => {
        current += Math.max(1, Math.ceil(target / 24));
        node.textContent = number(Math.min(current, target));
        if (current >= target) clearInterval(timer);
      }, 35);
    });
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    const btn = el.themeToggle || document.getElementById('theme-toggle');
    btn?.setAttribute('aria-pressed', String(dark));
    btn?.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    const icon = btn?.querySelector('i');
    if (icon) {
      icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    try { localStorage.setItem('jb-theme', theme); } catch (_) {}
  }

  window.addEventListener('themechanged', (e) => {
    setTheme(e.detail.theme);
  });

  function applyMobileOrganizationList() {
    if (matchMedia('(max-width: 520px)').matches) {
      el.jobList.innerHTML = el.jobList.dataset.mobileHtml;
      bindOrganizationActions();
    }
  }

  function toast(message) {
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    el.toast.append(item);
    setTimeout(() => item.remove(), 3000);
  }

  function domainLabel(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
      return 'Official website';
    }
  }

  function number(value) {
    return Number(value || 0).toLocaleString('en-IN');
  }

  function safeURL(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
    } catch (_) {
      return '#';
    }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  }

  function highlight(text, query) {
    const escapedText = escapeHTML(text);
    if (!query || !query.trim()) return escapedText;
    const escapedQuery = escapeHTML(query.trim()).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function openSidebar() {
    el.sidebar.classList.add('open');
    $('#sidebar-overlay')?.classList.add('open');
    document.body.classList.add('sidebar-open-body');
  }

  function closeSidebar() {
    el.sidebar.classList.remove('open');
    $('#sidebar-overlay')?.classList.remove('open');
    document.body.classList.remove('sidebar-open-body');
  }
})();
