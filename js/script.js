import { getGovernmentJobs, getItJobs, getManufacturingJobs } from './jobs-db.js';

document.addEventListener('DOMContentLoaded', () => {
  const THEME_KEY = 'jb-theme';
  const SPLASH_KEY = 'jb-splash-seen';

  const state = {
    theme: localStorage.getItem(THEME_KEY) || 'dark',
    jobs: [],
    stats: {
      verifiedListings: 2500,
      activeEmployers: 150,
      officialSources: 300,
      monthlyVisitors: 25000
    },
    query: '',
    category: 'all'
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  init();

  async function init() {
    // Clear legacy service workers and caches to force fresh asset downloads
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }

    applyTheme(state.theme);
    // bindNavigation(); // Centralized in auth.js to prevent duplicate event listeners
    bindHeaderScroll();
    bindActiveNavigation();
    bindTheme();
    bindSplash();
    bindSearch();
    bindTabs();
    bindCategories();
    bindFaq();
    bindPageTransitions();
    bindReveal();
    bindHeroParallax();
    bindRippleEffects();
    setYear();
    await loadAllData();
    renderStats();
    renderCategoryCounts();
    renderOpportunities();
  }

  function bindSplash() {
    const splash = $('#splash-screen');
    if (!splash) return;

    const hasSeenSplash = sessionStorage.getItem(SPLASH_KEY) === '1';
    if (hasSeenSplash) {
      splash.remove();
      return;
    }

    const stopParticles = initSplashParticles();

    window.setTimeout(() => {
      splash.classList.add('is-hidden');
      sessionStorage.setItem(SPLASH_KEY, '1');
      window.setTimeout(() => {
        splash.remove();
        if (stopParticles) stopParticles();
      }, 600); // 600ms fade-out transition
    }, 2600); // 2600ms total splash screen animation time
  }

  function initSplashParticles() {
    const canvas = document.getElementById('splash-particles');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = [];
    const isMobile = window.innerWidth <= 767;
    const particleCount = isMobile ? 25 : 45;
    const radiusBase = isMobile ? 0.4 : 0.6;
    const radiusMultiplier = isMobile ? 1.0 : 1.6;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * radiusMultiplier + radiusBase,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    let active = true;
    function animate() {
      if (!active) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 91, 35, ${p.alpha})`;
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
    };
  }

  function bindNavigation() {
    const navToggle = $('#nav-toggle');
    const navLinks = $('#primary-menu');
    const backdrop = $('#nav-backdrop');
    if (!navToggle || !navLinks) return;
    let backdropTimer;

    const setMenu = open => {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.innerHTML = open ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' : '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
      document.body.classList.toggle('nav-open', open);
      if (backdrop) {
        window.clearTimeout(backdropTimer);
        backdrop.hidden = false;
        backdrop.classList.toggle('is-visible', open);
        if (!open) backdropTimer = window.setTimeout(() => { backdrop.hidden = true; }, 280);
      }
    };

    navToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
    backdrop?.addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenu(false);
    });

    navLinks.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      setMenu(false);
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#') && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  function bindHeaderScroll() {
    const header = $('#site-header');
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function bindActiveNavigation() {
    const links = $$('[data-nav-link]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    const map = new Map(links.map(link => [link.dataset.navLink, link]));
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => link.classList.remove('active'));
      map.get(visible.target.id)?.classList.add('active');
    }, { threshold: [0.22, 0.45], rootMargin: '-22% 0px -58% 0px' });

    ['home', 'faq', 'about'].forEach(id => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  function bindTheme() {
    window.addEventListener('themechanged', (e) => {
      applyTheme(e.detail.theme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.dataset.theme = theme;
    const toggle = $('#theme-toggle');
    if (!toggle) return;
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    const icon = toggle.querySelector('i');
    if (icon) {
      icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

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

  async function loadAllData() {
    try {
      const [govRaw, itRaw, mfgRaw] = await Promise.all([
        getGovernmentJobs(),
        getItJobs(),
        getManufacturingJobs()
      ]);
      
      state.jobs = [
        ...normalizeData('government', govRaw),
        ...normalizeData('it', itRaw),
        ...normalizeData('manufacturing', mfgRaw)
      ];
    } catch (error) {
      console.error('Failed to load job data from database:', error);
      state.jobs = [];
    }
  }

  function normalizeData(category, raw) {
    if (category === 'government') {
      const jobs = Array.isArray(raw?.jobs) ? raw.jobs : [];
      return jobs.map((job, index) => ({
        id: job.id || `government-${index}`,
        category,
        title: job.title || 'Government opportunity',
        company: job.department || 'Government of India',
        source: job.department || 'Official recruitment portal',
        description: job.description || job.eligibility || 'Verified government recruitment listing.',
        location: job.location || 'All India',
        type: job.category || 'Government',
        date: job.lastDate || job.postedDate || '',
        postedDate: job.postedDate || '',
        vacancies: Number(job.vacancies) || 1,
        url: job.officialUrl || '#',
        logo: '',
        initials: job.logo || initials(job.department || job.title),
        color: job.color || '#2563eb',
        tags: [job.category, job.qualification, job.location].filter(Boolean)
      }));
    }

    const items = Array.isArray(raw) ? raw : (Array.isArray(raw?.jobs) ? raw.jobs : []);
    return items.map((job, index) => {
      const company = job.company || 'Official employer';
      const skills = Array.isArray(job.skills) ? job.skills : (job.technology ? [job.technology] : []);
      return {
        id: job.id || `${category}-${slug(company)}-${index}`,
        category,
        title: job.title || 'Official career opportunity',
        company,
        source: company,
        description: job.summary || job.description || `${company} official career listing.`,
        location: job.location || 'India',
        type: job.type || job.branch || 'Full Time',
        date: job.postedDate || '',
        postedDate: job.postedDate || '',
        vacancies: 1,
        url: job.officialLink || '#',
        logo: normalizeLogoPath(category, job.logo),
        initials: initials(company),
        color: category === 'it' ? '#7c3aed' : '#f59e0b',
        tags: [job.experience, job.type, job.workMode || job.mode, job.branch, ...skills].filter(Boolean).slice(0, 4)
      };
    });
  }

  function normalizeLogoPath(category, logo) {
    if (!logo) return '';
    if (/^https?:\/\//i.test(logo) || logo.startsWith('assets/')) return logo;
    if (category === 'manufacturing') return `assets/logos/${logo}`;
    return logo;
  }

  function renderStats() {
    Object.entries(state.stats).forEach(([key, value]) => {
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (el) {
        el.dataset.target = String(value);
        el.textContent = '0+';
      }
    });
    animateCountersWhenVisible();
  }

  function animateCountersWhenVisible() {
    const counters = $$('.counter');
    if (!counters.length) return;
    let hasAnimated = false;

    const startCounters = () => {
      if (hasAnimated) return;
      hasAnimated = true;
      counters.forEach(counter => animateCounter(counter, Number(counter.dataset.target) || 0));
    };

    if (!('IntersectionObserver' in window)) {
      startCounters();
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        startCounters();
        observer.disconnect();
      });
    }, { threshold: 0.35 });

    const stats = $('#stats');
    if (stats) observer.observe(stats);
  }

  function animateCounter(el, target) {
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = `${formatNumber(value)}+`;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function renderCategoryCounts() {
    ['government', 'it', 'manufacturing'].forEach(category => {
      const count = state.jobs
        .filter(job => job.category === category)
        .reduce((sum, job) => sum + (category === 'government' ? Number(job.vacancies) || 1 : 1), 0);
      const el = document.querySelector(`[data-count="${category}"]`);
      if (el) el.textContent = `${formatNumber(count)} listings`;
    });
  }

  function bindSearch() {
    const form = $('#hero-search');
    const input = $('#search-input');
    const select = $('#filter-select');
    const clear = $('#clear-search');

    form?.addEventListener('submit', event => {
      event.preventDefault();
      state.query = (input?.value || '').trim();
      state.category = select?.value || 'all';
      updateActiveTab(state.category);
      renderOpportunities();
      $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    input?.addEventListener('input', debounce(event => {
      state.query = event.target.value.trim();
      renderOpportunities();
    }, 220));

    select?.addEventListener('change', event => {
      state.category = event.target.value;
      updateActiveTab(state.category);
      renderOpportunities();
    });

    clear?.addEventListener('click', () => {
      state.query = '';
      state.category = 'all';
      if (input) input.value = '';
      if (select) select.value = 'all';
      updateActiveTab('all');
      renderOpportunities();
    });
  }

  function bindTabs() {
    $('#category-tabs')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      state.category = button.dataset.filter || 'all';
      const select = $('#filter-select');
      if (select) select.value = state.category;
      updateActiveTab(state.category);
      renderOpportunities();
    });
  }

  function updateActiveTab(category) {
    $$('#category-tabs [data-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.filter === category);
    });
  }

  function bindCategories() {
    $$('.category-card').forEach(card => {
      card.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        const page = card.dataset.page;
        if (page) {
          document.body.classList.add('is-leaving');
          window.setTimeout(() => { window.location.href = page; }, 130);
        }
      });
    });
  }

  function renderOpportunities() {
    const grid = $('#opportunity-grid');
    const empty = $('#empty-state');
    const summary = $('#results-summary');
    if (!grid || !empty) return;

    const query = state.query.toLowerCase();
    const filtered = state.jobs
      .filter(job => state.category === 'all' || job.category === state.category)
      .filter(job => {
        if (!query) return true;
        const haystack = [
          job.title,
          job.company,
          job.source,
          job.description,
          job.location,
          job.type,
          ...(job.tags || [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .sort(sortByFreshness)
      .slice(0, 9);

    if (summary) {
      const label = state.category === 'all' ? 'all categories' : categoryLabel(state.category);
      summary.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'} shown from ${label}${state.query ? ` for "${state.query}"` : ''}.`;
    }

    if (!filtered.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    grid.innerHTML = filtered.map(job => opportunityTemplate(job)).join('');
    grid.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
  }

  function opportunityTemplate(job) {
    const tags = (job.tags || []).slice(0, 4).map(tag => `<span>${esc(tag)}</span>`).join('');
    const logo = job.logo
      ? `<img src="${esc(job.logo)}" alt="" loading="lazy" onerror="this.remove(); this.parentElement.textContent='${esc(job.initials)}';">`
      : esc(job.initials);
    const category = categoryLabel(job.category);
    return `
      <article class="opportunity-card reveal in-view">
        <div class="opportunity-top">
          <div class="source-logo" style="background:linear-gradient(135deg, ${esc(job.color)}, var(--brand-2))">${logo}</div>
          <div>
            <h3>${esc(job.title)}</h3>
            <div class="opportunity-source">${esc(job.company)} • ${category}</div>
          </div>
        </div>
        <p>${esc(job.description)}</p>
        <div class="opportunity-tags">
          <span><i class="fa-solid fa-location-dot"></i> ${esc(job.location)}</span>
          <span>${esc(job.type)}</span>
          ${tags}
        </div>
        <a class="button button-soft shine" href="${safe(job.url)}" target="_blank" rel="noopener noreferrer">
          Visit official source <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        </a>
      </article>`;
  }

  function bindFaq() {
    $('#faq-list')?.addEventListener('click', event => {
      const button = event.target.closest('.faq-item button');
      if (!button) return;
      const item = button.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      $$('.faq-item').forEach(faq => {
        faq.classList.remove('open');
        faq.querySelector('button')?.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
      }
    });
  }

  function bindPageTransitions() {
    document.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const isLocalPage = href.endsWith('.html') && !link.target;
      if (!isLocalPage) return;
      event.preventDefault();
      document.body.classList.add('is-leaving');
      window.setTimeout(() => { window.location.href = href; }, 150);
    });
  }

  function bindReveal() {
    const targets = $$('.reveal');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px' });

    targets.forEach(el => observer.observe(el));
  }

  function setYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  function sortByFreshness(a, b) {
    const dateDelta = new Date(b.postedDate || b.date || 0) - new Date(a.postedDate || a.date || 0);
    if (dateDelta) return dateDelta;
    return String(a.company).localeCompare(String(b.company));
  }

  function sourceHost(url) {
    try {
      if (!url || url === '#') return '';
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
      return '';
    }
  }

  function categoryLabel(category) {
    if (category === 'it') return 'Private IT';
    if (category === 'manufacturing') return 'Manufacturing';
    if (category === 'government') return 'Government';
    return 'All';
  }

  function formatNumber(value) {
    return Number(value).toLocaleString('en-IN');
  }

  function initials(value) {
    return String(value || 'JB')
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 3)
      .join('')
      .toUpperCase();
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function safe(url) {
    const value = String(url || '#');
    if (value === '#') return '#';
    if (/^https?:\/\//i.test(value) || /^[\w.-]+\.html(#.*)?$/i.test(value)) return esc(value);
    return '#';
  }

  function bindHeroParallax() {
    const heroCopy = $('.hero-copy');
    const heroServices = $('.hero-services');
    if (!heroCopy && !heroServices) return;

    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < 600) {
        if (heroCopy) {
          heroCopy.style.transform = `translateY(${scrolled * 0.12}px)`;
          heroCopy.style.opacity = `${1 - scrolled * 0.0018}`;
        }
        if (heroServices) {
          heroServices.style.transform = `translateY(${scrolled * 0.06}px)`;
          heroServices.style.opacity = `${1 - scrolled * 0.0012}`;
        }
      }
    }, { passive: true });
  }

  function bindRippleEffects() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('.button, .category-card, .filter-tabs button, .faq-item button, .job-card .button');
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
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.className = 'ripple';

      const oldRipple = btn.querySelector('.ripple');
      if (oldRipple) oldRipple.remove();

      btn.appendChild(circle);
      circle.addEventListener('animationend', () => circle.remove());
    });
  }
});
