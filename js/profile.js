import { auth } from './firebase-config.js';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';

const GRADIENS = [
  ['#FF5F6D', '#FFC371'], // Sunset
  ['#2193b0', '#6dd5ed'], // Ocean
  ['#11998e', '#38ef7d'], // Emerald
  ['#7F00FF', '#E100FF'], // Royal
  ['#ff007f', '#7f00ff'], // Pink-Purple
  ['#1e3c72', '#2a5298'], // Navy Blue
  ['#f12711', '#f5af19'], // Fire
  ['#4568DC', '#B06AB8']  // Lavender
];

function getGradientAvatar(color1, color2, letter) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#avatarGrad)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="44" fill="#ffffff">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const el = {
    avatarDisplay: document.getElementById('profileAvatarDisplay'),
    displayName: document.getElementById('profileDisplayName'),
    email: document.getElementById('profileEmail'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    providerName: document.getElementById('providerName'),
    creationDate: document.getElementById('creationDate'),
    lastLoginDate: document.getElementById('lastLoginDate'),
    totalSavedCount: document.getElementById('totalSavedCount'),
    completionPercent: document.getElementById('completionPercent'),
    completionProgress: document.getElementById('completionProgress'),
    statusTextEmail: document.getElementById('statusTextEmail'),
    statusBulletEmail: document.getElementById('statusBulletEmail'),
    
    // Modal
    modal: document.getElementById('editProfileModal'),
    editBtn: document.getElementById('editProfileBtn'),
    editAvatarBtn: document.getElementById('editAvatarBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    editForm: document.getElementById('editProfileForm'),
    inputName: document.getElementById('inputName'),
    inputAvatarUrl: document.getElementById('inputAvatarUrl'),
    avatarSelectorGrid: document.getElementById('avatarSelectorGrid')
  };

  let selectedAvatarVal = '';

  // Auth observer
  onAuthStateChanged(auth, (user) => {
    if (!user) return; // auth.js will handle redirect to login.html

    renderProfile(user);

    // Setup SavedJobs list listener
    if (window.SavedJobs) {
      window.SavedJobs.addListener((list) => {
        el.totalSavedCount.textContent = `${list.length} Job${list.length === 1 ? '' : 's'}`;
        updateProfileCompletion(user, list.length);
      });
    }
  });

  function renderProfile(user) {
    const letter = user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U');
    
    // Render avatar
    if (user.photoURL) {
      el.avatarDisplay.innerHTML = `<img src="${user.photoURL}" alt="Profile avatar">`;
    } else {
      el.avatarDisplay.innerHTML = letter;
      el.avatarDisplay.style.background = 'linear-gradient(135deg, var(--brand), var(--brand-2))';
    }

    el.displayName.textContent = user.displayName || 'JobBridge Candidate';
    el.email.textContent = user.email;
    el.welcomeTitle.textContent = `Welcome, ${user.displayName ? user.displayName.split(' ')[0] : 'Candidate'}!`;

    // Provider check
    const provider = user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'password';
    if (provider === 'google.com') {
      el.providerName.innerHTML = `<i class="fa-brands fa-google" style="color: #4f8cff; margin-right: 6px;"></i> Google Account`;
    } else {
      el.providerName.innerHTML = `<i class="fa-solid fa-envelope" style="color: #9b5cff; margin-right: 6px;"></i> Email & Password`;
    }

    // Dates formatting
    const created = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '---';
    const lastLogin = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '---';
    
    el.creationDate.textContent = created;
    el.lastLoginDate.textContent = lastLogin;

    // Email status verification
    if (user.emailVerified) {
      el.statusBulletEmail.style.background = '#20d488';
      el.statusTextEmail.textContent = 'Your candidate email address has been verified.';
    } else {
      el.statusBulletEmail.style.background = '#f59e0b';
      el.statusTextEmail.textContent = 'Your email is unverified. Please check your inbox for verification links.';
    }

    // Modal populate inputs
    el.inputName.value = user.displayName || '';
    el.inputAvatarUrl.value = user.photoURL || '';
    selectedAvatarVal = user.photoURL || '';

    // Render presets selector
    renderPresetAvatars(letter);
  }

  function renderPresetAvatars(letter) {
    el.avatarSelectorGrid.innerHTML = '';
    GRADIENS.forEach((colors, index) => {
      const src = getGradientAvatar(colors[0], colors[1], letter);
      const option = document.createElement('div');
      option.className = `avatar-option ${selectedAvatarVal === src ? 'selected' : ''}`;
      option.innerHTML = `<img src="${src}" alt="Gradient Option ${index + 1}">`;
      option.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedAvatarVal = src;
        el.inputAvatarUrl.value = ''; // Clear custom URL field
      });
      el.avatarSelectorGrid.appendChild(option);
    });
  }

  // Handle manual input in custom URL field
  el.inputAvatarUrl.addEventListener('input', () => {
    if (el.inputAvatarUrl.value) {
      document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
      selectedAvatarVal = el.inputAvatarUrl.value;
    }
  });

  function updateProfileCompletion(user, savedCount) {
    let score = 0;
    if (user.displayName) score += 25;
    if (user.emailVerified) score += 25;
    if (user.photoURL) score += 25;
    if (savedCount > 0) score += 25;

    el.completionPercent.textContent = `${score}%`;
    el.completionProgress.style.width = `${score}%`;
  }

  // Modal Actions
  const openModal = () => {
    if (typeof el.modal.showModal === 'function') el.modal.showModal();
    else el.modal.setAttribute('open', '');
  };

  const closeModal = () => {
    if (typeof el.modal.close === 'function') el.modal.close();
    else el.modal.removeAttribute('open');
  };

  el.editBtn.addEventListener('click', openModal);
  el.editAvatarBtn.addEventListener('click', openModal);
  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelModalBtn.addEventListener('click', closeModal);

  el.editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');
    const oldText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    btn.disabled = true;

    const name = el.inputName.value.trim();
    const finalPhoto = el.inputAvatarUrl.value.trim() || selectedAvatarVal;

    try {
      await updateProfile(auth.currentUser, {
        displayName: name,
        photoURL: finalPhoto
      });

      if (window.SavedJobs && window.SavedJobs.toast) {
        window.SavedJobs.toast('Candidate profile updated successfully', 'success');
      }

      // Manually trigger local UI updates
      renderProfile(auth.currentUser);

      // Also sync navbar layout
      const navLetter = document.getElementById('userAvatarLetter');
      if (navLetter) {
        if (finalPhoto) {
          navLetter.innerHTML = `<img src="${finalPhoto}" alt="User Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
          const letter = name.charAt(0).toUpperCase() || 'U';
          navLetter.textContent = letter;
        }
      }

      closeModal();
    } catch (err) {
      console.error('Error updating profile:', err);
      if (window.SavedJobs && window.SavedJobs.toast) {
        window.SavedJobs.toast('Failed to save profile changes', 'error');
      }
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  });

  // Setup background floating particles on dashboard too
  const container = document.getElementById('particles');
  if (container) {
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 15}s`;
      p.style.animationDuration = `${10 + Math.random() * 12}s`;
      p.style.opacity = `${0.04 + Math.random() * 0.12}`;
      p.style.transform = `scale(${0.6 + Math.random() * 1.0})`;
      container.appendChild(p);
    }
  }
});
