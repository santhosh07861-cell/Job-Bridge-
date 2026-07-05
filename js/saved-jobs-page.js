import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';

function debounce(fn, wait) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  // setupMobileNav(); // Centralized in auth.js to avoid duplicate event listeners

  const el = {
    // Search Inputs
    searchCompany: document.getElementById('searchCompany'),
    searchRole: document.getElementById('searchRole'),
    searchQual: document.getElementById('searchQual'),
    searchSkills: document.getElementById('searchSkills'),
    
    // Filters & Sorting
    categoryFilterGroup: document.getElementById('categoryFilterGroup'),
    sortDropdown: document.getElementById('sortDropdown'),
    
    // Grids & Sections
    govSection: document.getElementById('govSection'),
    govGrid: document.getElementById('govGrid'),
    govCount: document.getElementById('govCount'),
    
    itSection: document.getElementById('itSection'),
    itGrid: document.getElementById('itGrid'),
    itCount: document.getElementById('itCount'),
    
    mfgSection: document.getElementById('mfgSection'),
    mfgGrid: document.getElementById('mfgGrid'),
    mfgCount: document.getElementById('mfgCount'),
    
    // Empty state
    emptyWorkspaceBoard: document.getElementById('emptyWorkspaceBoard')
  };

  let allSavedJobs = [];
  let currentCategory = 'all';

  // Auth observer
  onAuthStateChanged(auth, (user) => {
    if (!user) return; // auth.js will handle redirect to login.html

    // Show skeletons while loading data
    if (window.SavedJobs && !window.SavedJobs.isInitialized) {
      renderLoadingSkeletons();
    }

    // Setup SavedJobs database update subscription
    if (window.SavedJobs) {
      window.SavedJobs.addListener((list) => {
        allSavedJobs = list;
        applyFiltersAndRender();
      });
    }
  });

  // Event listeners for searching & sorting
  const inputs = [el.searchCompany, el.searchRole, el.searchQual, el.searchSkills];
  inputs.forEach(input => {
    if (input) input.addEventListener('input', debounce(applyFiltersAndRender, 150));
  });

  if (el.sortDropdown) {
    el.sortDropdown.addEventListener('change', applyFiltersAndRender);
  }

  if (el.categoryFilterGroup) {
    el.categoryFilterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-pill');
      if (!btn) return;

      el.categoryFilterGroup.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      applyFiltersAndRender();
    });
  }

  function applyFiltersAndRender() {
    if (window.SavedJobs && !window.SavedJobs.isInitialized) {
      return;
    }

    // Update stats grid counters
    updateStatsCounters();

    const qCompany = el.searchCompany.value.trim().toLowerCase();
    const qRole = el.searchRole.value.trim().toLowerCase();
    const qQual = el.searchQual.value.trim().toLowerCase();
    const qSkills = el.searchSkills.value.trim().toLowerCase();

    // 1. Filter jobs
    let filtered = allSavedJobs.filter(job => {
      // Category filter
      if (currentCategory !== 'all' && job.page !== currentCategory) {
        return false;
      }

      // Text searches
      if (qCompany && !job.company.toLowerCase().includes(qCompany)) return false;
      if (qRole && !job.role.toLowerCase().includes(qRole)) return false;
      if (qQual && !job.qualification.toLowerCase().includes(qQual)) return false;
      
      if (qSkills) {
        const skillsString = (job.skills || []).join(' ').toLowerCase();
        if (!skillsString.includes(qSkills)) return false;
      }

      return true;
    });

    // 2. Sort jobs
    const sortBy = el.sortDropdown ? el.sortDropdown.value : 'newest';
    filtered.sort((a, b) => {
      const dateA = new Date(a.savedAt || 0).getTime();
      const dateB = new Date(b.savedAt || 0).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // 3. Separate into sections
    const govJobs = filtered.filter(j => j.page === 'government');
    const itJobs = filtered.filter(j => j.page === 'private-it');
    const mfgJobs = filtered.filter(j => j.page === 'manufacturing');

    // 4. Render sections
    renderCategorySection(govJobs, el.govSection, el.govGrid, el.govCount, makeGovCard);
    renderCategorySection(itJobs, el.itSection, el.itGrid, el.itCount, makeItCard);
    renderCategorySection(mfgJobs, el.mfgSection, el.mfgGrid, el.mfgCount, makeMfgCard);

    // 5. Update Empty State visibility
    const totalRenderedCount = filtered.length;
    if (totalRenderedCount === 0) {
      el.emptyWorkspaceBoard.classList.add('visible');
    } else {
      el.emptyWorkspaceBoard.classList.remove('visible');
    }

    // Attach bookmark removal action triggers
    attachRemoveTriggers();
  }

  function renderCategorySection(jobsList, sectionEl, gridEl, countEl, cardGenerator) {
    if (jobsList.length > 0) {
      sectionEl.classList.add('visible');
      gridEl.innerHTML = jobsList.map(cardGenerator).join('');
      countEl.textContent = jobsList.length;
    } else {
      sectionEl.classList.remove('visible');
      gridEl.innerHTML = '';
      countEl.textContent = '0';
    }
  }

  function attachRemoveTriggers() {
    // 1. Regular bookmark button clicks
    document.querySelectorAll('.bookmark-button[data-save]').forEach(btn => {
      if (!btn.dataset.pageListenerAttached) {
        btn.dataset.pageListenerAttached = 'true';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const jobId = btn.getAttribute('data-save');
          animateRemoveCard(btn, jobId);
        });
      }
    });

    // 2. Trash can button clicks
    document.querySelectorAll('.remove-bookmark-btn[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jobId = btn.getAttribute('data-remove');
        animateRemoveCard(btn, jobId);
      });
    });
  }

  function animateRemoveCard(triggerBtn, jobId) {
    const card = triggerBtn.closest('article');
    if (card) {
      // Modern slide + scale fadeout transition
      card.style.transition = 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9) translateY(12px)';
      card.addEventListener('transitionend', () => {
        if (window.SavedJobs) {
          window.SavedJobs.remove(jobId);
        }
      }, { once: true });
    } else {
      if (window.SavedJobs) {
        window.SavedJobs.remove(jobId);
      }
    }
  }

  /* HTML Card Template Renderers matching original subpage layout code */

  function logoToSrc(logo, company) {
    if (!logo) return logoFallbackDataUrl(company);
    if (logo.includes('/') || logo.startsWith('data:')) return logo;
    return `assets/logos/${logo}`;
  }

  function makeGovCard(org) {
    const links = (org.rawData.links || []).slice(0, 6).map(link => `
      <a class="official-link-chip" href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">
        <span>${escapeHTML(link.label)}</span>
        <b>Official Source</b>
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>`).join('');
      
    return `<article class="job-card" id="org-${escapeHTML(org.id)}">
      <div class="job-card-top">
        <div class="job-heading">
          <span class="job-logo" style="--card-color:${org.rawData.color || '#2563eb'}">${escapeHTML(org.logo)}</span>
          <div>
            <span class="official-badge"><i class="fa-solid fa-circle-check"></i> Official Source</span>
            <h2>${highlight(org.company, el.searchCompany?.value)}</h2>
            <span class="department">${highlight(org.role, el.searchRole?.value)}</span>
          </div>
        </div>
        <button class="bookmark-button saved" 
                type="button" 
                data-save="${org.id}" 
                data-page="government"
                data-tooltip="Saved"
                aria-label="Remove from saved">
          <i class="fa-solid fa-bookmark"></i>
        </button>
      </div>
      <div class="job-details-grid">
        <div class="job-detail"><span>Category</span><strong>${escapeHTML(org.category)}</strong></div>
        <div class="job-detail"><span>Organization</span><strong>${highlight(org.company, el.searchCompany?.value)}</strong></div>
        <div class="job-detail"><span>Qualification</span><strong>${highlight(org.qualification, el.searchQual?.value)}</strong></div>
        <div class="job-detail"><span>Official Website</span><strong>${domainLabel(org.officialWebsite)}</strong></div>
      </div>
      <div class="official-link-grid">${links}</div>
      <div class="job-card-bottom">
        <div class="job-tags"><span>${escapeHTML(org.category)}</span><span>${(org.rawData.links || []).length} official links</span></div>
        <div class="actions">
          <a class="apply" href="${escapeHTML(org.applyLink)}" target="_blank" rel="noopener noreferrer">Visit Official Portal <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          <button class="ghost-btn remove-bookmark-btn" data-remove="${org.id}"><i class="fa-solid fa-trash-can"></i> Remove Bookmark</button>
        </div>
      </div>
    </article>`;
  }

  function makeItCard(entry) {
    const logoSrc = logoToSrc(entry.logo, entry.company);
    if (entry.role === 'Official Career Portal') {
      // Company card layout
      return `
        <article class="company-card" data-company-name="${escapeHTML(entry.company)}" style="position:relative !important;">
          <button class="bookmark-button saved" 
                  type="button" 
                  data-save="${entry.id}" 
                  data-page="private-it" 
                  data-tooltip="Saved"
                  aria-label="Remove from saved">
            <i class="fa-solid fa-bookmark"></i>
          </button>
          <div class="logo-wrap logo-wrap-lg">
            <img src="${escapeHTML(logoSrc)}" loading="lazy" alt="${escapeHTML(entry.company)} logo" onerror="this.onerror=null;this.src=createLogoDataUrl('${escapeHTML(entry.company)}')">
          </div>
          <b>${highlight(entry.company, el.searchCompany?.value)}</b>
          <span class="verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified</span>
          <div class="actions">
            <a class="apply career-btn" href="${escapeHTML(entry.applyLink)}" target="_blank" rel="noopener" aria-label="Visit ${escapeHTML(entry.company)} official career portal">
              Visit Career Portal <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </a>
            <button class="ghost-btn remove-bookmark-btn" data-remove="${entry.id}">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Remove Bookmark
            </button>
          </div>
        </article>
      `;
    } else {
      // Standard IT job card layout
      return `
        <article class="job-card" style="position:relative !important;">
          <button class="bookmark-button saved" 
                  type="button" 
                  data-save="${entry.id}" 
                  data-page="private-it" 
                  data-tooltip="Saved"
                  aria-label="Remove from saved">
            <i class="fa-solid fa-bookmark"></i>
          </button>
          <div class="job-main">
            <div class="logo-wrap">
              <img src="${escapeHTML(logoSrc)}" loading="lazy" alt="${escapeHTML(entry.company)} logo" onerror="this.onerror=null;this.src=createLogoDataUrl('${escapeHTML(entry.company)}')">
            </div>
            <div class="job-copy">
              <h3>${highlight(entry.company, el.searchCompany?.value)}</h3>
              <p style="margin: 4px 0 0 0; font-size:14px; font-weight:600; color:var(--text);">${highlight(entry.role, el.searchRole?.value)}</p>
              <span class="verified-badge" style="margin-top: 6px;"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified</span>
            </div>
          </div>
          <div class="actions">
            <a class="apply career-btn" href="${escapeHTML(entry.applyLink)}" target="_blank" rel="noopener">
              Visit Career Portal <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </a>
            <button class="ghost-btn remove-bookmark-btn" data-remove="${entry.id}">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Remove Bookmark
            </button>
          </div>
        </article>
      `;
    }
  }

  function makeMfgCard(j) {
    const logoSrc = logoToSrc(j.logo, j.company);
    const skills = (j.skills || []).slice(0, 6).map(s => `<span class="skill">${escapeHTML(s)}</span>`).join(' ');
    return `
      <article class="job-card">
        <button class="bookmark-button saved" 
                type="button" 
                data-save="${j.id}" 
                data-page="manufacturing" 
                data-tooltip="Saved"
                aria-label="Remove from saved">
          <i class="fa-solid fa-bookmark"></i>
        </button>
        <div class="logo"><img src="${escapeHTML(logoSrc)}" alt="${escapeHTML(j.company)} logo" onerror="this.onerror=null;this.src='${escapeHTML(logoFallbackDataUrl(j.company))}'"/></div>
        <div class="details">
          <p class="company-name">${highlight(j.company, el.searchCompany?.value)}</p>
          <h3>${highlight(j.role, el.searchRole?.value)}</h3>
          <div class="job-facts">
            <span><strong>Experience</strong>${escapeHTML(j.experience)}</span>
            <span><strong>Qualification</strong>${highlight(j.qualification, el.searchQual?.value)}</span>
          </div>
          <div class="skills">${skills}</div>
        </div>
        <div class="actions">
          <div class="mfg-links-row">
            <a class="apply" href="${escapeHTML(j.applyLink)}" target="_blank" rel="noopener">Apply Now <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            <a class="official" href="${escapeHTML(j.officialWebsite)}" target="_blank" rel="noopener">Official Careers <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          </div>
          <button class="ghost-btn remove-bookmark-btn" data-remove="${j.id}">
            <i class="fa-solid fa-trash-can"></i> Remove Bookmark
          </button>
        </div>
      </article>
    `;
  }

  /* Utility functions */

  function escapeHTML(value) {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlight(text, query) {
    const escapedText = escapeHTML(text);
    if (!query || !query.trim()) return escapedText;
    const escapedQuery = escapeHTML(query.trim()).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function domainLabel(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch (_) {
      return 'Official website';
    }
  }

  function createLogoDataUrl(name) {
    const letters = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#092036"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="36" fill="#7dd3fc">${letters}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function logoFallbackDataUrl(company) {
    const initials = (company || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='100%' height='100%' fill='#092036'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial' font-size='96' fill='#7dd3fc'>${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // Theme management
  function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const getTheme = () => localStorage.getItem('jb-theme') || 'dark';
    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.dataset.theme = theme;
      if (themeToggle) {
        const isDark = theme === 'dark';
        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        const icon = themeToggle.querySelector('i');
        if (icon) {
          icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
      }
    };

    applyTheme(getTheme());

    window.addEventListener('themechanged', (e) => {
      applyTheme(e.detail.theme);
    });
  }

  // Skeleton loaders
  function renderLoadingSkeletons() {
    el.govSection.classList.add('visible');
    el.itSection.classList.add('visible');
    el.mfgSection.classList.add('visible');

    el.govCount.textContent = '...';
    el.itCount.textContent = '...';
    el.mfgCount.textContent = '...';

    renderSkeletonsInGrid(el.govGrid, 3);
    renderSkeletonsInGrid(el.itGrid, 3);
    renderSkeletonsInGrid(el.mfgGrid, 3);

    el.emptyWorkspaceBoard.classList.remove('visible');
  }

  function renderSkeletonsInGrid(gridEl, count = 3) {
    if (!gridEl) return;
    const skeletonHtml = Array(count).fill(`
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-logo skeleton-shimmer"></div>
          <div class="skeleton-header-info">
            <div class="skeleton-badge skeleton-shimmer"></div>
            <div class="skeleton-title skeleton-shimmer"></div>
          </div>
        </div>
        <div class="skeleton-subtitle skeleton-shimmer"></div>
        <div class="skeleton-divider"></div>
        <div class="skeleton-body">
          <div class="skeleton-line-long skeleton-shimmer"></div>
          <div class="skeleton-line-medium skeleton-shimmer"></div>
        </div>
        <div class="skeleton-footer">
          <div class="skeleton-btn skeleton-shimmer"></div>
          <div class="skeleton-btn skeleton-shimmer"></div>
        </div>
      </div>
    `).join('');
    gridEl.innerHTML = skeletonHtml;
  }

  // Statistics counters
  let lastStats = { total: 0, gov: 0, it: 0, mfg: 0 };

  function updateStatsCounters() {
    const total = allSavedJobs.length;
    const gov = allSavedJobs.filter(j => j.page === 'government').length;
    const it = allSavedJobs.filter(j => j.page === 'private-it').length;
    const mfg = allSavedJobs.filter(j => j.page === 'manufacturing').length;

    const elTotal = document.getElementById('statsTotal');
    const elGov = document.getElementById('statsGov');
    const elIt = document.getElementById('statsIt');
    const elMfg = document.getElementById('statsMfg');

    if (elTotal) animateValue(elTotal, lastStats.total, total, 400);
    if (elGov) animateValue(elGov, lastStats.gov, gov, 400);
    if (elIt) animateValue(elIt, lastStats.it, it, 400);
    if (elMfg) animateValue(elMfg, lastStats.mfg, mfg, 400);

    lastStats = { total, gov, it, mfg };
  }

  function animateValue(obj, start, end, duration) {
    if (start === end) {
      obj.textContent = end;
      return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.textContent = Math.floor(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        obj.textContent = end;
      }
    };
    window.requestAnimationFrame(step);
  }

  // Mobile Navigation toggle is centralized in auth.js to avoid duplicate event listeners
  // function setupMobileNav() {
  //   const navToggle = document.getElementById('nav-toggle');
  //   const navLinks = document.getElementById('primary-menu');
  //   if (!navToggle || !navLinks) return;
  // 
  //   navToggle.addEventListener('click', () => {
  //     const open = navLinks.classList.toggle('open');
  //     navToggle.setAttribute('aria-expanded', String(open));
  //     navToggle.innerHTML = open 
  //       ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' 
  //       : '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
  //     document.body.classList.toggle('nav-open', open);
  //   });
  // }
});
