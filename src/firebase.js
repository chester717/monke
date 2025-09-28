// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5dlBATEdNJigcb_uNfj5Dgvgi7i75Bzg",
  authDomain: "monke-d4496.firebaseapp.com",
  projectId: "monke-d4496",
  storageBucket: "monke-d4496.firebasestorage.app",
  messagingSenderId: "690562229826",
  appId: "1:690562229826:web:0b8abfacc5ecac33e82fdb"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app)