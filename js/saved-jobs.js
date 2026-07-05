(() => {
  'use strict';

  // We want to export helpers globally
  window.SavedJobs = {
    get() {
      try {
        return JSON.parse(localStorage.getItem('savedJobs') || '[]');
      } catch (_) {
        return [];
      }
    },
    
    save(id, page, name) {
      const list = this.get();
      if (!list.some(item => item.id === id && item.page === page)) {
        list.push({ id, page, name });
        try {
          localStorage.setItem('savedJobs', JSON.stringify(list));
        } catch (_) {}
      }
    },
    
    remove(id, page) {
      const list = this.get().filter(item => !(item.id === id && item.page === page));
      try {
        localStorage.setItem('savedJobs', JSON.stringify(list));
      } catch (_) {}
    },
    
    has(id, page) {
      return this.get().some(item => item.id === id && item.page === page);
    },
    
    getCompanyId(entry) {
      if (entry.id) {
        const sluggedCompany = this.slug(entry.company);
        if (entry.id.startsWith(sluggedCompany)) {
          return sluggedCompany;
        }
      }
      
      const logo = entry.logo || '';
      const parts = logo.split('/');
      const filename = parts[parts.length - 1];
      const dotIndex = filename.indexOf('.');
      const base = dotIndex === -1 ? filename : filename.substring(0, dotIndex);
      if (base && base !== 'default') return base.toLowerCase();
      
      return this.slug(entry.company);
    },
    
    getCompanyName(company) {
      return (company || '').replace(/\s+(Corporation|Corp|Ltd|Limited|Inc|Co\.)/gi, '').trim();
    },
    
    slug(str) {
      return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
  };
})();
