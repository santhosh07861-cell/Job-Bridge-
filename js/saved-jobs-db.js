import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

// Shared real-time state
const SavedJobs = {
  cache: new Map(), // jobId -> jobData
  listeners: new Set(),
  isInitialized: false,

  // Add listener for cache updates
  addListener(callback) {
    this.listeners.add(callback);
    if (this.isInitialized) {
      callback(Array.from(this.cache.values()));
    }
  },

  removeListener(callback) {
    this.listeners.delete(callback);
  },

  notifyListeners() {
    const list = Array.from(this.cache.values());
    this.listeners.forEach(callback => {
      try { callback(list); } catch (e) { console.error(e); }
    });
  },

  get() {
    return Array.from(this.cache.values());
  },

  has(jobId, page = null) {
    const idStr = String(jobId);
    if (page) {
      const item = this.cache.get(idStr);
      return !!(item && item.page === page);
    }
    return this.cache.has(idStr);
  },

  async toggle(jobData) {
    if (!auth.currentUser) {
      this.showLoginToast();
      return;
    }

    const userId = auth.currentUser.uid;
    const jobId = String(jobData.id);
    const isSaved = this.has(jobId);

    try {
      const docRef = doc(db, 'users', userId, 'savedJobs', jobId);
      if (isSaved) {
        // Remove from Firestore
        await deleteDoc(docRef);

        // Success: Update cache and sync UI/toast
        this.cache.delete(jobId);
        this.syncPageButtons();
        this.updateLiveCounters();
        this.notifyListeners();
        this.toast('Bookmark removed successfully', 'info');
      } else {
        // Save to Firestore
        const dataToSave = {
          id: jobData.id,
          company: jobData.company || '',
          role: jobData.role || '',
          category: jobData.category || '',
          page: jobData.page || '',
          qualification: jobData.qualification || '',
          experience: jobData.experience || '',
          skills: Array.isArray(jobData.skills) ? jobData.skills : [],
          logo: jobData.logo || '',
          officialWebsite: jobData.officialWebsite || '',
          applyLink: jobData.applyLink || '',
          savedAt: new Date().toISOString(),
          rawData: jobData.rawData ? JSON.parse(JSON.stringify(jobData.rawData)) : {}
        };
        await setDoc(docRef, dataToSave);

        // Success: Update cache and sync UI/toast
        this.cache.set(jobId, dataToSave);
        this.syncPageButtons();
        this.updateLiveCounters();
        this.notifyListeners();
        this.toast('Bookmark added successfully', 'success');
      }
    } catch (error) {
      console.error('Error toggling bookmark in Firestore:', error);

      // Error: Cache, UI, and counters are NOT modified. Display detailed error.
      const errorCode = error.code || 'unknown';
      const errorMessage = error.message || error.toString();
      this.toast(`Failed to update bookmark: [${errorCode}] ${errorMessage}`, 'error');
    }
  },

  async remove(jobId) {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const jobIdStr = String(jobId);

    try {
      const docRef = doc(db, 'users', userId, 'savedJobs', jobIdStr);
      await deleteDoc(docRef);

      // Success: Update cache and sync UI/toast
      this.cache.delete(jobIdStr);
      this.syncPageButtons();
      this.updateLiveCounters();
      this.notifyListeners();
      this.toast('Bookmark removed successfully', 'info');
    } catch (error) {
      console.error('Error removing bookmark from Firestore:', error);

      // Error: Cache, UI, and counters are NOT modified. Display detailed error.
      const errorCode = error.code || 'unknown';
      const errorMessage = error.message || error.toString();
      this.toast(`Failed to remove bookmark: [${errorCode}] ${errorMessage}`, 'error');
    }
  },

  // UI helper: Sync all bookmark buttons on the page
  syncPageButtons() {
    const buttons = document.querySelectorAll('.bookmark-button[data-save]');
    buttons.forEach(btn => {
      const id = btn.getAttribute('data-save');
      const isSaved = this.has(id);
      
      // Update UI classes
      const wasSaved = btn.classList.contains('saved');
      btn.classList.toggle('saved', isSaved);
      btn.setAttribute('data-tooltip', isSaved ? 'Saved' : 'Save');
      btn.setAttribute('aria-label', isSaved ? 'Remove from saved' : 'Save to saved');
      
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
      }

      // If state changed, trigger the pop animation
      if (wasSaved !== isSaved && btn.classList.contains('bookmark-button')) {
        btn.classList.add('pop');
        btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
      }

      // Setup ripple trigger if not set
      if (!btn.dataset.rippleAttached) {
        btn.dataset.rippleAttached = 'true';
        btn.addEventListener('click', (e) => this.setupRipple(e));
      }
    });
  },

  // Setup click ripple animation
  setupRipple(event) {
    const btn = event.currentTarget;
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
  },

  // Update navbar/footer counts
  updateLiveCounters() {
    const count = this.cache.size;
    const countElements = document.querySelectorAll('#saved-count, #savedCount, #sidebar-saved-count, #dropdownSavedCount');
    countElements.forEach(el => {
      const currentCount = parseInt(el.textContent) || 0;
      el.textContent = count;
      
      // Animate if changed
      if (currentCount !== count) {
        el.classList.add('count-pop');
        el.addEventListener('animationend', () => el.classList.remove('count-pop'), { once: true });
      }
    });
  },

  // Fallback toast system
  toast(message, type = 'success') {
    // Attempt to use auth.js showAlert or custom toast-region
    const banner = document.getElementById('alertBanner');
    if (banner) {
      // Use auth.js showAlert globally if page imports auth.js
      const alertMsg = document.getElementById('alertMessage');
      const alertIcon = document.getElementById('alertIcon');
      if (alertMsg && alertIcon) {
        alertMsg.textContent = message;
        banner.className = `alert-banner show alert-banner-${type === 'info' ? 'success' : type}`;
        alertIcon.className = type === 'error' 
          ? 'fa-solid fa-circle-exclamation' 
          : 'fa-solid fa-circle-check';
        setTimeout(() => banner.classList.remove('show'), 4000);
        return;
      }
    }

    // Try government toast
    const toastRegion = document.getElementById('toast-region');
    if (toastRegion) {
      const bubble = document.createElement('div');
      bubble.className = `toast bubble-${type === 'error' ? 'error' : 'success'}`;
      bubble.textContent = message;
      toastRegion.appendChild(bubble);
      setTimeout(() => bubble.remove(), 4000);
      return;
    }

    // Standard fallback UI toast
    const container = document.body;
    let toastEl = document.getElementById('jb-global-toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'jb-global-toast';
      toastEl.style.position = 'fixed';
      toastEl.style.bottom = '24px';
      toastEl.style.right = '24px';
      toastEl.style.zIndex = '10000';
      toastEl.style.background = 'var(--surface-solid, #111827)';
      toastEl.style.color = '#fff';
      toastEl.style.padding = '12px 20px';
      toastEl.style.borderRadius = '12px';
      toastEl.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
      toastEl.style.border = '1px solid var(--line-strong, rgba(125, 152, 255, 0.36))';
      toastEl.style.display = 'flex';
      toastEl.style.alignItems = 'center';
      toastEl.style.gap = '10px';
      toastEl.style.fontFamily = 'Inter, sans-serif';
      toastEl.style.fontSize = '14px';
      toastEl.style.fontWeight = '600';
      toastEl.style.transition = 'opacity 0.3s, transform 0.3s';
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(20px)';
      container.appendChild(toastEl);
    }

    const iconClass = type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
    const color = type === 'error' ? '#f43f5e' : (type === 'info' ? '#3b82f6' : '#10b981');
    toastEl.innerHTML = `<i class="${iconClass}" style="color: ${color}"></i> <span>${message}</span>`;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateY(0)';

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(20px)';
    }, 4000);
  },

  showLoginToast() {
    this.toast('Please sign in to bookmark jobs', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  },

  // Backwards compatible functions from original saved-jobs.js
  getCompanyId(entry) {
    if (entry.id) {
      const sluggedCompany = this.slug(entry.company);
      if (String(entry.id).startsWith(sluggedCompany)) {
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

// Firestore snapshot listener subscription
let unsubscribeSnapshot = null;

onAuthStateChanged(auth, (user) => {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  if (user) {
    const colRef = collection(db, 'users', user.uid, 'savedJobs');
    unsubscribeSnapshot = onSnapshot(colRef, (snapshot) => {
      SavedJobs.cache.clear();
      snapshot.forEach(doc => {
        SavedJobs.cache.set(doc.id, doc.data());
      });
      SavedJobs.isInitialized = true;
      
      // Notify elements
      SavedJobs.syncPageButtons();
      SavedJobs.updateLiveCounters();
      SavedJobs.notifyListeners();
    }, (error) => {
      console.error("Firestore sync error:", error);
      const errorCode = error.code || 'unknown';
      const errorMessage = error.message || error.toString();
      SavedJobs.toast(`Sync error: [${errorCode}] ${errorMessage}`, 'error');
    });
  } else {
    // Clear state
    SavedJobs.cache.clear();
    SavedJobs.isInitialized = true;
    SavedJobs.syncPageButtons();
    SavedJobs.updateLiveCounters();
    SavedJobs.notifyListeners();
  }
});

// Export globally
window.SavedJobs = SavedJobs;
export default SavedJobs;
export { SavedJobs };
