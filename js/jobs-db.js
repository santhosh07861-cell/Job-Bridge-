import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

const CACHE_KEY_PREFIX = 'jb-db-cache-';

function timeoutPromise(promise, ms = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Firestore fetch timed out'));
    }, ms);
    
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function fetchWithFallback(jsonUrl, firestoreFetchFn, cacheKey) {
  // Try Firestore first with a 2.5s timeout to prevent hanging on rules/connection issues
  try {
    const data = await timeoutPromise(firestoreFetchFn(), 2500);
    if (data && (!Array.isArray(data) || data.length > 0)) {
      // Save successful Firestore fetch to cache
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(`${cacheKey}_time`, String(Date.now()));
      return data;
    }
  } catch (error) {
    console.warn(`Firestore fetch failed or timed out for ${cacheKey}, falling back to local file/cache:`, error);
  }

  // Try local storage cache next
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

  // Fallback to local static JSON file
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const localData = await response.json();
    return localData;
  } catch (err) {
    console.error(`Both Firestore and local file fetch failed for ${jsonUrl}:`, err);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * Fetches Government Job directory from Firestore or falls back to local JSON
 */
export async function getGovernmentJobs() {
  return fetchWithFallback(
    'data/government-jobs.json',
    async () => {
      const docRef = doc(db, 'government_jobs', 'all_data');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    },
    `${CACHE_KEY_PREFIX}government`
  );
}

/**
 * Fetches IT Career opportunities from Firestore or falls back to local JSON
 */
export async function getItJobs() {
  return fetchWithFallback(
    'data/private-it-jobs.json',
    async () => {
      const querySnapshot = await getDocs(collection(db, 'it_jobs'));
      const jobs = [];
      querySnapshot.forEach((doc) => {
        jobs.push({ id: doc.id, ...doc.data() });
      });
      return jobs;
    },
    `${CACHE_KEY_PREFIX}it`
  );
}

/**
 * Fetches Manufacturing Job opportunities from Firestore or falls back to local JSON
 */
export async function getManufacturingJobs() {
  return fetchWithFallback(
    'data/manufacturing-jobs.json',
    async () => {
      const querySnapshot = await getDocs(collection(db, 'manufacturing_jobs'));
      const jobs = [];
      querySnapshot.forEach((doc) => {
        jobs.push({ id: doc.id, ...doc.data() });
      });
      return jobs;
    },
    `${CACHE_KEY_PREFIX}manufacturing`
  );
}
