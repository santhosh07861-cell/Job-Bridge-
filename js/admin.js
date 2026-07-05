import { db } from './firebase-config.js';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';

// DOM elements
const consoleLogs = document.getElementById('console-logs');
const btnClearLogs = document.getElementById('btn-clear-logs');

const govStatus = document.getElementById('gov-status');
const itStatus = document.getElementById('it-status');
const mfgStatus = document.getElementById('mfg-status');

const btnSyncGov = document.getElementById('btn-sync-gov');
const btnClearGov = document.getElementById('btn-clear-gov');

const btnSyncIt = document.getElementById('btn-sync-it');
const btnClearIt = document.getElementById('btn-clear-it');

const btnSyncMfg = document.getElementById('btn-sync-mfg');
const btnClearMfg = document.getElementById('btn-clear-mfg');

// Utility: add a log line
function log(msg, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${msg}`;
  consoleLogs.appendChild(line);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Clear UI logs
btnClearLogs.addEventListener('click', () => {
  consoleLogs.innerHTML = '';
  log('Logs cleared.', 'info');
});

// Helper: Check status of collections
async function checkCollectionStatus(collectionName, isDocOnly = false) {
  try {
    if (isDocOnly) {
      const docRef = doc(db, collectionName, 'all_data');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const orgCount = Array.isArray(data?.organizations) ? data.organizations.length : 0;
        return { status: 'synced', text: `Synced (${orgCount} orgs)` };
      }
      return { status: 'empty', text: 'Empty' };
    } else {
      const colRef = collection(db, collectionName);
      const querySnapshot = await getDocs(colRef);
      if (!querySnapshot.empty) {
        return { status: 'synced', text: `Synced (${querySnapshot.size} jobs)` };
      }
      return { status: 'empty', text: 'Empty' };
    }
  } catch (err) {
    console.error(`Error checking status of ${collectionName}:`, err);
    return { status: 'empty', text: `Error: ${err.code || 'unknown'}` };
  }
}

// Refresh all badges
async function refreshStatusBadges() {
  // Gov status
  govStatus.className = 'status-badge status-loading';
  govStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
  const gov = await checkCollectionStatus('government_jobs', true);
  govStatus.className = `status-badge status-${gov.status}`;
  govStatus.innerHTML = gov.status === 'synced' ? `<i class="fa-solid fa-cloud-arrow-down"></i> ${gov.text}` : `<i class="fa-solid fa-cloud-arrow-up"></i> ${gov.text}`;

  // IT status
  itStatus.className = 'status-badge status-loading';
  itStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
  const it = await checkCollectionStatus('it_jobs', false);
  itStatus.className = `status-badge status-${it.status}`;
  itStatus.innerHTML = it.status === 'synced' ? `<i class="fa-solid fa-cloud-arrow-down"></i> ${it.text}` : `<i class="fa-solid fa-cloud-arrow-up"></i> ${it.text}`;

  // Mfg status
  mfgStatus.className = 'status-badge status-loading';
  mfgStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
  const mfg = await checkCollectionStatus('manufacturing_jobs', false);
  mfgStatus.className = `status-badge status-${mfg.status}`;
  mfgStatus.innerHTML = mfg.status === 'synced' ? `<i class="fa-solid fa-cloud-arrow-down"></i> ${mfg.text}` : `<i class="fa-solid fa-cloud-arrow-up"></i> ${mfg.text}`;
}

// Initialize status check on load
window.addEventListener('DOMContentLoaded', () => {
  log('Querying Firestore collections status...', 'info');
  refreshStatusBadges().then(() => {
    log('Firestore status query completed successfully.', 'success');
  });
});

/* ==========================================================================
   SYNC & CLEAR OPERATIONS
   ========================================================================== */

// 1. GOVERNMENT SYNC
btnSyncGov.addEventListener('click', async () => {
  btnSyncGov.disabled = true;
  btnClearGov.disabled = true;
  log('Starting Government Database Sync...', 'info');

  try {
    log('Fetching local data/government-jobs.json...', 'info');
    const response = await fetch('data/government-jobs.json');
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    log(`Fetched government data: ${data.organizations?.length || 0} organizations found.`, 'info');

    log('Writing directory file directly to doc (government_jobs/all_data)...', 'info');
    const docRef = doc(db, 'government_jobs', 'all_data');
    await setDoc(docRef, data);

    log('Government database populated successfully in Firestore!', 'success');
  } catch (error) {
    log(`Government Sync failed: ${error.message || error}`, 'error');
  } finally {
    await refreshStatusBadges();
    btnSyncGov.disabled = false;
    btnClearGov.disabled = false;
  }
});

// GOVERNMENT CLEAR
btnClearGov.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear the Government Firestore document?')) return;
  btnSyncGov.disabled = true;
  btnClearGov.disabled = true;
  log('Clearing Government database document from Firestore...', 'warning');

  try {
    const docRef = doc(db, 'government_jobs', 'all_data');
    await deleteDoc(docRef);
    log('Government database document deleted.', 'success');
  } catch (error) {
    log(`Clear failed: ${error.message || error}`, 'error');
  } finally {
    await refreshStatusBadges();
    btnSyncGov.disabled = false;
    btnClearGov.disabled = false;
  }
});

// Helper: Batch write items in chunks of 500 (Firestore limit)
async function batchWriteCollection(collectionName, items) {
  const colRef = collection(db, collectionName);
  let batch = writeBatch(db);
  let count = 0;
  let batchIndex = 1;

  log(`Beginning batch write for ${items.length} items to collection '${collectionName}'...`, 'info');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Create unique ID if none exists, using slugs to prevent duplication
    const docId = item.id || `${collectionName.replace('_jobs', '')}-${i}`;
    const docRef = doc(colRef, String(docId));
    batch.set(docRef, item);
    count++;

    if (count === 400) {
      log(`Committing batch #${batchIndex}...`, 'info');
      await batch.commit();
      log(`Batch #${batchIndex} committed successfully (${i + 1}/${items.length} written).`, 'success');
      batch = writeBatch(db);
      count = 0;
      batchIndex++;
    }
  }

  if (count > 0) {
    log(`Committing final batch #${batchIndex}...`, 'info');
    await batch.commit();
    log(`Final batch committed. Operation completed.`, 'success');
  }
}

// Helper: Clear a collection in batches
async function clearCollection(collectionName) {
  const colRef = collection(db, collectionName);
  log(`Querying all documents in '${collectionName}'...`, 'info');
  const snapshot = await getDocs(colRef);
  
  if (snapshot.empty) {
    log(`Collection '${collectionName}' is already empty.`, 'warning');
    return;
  }

  log(`Found ${snapshot.size} documents to delete. Starting batch deletion...`, 'info');
  let batch = writeBatch(db);
  let count = 0;
  let batchIndex = 1;

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    count++;

    if (count === 400) {
      log(`Committing delete batch #${batchIndex}...`, 'info');
      await batch.commit();
      log(`Delete batch #${batchIndex} committed successfully.`, 'success');
      batch = writeBatch(db);
      count = 0;
      batchIndex++;
    }
  }

  if (count > 0) {
    log(`Committing final delete batch #${batchIndex}...`, 'info');
    await batch.commit();
    log(`Final delete batch committed. Collection cleared.`, 'success');
  }
}

// 2. IT SYNC
btnSyncIt.addEventListener('click', async () => {
  btnSyncIt.disabled = true;
  btnClearIt.disabled = true;
  log('Starting Private IT Jobs Database Sync...', 'info');

  try {
    log('Fetching local data/private-it-jobs.json...', 'info');
    const response = await fetch('data/private-it-jobs.json');
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const jobs = await response.json();
    log(`Fetched IT data: ${jobs.length} jobs found.`, 'info');

    // First clear existing
    log('Wiping existing IT jobs from Firestore to prevent duplicates...', 'warning');
    await clearCollection('it_jobs');

    // Batch write new
    await batchWriteCollection('it_jobs', jobs);
    log('IT Jobs sync completed successfully!', 'success');
  } catch (error) {
    log(`IT Jobs Sync failed: ${error.message || error}`, 'error');
  } finally {
    await refreshStatusBadges();
    btnSyncIt.disabled = false;
    btnClearIt.disabled = false;
  }
});

// IT CLEAR
btnClearIt.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete all IT Jobs from Firestore?')) return;
  btnSyncIt.disabled = true;
  btnClearIt.disabled = true;
  log('Starting IT Jobs clear...', 'warning');

  try {
    await clearCollection('it_jobs');
    log('IT Jobs collection cleared.', 'success');
  } catch (error) {
    log(`IT Clear failed: ${error.message || error}`, 'error');
  } finally {
    await refreshStatusBadges();
    btnSyncIt.disabled = false;
    btnClearIt.disabled = false;
  }
});

// 3. MANUFACTURING SYNC
btnSyncMfg.addEventListener('click', async () => {
  btnSyncMfg.disabled = true;
  btnClearMfg.disabled = true;
  log('Starting Manufacturing Jobs Database Sync...', 'info');

  try {
    log('Fetching local data/manufacturing-jobs.json...', 'info');
    const response = await fetch('data/manufacturing-jobs.json');
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const jobs = await response.json();
    log(`Fetched Manufacturing data: ${jobs.length} jobs found.`, 'info');

    // First clear existing
    log('Wiping existing Manufacturing jobs from Firestore to prevent duplicates...', 'warning');
    await clearCollection('manufacturing_jobs');

    // Batch write new
    await batchWriteCollection('manufacturing_jobs', jobs);
    log('Manufacturing Jobs sync completed successfully!', 'success');
  } catch (error) {
    log(`Manufacturing Jobs Sync failed: ${error.message || error}`, 'error');
  } finally {
    await refreshStatusBadges();
    btnSyncMfg.disabled = false;
    btnClearMfg.disabled = false;
  }
});

// MANUFACTURING CLEAR
btnClearMfg.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete all Manufacturing Jobs from Firestore?')) return;
  btnSyncMfg.disabled = true;
  btnClearMfg.disabled = true;
  log('Starting Manufacturing Jobs clear...', 'warning');

  try {
    await clearCollection('manufacturing_jobs');
    log('Manufacturing Jobs collection cleared.', 'success');
  } catch (error) {
    log(`Manufacturing Clear failed: ${error.message || error}`, 'error');
  } finally {
    await refreshStatusBadges();
    btnSyncMfg.disabled = false;
    btnClearMfg.disabled = false;
  }
});
