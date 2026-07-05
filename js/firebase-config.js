import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGG3p6JboNpra8X4swBgTN10NVqfs7lOM",
  authDomain: "job-bridge-e4958.firebaseapp.com",
  projectId: "job-bridge-e4958",
  storageBucket: "job-bridge-e4958.firebasestorage.app",
  messagingSenderId: "61004075199",
  appId: "1:61004075199:web:07ad2cfd2646f9e15c760a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn("Firestore persistence failed: failed-precondition");
  } else if (err.code == 'unimplemented') {
    console.warn("Firestore persistence failed: unimplemented");
  }
});

export { auth, db };
export default app;