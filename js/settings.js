import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, sendPasswordResetEmail, deleteUser, signOut } from 'firebase/auth';
import { collection, doc, deleteDoc, getDocs } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', () => {
  const el = {
    // Switches & Inputs
    themeSwitch: document.getElementById('themeToggleSwitch'),
    notifSwitch: document.getElementById('notifToggleSwitch'),
    rememberSwitch: document.getElementById('rememberToggleSwitch'),
    languageSelect: document.getElementById('languageSelect'),
    
    // Account details
    secName: document.getElementById('secName'),
    secEmail: document.getElementById('secEmail'),
    passwordDesc: document.getElementById('passwordDesc'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    
    // Modals & Triggers
    deleteModal: document.getElementById('deleteConfirmModal'),
    openDeleteBtn: document.getElementById('openDeleteModalBtn'),
    closeDeleteBtn: document.getElementById('closeDeleteModalBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteModalBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    
    // Navigation
    sidebarLinks: document.querySelectorAll('.sidebar-link')
  };

  // Auth observer
  onAuthStateChanged(auth, (user) => {
    if (!user) return; // auth.js will handle redirect to login.html

    // Load account details
    el.secName.textContent = user.displayName || 'JobBridge Candidate';
    el.secEmail.textContent = user.email;

    // Check login provider details
    const provider = user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'password';
    if (provider === 'google.com') {
      el.passwordDesc.textContent = 'Password is managed by your Google Account.';
      el.changePasswordBtn.disabled = true;
      el.changePasswordBtn.style.opacity = '0.5';
      el.changePasswordBtn.style.cursor = 'not-allowed';
      el.changePasswordBtn.title = 'Managed by Google Single Sign-In';
    } else {
      el.passwordDesc.textContent = 'Recover or edit password verification details via email reset link.';
      el.changePasswordBtn.disabled = false;
      el.changePasswordBtn.style.opacity = '';
      el.changePasswordBtn.style.cursor = '';
    }
  });

  // 1. Sync theme switch state
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  if (el.themeSwitch) {
    el.themeSwitch.checked = currentTheme === 'light';
    el.themeSwitch.addEventListener('change', () => {
      const nextTheme = el.themeSwitch.checked ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem('jb-theme', nextTheme);
      
      // Dispatch theme changed event centrally
      window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: nextTheme } }));
      
      // Sync other page elements theme toggles if present
      const themeBtn = document.getElementById('theme-toggle');
      if (themeBtn) {
        const isDark = nextTheme === 'dark';
        themeBtn.setAttribute('aria-pressed', String(isDark));
        const icon = themeBtn.querySelector('i');
        if (icon) {
          icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
      }
    });

    window.addEventListener('themechanged', (e) => {
      el.themeSwitch.checked = e.detail.theme === 'light';
    });
  }

  // 2. Load other local storage preferences
  if (el.notifSwitch) {
    el.notifSwitch.checked = localStorage.getItem('jb-pref-notifications') !== 'false';
    el.notifSwitch.addEventListener('change', () => {
      localStorage.setItem('jb-pref-notifications', el.notifSwitch.checked);
      toastMessage('Notification preferences saved', 'success');
    });
  }

  if (el.rememberSwitch) {
    el.rememberSwitch.checked = localStorage.getItem('jb-remember-email') !== null;
    el.rememberSwitch.addEventListener('change', () => {
      if (el.rememberSwitch.checked) {
        if (auth.currentUser) {
          localStorage.setItem('jb-remember-email', auth.currentUser.email);
        }
      } else {
        localStorage.removeItem('jb-remember-email');
      }
      toastMessage('Remember Me setting updated', 'success');
    });
  }

  if (el.languageSelect) {
    el.languageSelect.value = localStorage.getItem('jb-pref-lang') || 'en';
    el.languageSelect.addEventListener('change', () => {
      localStorage.setItem('jb-pref-lang', el.languageSelect.value);
      toastMessage('Language preference updated', 'success');
    });
  }

  // 3. Reset Password Email flow
  if (el.changePasswordBtn) {
    el.changePasswordBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user || !user.email) return;

      el.changePasswordBtn.disabled = true;
      const oldText = el.changePasswordBtn.innerHTML;
      el.changePasswordBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Resetting...`;

      try {
        await sendPasswordResetEmail(auth, user.email);
        toastMessage('Password reset link successfully sent to your email!', 'success');
      } catch (err) {
        console.error('Password reset error:', err);
        toastMessage('Failed to trigger reset email. Try again later.', 'error');
      } finally {
        el.changePasswordBtn.disabled = false;
        el.changePasswordBtn.innerHTML = oldText;
      }
    });
  }

  // 4. Sidebar links scrolling
  el.sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      el.sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const targetId = `section-${link.getAttribute('data-section')}`;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // 5. Delete Account Flow Modals
  const openDeleteModal = () => {
    if (typeof el.deleteModal.showModal === 'function') el.deleteModal.showModal();
    else el.deleteModal.setAttribute('open', '');
  };

  const closeDeleteModal = () => {
    if (typeof el.deleteModal.close === 'function') el.deleteModal.close();
    else el.deleteModal.removeAttribute('open');
  };

  if (el.openDeleteBtn) el.openDeleteBtn.addEventListener('click', openDeleteModal);
  if (el.closeDeleteBtn) el.closeDeleteBtn.addEventListener('click', closeDeleteModal);
  if (el.cancelDeleteBtn) el.cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  // Confirm delete operation
  if (el.confirmDeleteBtn) {
    el.confirmDeleteBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return;

      el.confirmDeleteBtn.disabled = true;
      el.confirmDeleteBtn.textContent = 'Deleting...';

      try {
        // Step A: Clear user's bookmarks in Firestore database
        const colRef = collection(db, 'users', user.uid, 'savedJobs');
        const snapshot = await getDocs(colRef);
        const deletePromises = [];
        snapshot.forEach(docSnap => {
          deletePromises.push(deleteDoc(doc(db, 'users', user.uid, 'savedJobs', docSnap.id)));
        });
        await Promise.all(deletePromises);

        // Step B: Delete auth user credentials
        await deleteUser(user);

        // Success redirection
        toastMessage('Account deleted successfully. Redirection...', 'success');
        setTimeout(() => {
          window.location.replace('index.html');
        }, 1500);

      } catch (err) {
        console.error('Delete account error:', err);
        closeDeleteModal();
        el.confirmDeleteBtn.disabled = false;
        el.confirmDeleteBtn.textContent = 'Delete Permanently';

        if (err.code === 'auth/requires-recent-login') {
          toastMessage('This action requires recent login verification. Please log out, sign in again, and retry.', 'error');
        } else {
          toastMessage('Account deletion failed. Please contact support.', 'error');
        }
      }
    });
  }

  // Toast Helper
  function toastMessage(msg, type = 'success') {
    if (window.SavedJobs && window.SavedJobs.toast) {
      window.SavedJobs.toast(msg, type);
    } else {
      console.log(`[Toast] [${type}] ${msg}`);
    }
  }
});
