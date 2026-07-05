import app, { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  sendPasswordResetEmail, 
  onAuthStateChanged, 
  signOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

// DOM Caching
const el = {
  card: document.getElementById('authCard'),
  title: document.getElementById('authTitle'),
  subtitle: document.getElementById('authSubtitle'),
  slider: document.getElementById('formsSlider'),
  sliderWrap: document.getElementById('sliderWrap'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  resetForm: document.getElementById('resetForm'),
  
  // Navigation & Toggle elements
  gotoReset: document.getElementById('gotoResetBtn'),
  backToLogin: document.getElementById('backToLoginBtn'),
  themeToggle: document.getElementById('themeToggleBtn') || document.getElementById('theme-toggle'),
  googleLogin: document.getElementById('googleLoginBtn'),
  socialSection: document.getElementById('socialLoginSection'),
  
  // Footer switch
  switchFooter: document.getElementById('authSwitchFooter'),
  switchPrompt: document.getElementById('footerPrompt'),
  switchBtn: document.getElementById('authSwitchBtn'),
  
  // Alert box
  alertBanner: document.getElementById('alertBanner'),
  alertIcon: document.getElementById('alertIcon'),
  alertMsg: document.getElementById('alertMessage'),
  
  // Forms inputs
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  rememberMe: document.getElementById('rememberMe'),
  
  registerName: document.getElementById('registerName'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  registerConfirm: document.getElementById('registerConfirmPassword'),
  
  resetEmail: document.getElementById('resetEmail')
};

let currentMode = 'login';
let alertTimeout = null;

// Initializations
document.addEventListener('DOMContentLoaded', () => {
  initializeCachedAuthUI();
  setupTheme();
  setupParticles();
  setupRememberedEmail();
  initializeResponsiveNav();
  setupMobileNav();
  highlightActiveNavLink();
  
  // Check if we are on the login page (forms exist)
  if (el.loginForm && el.registerForm && el.resetForm) {
    setupFormNav();
    setupPasswordToggles();
    
    el.loginForm.addEventListener('submit', handleLogin);
    el.registerForm.addEventListener('submit', handleRegister);
    el.resetForm.addEventListener('submit', handlePasswordReset);
    if (el.googleLogin) el.googleLogin.addEventListener('click', handleGoogleLogin);
    
    // Handle responsive resizing
    window.addEventListener('resize', syncSliderHeight);

    // Calculate and set initial slider height
    setTimeout(syncSliderHeight, 150);
  } else {
    // We are on index.html (or another page)
    setupNavbarAuth();
  }
  
  // Firebase Auth Observer
  onAuthStateChanged(auth, (user) => {
    const signInBtn = document.getElementById('signInBtn');
    const avatarContainer = document.getElementById('userAvatarContainer');
    const avatarLetter = document.getElementById('userAvatarLetter');

    if (user) {
      localStorage.setItem('jb-auth-cached', 'true');
      localStorage.setItem('jb-user-email', user.email || '');
      localStorage.setItem('jb-user-name', user.displayName || '');
      localStorage.setItem('jb-user-photo', user.photoURL || '');
      document.documentElement.classList.add('auth-state-cached-in');
      document.documentElement.classList.remove('auth-state-cached-out');

      document.body.classList.add('user-logged-in');
      document.body.classList.remove('user-logged-out');

      // User is authenticated
      const path = window.location.pathname.toLowerCase();
      const isLoginPage = path.endsWith('login.html') || path.endsWith('/login') || path === 'login' || !!document.getElementById('loginForm');
      if (isLoginPage) {
        window.location.replace('index.html');
        return;
      }
      
      if (signInBtn) signInBtn.style.display = 'none';
      if (avatarContainer) {
        avatarContainer.style.display = 'inline-block';
        if (avatarLetter) {
          if (user.photoURL) {
            avatarLetter.innerHTML = `<img src="${user.photoURL}" alt="User Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
          } else {
            const letter = user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U');
            avatarLetter.textContent = letter;
          }
        }
      }
    } else {
      localStorage.setItem('jb-auth-cached', 'false');
      localStorage.removeItem('jb-user-email');
      localStorage.removeItem('jb-user-name');
      localStorage.removeItem('jb-user-photo');
      document.documentElement.classList.add('auth-state-cached-out');
      document.documentElement.classList.remove('auth-state-cached-in');

      document.body.classList.add('user-logged-out');
      document.body.classList.remove('user-logged-in');

      // User is not authenticated
      const path = window.location.pathname.toLowerCase();
      const securePages = ['profile.html', 'saved-jobs.html', 'settings.html', 'profile', 'saved-jobs', 'settings'];
      const isSecure = securePages.some(page => path.endsWith(page) || path.endsWith('/' + page));
      if (isSecure) {
        window.location.replace('login.html');
        return;
      }

      if (signInBtn) signInBtn.style.display = 'inline-flex';
      if (avatarContainer) avatarContainer.style.display = 'none';
    }

    // Sync mobile menu links
    updateMobileNavLinks(user);
  });
});

function initializeCachedAuthUI() {
  const cached = localStorage.getItem('jb-auth-cached') === 'true';
  const signInBtn = document.getElementById('signInBtn');
  const avatarContainer = document.getElementById('userAvatarContainer');
  const avatarLetter = document.getElementById('userAvatarLetter');

  if (cached) {
    document.body.classList.add('user-logged-in');
    document.body.classList.remove('user-logged-out');
    if (signInBtn) signInBtn.style.display = 'none';
    if (avatarContainer) {
      avatarContainer.style.display = 'inline-block';
      if (avatarLetter) {
        const photo = localStorage.getItem('jb-user-photo');
        const name = localStorage.getItem('jb-user-name');
        const email = localStorage.getItem('jb-user-email');
        if (photo) {
          avatarLetter.innerHTML = `<img src="${photo}" alt="User Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
          const letter = name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : 'U');
          avatarLetter.textContent = letter;
        }
      }
    }
  } else {
    document.body.classList.add('user-logged-out');
    document.body.classList.remove('user-logged-in');
    if (signInBtn) signInBtn.style.display = 'inline-flex';
    if (avatarContainer) avatarContainer.style.display = 'none';
  }
}

// Sync slider height to visible form
function syncSliderHeight() {
  const activeForm = document.getElementById(`${currentMode}Form`);
  if (activeForm && el.sliderWrap) {
    el.sliderWrap.style.height = `${activeForm.scrollHeight}px`;
  }
}

// Switch auth form sliding views
function switchMode(mode) {
  currentMode = mode;
  el.card.classList.remove('shake');
  
  if (mode === 'login') {
    el.slider.style.transform = 'translateX(0%)';
    el.title.textContent = 'Welcome Back';
    el.subtitle.textContent = 'Sign in to continue your JobBridge journey.';
    el.socialSection.style.display = 'block';
    el.switchFooter.style.display = 'block';
    el.switchPrompt.textContent = "Don't have an account?";
    el.switchBtn.textContent = 'Create Account';
  } else if (mode === 'register') {
    el.slider.style.transform = 'translateX(-33.3333%)';
    el.title.textContent = 'Create Account';
    el.subtitle.textContent = 'Sign up to start discovering verified careers.';
    el.socialSection.style.display = 'block';
    el.switchFooter.style.display = 'block';
    el.switchPrompt.textContent = 'Already have an account?';
    el.switchBtn.textContent = 'Login';
  } else if (mode === 'reset') {
    el.slider.style.transform = 'translateX(-66.6666%)';
    el.title.textContent = 'Reset Password';
    el.subtitle.textContent = "Enter your email and we'll send a password recovery link.";
    el.socialSection.style.display = 'none';
    el.switchFooter.style.display = 'none';
  }
  
  // Recalculate heights smoothly
  syncSliderHeight();
}

// Bind navigation clicks
function setupFormNav() {
  el.switchBtn.addEventListener('click', () => {
    if (currentMode === 'login') {
      switchMode('register');
    } else {
      switchMode('login');
    }
  });
  
  el.gotoReset.addEventListener('click', (e) => {
    e.preventDefault();
    switchMode('reset');
  });
  
  el.backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    switchMode('login');
  });
}

// Show/Hide password toggle bindings
function setupPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const inputId = button.dataset.togglePassword;
      const input = document.getElementById(inputId);
      const icon = button.querySelector('i');
      if (input && icon) {
        if (input.type === 'password') {
          input.type = 'text';
          icon.className = 'fa-solid fa-eye-slash';
          button.setAttribute('aria-label', 'Hide password');
        } else {
          input.type = 'password';
          icon.className = 'fa-solid fa-eye';
          button.setAttribute('aria-label', 'Show password');
        }
      }
    });
  });
}

// Handle alert notification toast system
function showAlert(message, type = 'error') {
  if (alertTimeout) clearTimeout(alertTimeout);
  
  el.alertMsg.textContent = message;
  el.alertBanner.className = `alert-banner show alert-banner-${type}`;
  el.alertIcon.className = type === 'error' 
    ? 'fa-solid fa-circle-exclamation' 
    : 'fa-solid fa-circle-check';
  
  alertTimeout = setTimeout(() => {
    el.alertBanner.classList.remove('show');
  }, 4500);
}

// Shake form element to show validation fail visually
function shakeForm() {
  el.card.classList.remove('shake');
  void el.card.offsetWidth; // trigger reflow
  el.card.classList.add('shake');
}

// Validation helpers
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Set state of loading in all input fields and buttons
function setAuthLoading(isLoading) {
  const inputs = document.querySelectorAll('.input-field, button, input[type="checkbox"], .auth-switch-link');
  inputs.forEach(element => {
    if (isLoading) {
      element.setAttribute('disabled', 'true');
      element.style.pointerEvents = 'none';
      element.style.opacity = '0.6';
    } else {
      element.removeAttribute('disabled');
      element.style.pointerEvents = '';
      element.style.opacity = '';
    }
  });

  const loginBtn = document.getElementById('loginSubmitBtn');
  const registerBtn = document.getElementById('registerSubmitBtn');
  const resetBtn = document.getElementById('resetSubmitBtn');
  const googleBtn = document.getElementById('googleLoginBtn');

  if (isLoading) {
    if (loginBtn) loginBtn.innerHTML = `<span class="spinner"></span>`;
    if (registerBtn) registerBtn.innerHTML = `<span class="spinner"></span>`;
    if (resetBtn) resetBtn.innerHTML = `<span class="spinner"></span>`;
    if (googleBtn) googleBtn.innerHTML = `<span class="spinner"></span> <span>Connecting...</span>`;
  } else {
    if (loginBtn) loginBtn.innerHTML = `<span>Login</span>`;
    if (registerBtn) registerBtn.innerHTML = `<span>Create Account</span>`;
    if (resetBtn) resetBtn.innerHTML = `<span>Send Reset Link</span>`;
    if (googleBtn) {
      googleBtn.innerHTML = `
        <img src="assets/logos/google.svg" alt="Google logo">
        <span>Sign in with Google</span>
      `;
    }
  }
}

// Action: Firebase login
async function handleLogin(e) {
  e.preventDefault();
  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value;
  const remember = el.rememberMe.checked;
  
  if (!email || !password) {
    shakeForm();
    showAlert('Please fill in all email and password fields.');
    return;
  }
  
  if (!validateEmail(email)) {
    shakeForm();
    showAlert('Please enter a valid email address format.');
    return;
  }
  
  setAuthLoading(true);
  
  try {
    // Set authentication persistence
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    
    // Sign in
    await signInWithEmailAndPassword(auth, email, password);
    
    if (remember) {
      localStorage.setItem('jb-remember-email', email);
    } else {
      localStorage.removeItem('jb-remember-email');
    }
    
    showAlert('Successfully logged in! Redirecting...', 'success');
  } catch (error) {
    console.error("Firebase Login Error Code:", error.code);
    console.error("Firebase Login Error Message:", error.message);
    console.error("Full Login Error:", error);
    shakeForm();
    const errorMsg = formatFirebaseError(error.code) || error.message;
    showAlert(errorMsg);
    setAuthLoading(false);
  }
}

// Action: Firebase register
async function handleRegister(e) {
  e.preventDefault();
  const name = el.registerName.value.trim();
  const email = el.registerEmail.value.trim();
  const password = el.registerPassword.value;
  const confirm = el.registerConfirm.value;
  
  if (!name || !email || !password || !confirm) {
    shakeForm();
    showAlert('Please complete all form registration fields.');
    return;
  }
  
  if (!validateEmail(email)) {
    shakeForm();
    showAlert('Please enter a valid email address.');
    return;
  }
  
  if (password.length < 6) {
    shakeForm();
    showAlert('Password must contain at least 6 characters.');
    return;
  }
  
  if (password !== confirm) {
    shakeForm();
    showAlert('Passwords do not match. Please verify confirmed password.');
    return;
  }
  
  setAuthLoading(true);
  
  try {
    // Create user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Update profile display name safely (nested try-catch)
    try {
      await updateProfile(cred.user, { displayName: name });
    } catch (profileErr) {
      console.warn("Failed to set display name on new registration profile:", profileErr);
    }
    showAlert('Registration successful! Logging you in...', 'success');
  } catch (error) {
    console.error("Firebase Registration Error Code:", error.code);
    console.error("Firebase Registration Error Message:", error.message);
    console.error("Full Registration Error:", error);
    shakeForm();
    const errorMsg = formatFirebaseError(error.code) || error.message;
    showAlert(errorMsg);
    setAuthLoading(false);
  }
}

// Action: Firebase Google sign-in
async function handleGoogleLogin() {
  setAuthLoading(true);
  try {
    await signInWithPopup(auth, googleProvider);
    showAlert('Google Authentication successful!', 'success');
  } catch (error) {
    console.error("Firebase Google Auth Error Code:", error.code);
    console.error("Firebase Google Auth Error Message:", error.message);
    console.error("Full Google Auth Error:", error);
    setAuthLoading(false);
    if (error.code !== 'auth/popup-closed-by-user') {
      shakeForm();
      const errorMsg = formatFirebaseError(error.code) || error.message;
      showAlert(errorMsg);
    }
  }
}

// Action: Firebase password reset link
async function handlePasswordReset(e) {
  e.preventDefault();
  const email = el.resetEmail.value.trim();
  
  if (!email) {
    shakeForm();
    showAlert('Please input your registered email address.');
    return;
  }
  
  if (!validateEmail(email)) {
    shakeForm();
    showAlert('Please provide a valid email format.');
    return;
  }
  
  setAuthLoading(true);
  
  try {
    await sendPasswordResetEmail(auth, email);
    showAlert('Password reset link successfully sent to your email!', 'success');
    el.resetEmail.value = '';
    setTimeout(() => {
      setAuthLoading(false);
      switchMode('login');
    }, 2000);
  } catch (error) {
    console.error("Firebase Password Reset Error Code:", error.code);
    console.error("Firebase Password Reset Error Message:", error.message);
    console.error("Full Password Reset Error:", error);
    shakeForm();
    const errorMsg = formatFirebaseError(error.code) || error.message;
    showAlert(errorMsg);
    setAuthLoading(false);
  }
}

// Display cleaner message strings for Firebase codes
function formatFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your credentials.';
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Selected password is too weak. Choose at least 6 characters.';
    case 'auth/invalid-email':
      return 'The email format entered is invalid.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/unauthorized-domain':
      return `Domain/IP unauthorized. Please add '${window.location.hostname}' to the 'Authorized Domains' list under Authentication > Settings > Authorized Domains in your Firebase Console.`;
    default:
      return null;
  }
}

// Remembered email checkbox restoration
function setupRememberedEmail() {
  const remembered = localStorage.getItem('jb-remember-email');
  if (remembered && el.loginEmail && el.rememberMe) {
    el.loginEmail.value = remembered;
    el.rememberMe.checked = true;
  }
}

// Light & Dark Theme management sync
function setupTheme() {
  const themeBtn = el.themeToggle || document.getElementById('theme-toggle');
  if (!themeBtn) return;
  
  const updateIcon = (theme) => {
    const icon = themeBtn.querySelector('i');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  };
  
  const activeTheme = localStorage.getItem('jb-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', activeTheme);
  document.documentElement.dataset.theme = activeTheme;
  updateIcon(activeTheme);
  
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('jb-theme', next);
    updateIcon(next);
    
    // Dispatch custom event for subpages custom overrides
    window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: next } }));
  });
}

function setupMobileNav() {
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('primary-menu');
  if (!navToggle || !navLinks) return;

  let backdrop = document.getElementById('nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.id = 'nav-backdrop';
    backdrop.setAttribute('hidden', '');
    document.body.appendChild(backdrop);
  }

  let backdropTimer;

  const setMenu = (open) => {
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.innerHTML = open 
      ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' 
      : '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    document.body.classList.toggle('nav-open', open);

    if (backdrop) {
      window.clearTimeout(backdropTimer);
      backdrop.removeAttribute('hidden');
      setTimeout(() => {
        backdrop.classList.toggle('is-visible', open);
      }, 10);
      if (!open) {
        backdropTimer = window.setTimeout(() => {
          backdrop.setAttribute('hidden', '');
        }, 300);
      }
    }
  };

  const toggleHandler = () => setMenu(!navLinks.classList.contains('open'));
  navToggle.removeEventListener('click', navToggle._handler);
  navToggle.addEventListener('click', toggleHandler);
  navToggle._handler = toggleHandler;

  if (backdrop) {
    const backdropHandler = () => setMenu(false);
    backdrop.removeEventListener('click', backdrop._handler);
    backdrop.addEventListener('click', backdropHandler);
    backdrop._handler = backdropHandler;
  }

  const escapeHandler = (event) => {
    if (event.key === 'Escape') setMenu(false);
  };
  document.removeEventListener('keydown', document._escapeHandler);
  document.addEventListener('keydown', escapeHandler);
  document._escapeHandler = escapeHandler;

  const linksHandler = (event) => {
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
  };
  navLinks.removeEventListener('click', navLinks._handler);
  navLinks.addEventListener('click', linksHandler);
  navLinks._handler = linksHandler;
}

function highlightActiveNavLink() {
  const path = window.location.pathname.toLowerCase();
  
  ['navHome', 'navGov', 'navIt', 'navMfg', 'navSaved', 'navSettings'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });

  if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
    document.getElementById('navHome')?.classList.add('active');
  } else if (path.endsWith('government.html')) {
    document.getElementById('navGov')?.classList.add('active');
  } else if (path.endsWith('private-it.html')) {
    document.getElementById('navIt')?.classList.add('active');
  } else if (path.endsWith('manufacturing.html')) {
    document.getElementById('navMfg')?.classList.add('active');
  } else if (path.endsWith('saved-jobs.html')) {
    document.getElementById('navSaved')?.classList.add('active');
  } else if (path.endsWith('settings.html')) {
    document.getElementById('navSettings')?.classList.add('active');
  }
}

// Generate animated floating particle elements in background
function setupParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 15}s`;
    p.style.animationDuration = `${10 + Math.random() * 12}s`;
    p.style.opacity = `${0.05 + Math.random() * 0.15}`;
    p.style.transform = `scale(${0.5 + Math.random() * 1.2})`;
    container.appendChild(p);
  }
}

function setupNavbarAuth() {
  const avatarBtn = document.getElementById('userAvatarBtn');
  const dropdownMenu = document.getElementById('userDropdownMenu');
  const dropdownLogout = document.getElementById('dropdownLogoutBtn');
  
  if (avatarBtn && dropdownMenu) {
    // Add ripple and manual navigation listeners to items
    dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        setupClickRipple(e);
        
        // Let logout button click handle its own Firebase logic
        if (item.id === 'dropdownLogoutBtn') return;

        e.preventDefault();
        const href = item.getAttribute('href');
        if (href) {
          closeDropdown();
          
          // Show unified page transition overlay
          let transitionEl = document.querySelector('.page-transition');
          if (!transitionEl) {
            transitionEl = document.createElement('div');
            transitionEl.className = 'page-transition';
            document.body.appendChild(transitionEl);
          }
          transitionEl.classList.add('is-active');
          
          setTimeout(() => {
            window.location.href = href;
          }, 180);
        }
      });
    });

    const closeDropdown = () => {
      dropdownMenu.classList.remove('show');
      avatarBtn.setAttribute('aria-expanded', 'false');
    };

    // Toggle dropdown
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setupClickRipple(e);
      const isShown = dropdownMenu.classList.contains('show');
      if (isShown) {
        closeDropdown();
      } else {
        dropdownMenu.classList.add('show');
        avatarBtn.setAttribute('aria-expanded', 'true');
      }
    });

    dropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!avatarBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        closeDropdown();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    // Close on window scroll
    window.addEventListener('scroll', closeDropdown, { passive: true });

    // Close on window resize
    window.addEventListener('resize', () => {
      closeDropdown();
      // Also close mobile menu on resize to desktop view
      const mobileNav = document.getElementById('primary-menu');
      const mobileToggle = document.getElementById('nav-toggle');
      if (window.innerWidth > 768 && mobileNav) {
        mobileNav.classList.remove('open');
        if (mobileToggle) {
          mobileToggle.setAttribute('aria-expanded', 'false');
          mobileToggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
        }
        document.body.classList.remove('nav-open');
      }
    }, { passive: true });

    // Close dropdown on page transition/unload
    window.addEventListener('beforeunload', closeDropdown);
    window.addEventListener('pagehide', closeDropdown);
  }

  if (dropdownLogout) {
    dropdownLogout.addEventListener('click', async (e) => {
      setupClickRipple(e);
      try {
        await signOut(auth);
        window.location.replace('index.html');
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }
}

function setupClickRipple(event) {
  const btn = event.currentTarget;
  if (!btn) return;
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

// Global Exported functions for index/portal reuse
window.logoutUser = async () => {
  try {
    await signOut(auth);
    window.location.replace('login.html');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

function initializeResponsiveNav() {
  const primaryMenu = document.getElementById('primary-menu');
  if (!primaryMenu) return;

  const homeLink = document.getElementById('navHome');
  const govLink = document.getElementById('navGov');
  const itLink = document.getElementById('navIt');
  const mfgLink = document.getElementById('navMfg');

  if (homeLink && !homeLink.querySelector('.nav-icon')) {
    homeLink.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-house nav-icon"></i>');
  }
  if (govLink && !govLink.querySelector('.nav-icon')) {
    govLink.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-landmark nav-icon"></i>');
  }
  if (itLink && !itLink.querySelector('.nav-icon')) {
    itLink.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-laptop-code nav-icon"></i>');
  }
  if (mfgLink && !mfgLink.querySelector('.nav-icon')) {
    mfgLink.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-industry nav-icon"></i>');
  }
}

function updateMobileNavLinks(user) {
  const primaryMenu = document.getElementById('primary-menu');
  if (!primaryMenu) return;

  // Clean up any existing mobile-only links to avoid duplicates
  const existingMobileOnly = primaryMenu.querySelectorAll('.mobile-only');
  existingMobileOnly.forEach(el => el.remove());

  if (user) {
    // Add Saved Jobs link
    const savedLink = document.createElement('a');
    savedLink.href = 'saved-jobs.html';
    savedLink.className = 'mobile-only';
    savedLink.id = 'navSaved';
    savedLink.innerHTML = '<i class="fa-regular fa-bookmark nav-icon"></i>Saved Jobs';
    primaryMenu.appendChild(savedLink);

    // Add Settings link
    const settingsLink = document.createElement('a');
    settingsLink.href = 'settings.html';
    settingsLink.className = 'mobile-only';
    settingsLink.id = 'navSettings';
    settingsLink.innerHTML = '<i class="fa-solid fa-gear nav-icon"></i>Settings';
    primaryMenu.appendChild(settingsLink);

    // Add Logout link
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.className = 'mobile-only logout-item';
    logoutLink.id = 'navLogout';
    logoutLink.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket nav-icon"></i>Logout';
    
    // Register Logout handler
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        window.location.replace('index.html');
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
    primaryMenu.appendChild(logoutLink);

    // Refresh active highlights since new links might have been added
    highlightActiveNavLink();
  }
}
