// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyBg7l4W3kfInLtUoC7cBKuhJ96dVep-cQ8",
  authDomain: "hrms-efb58.firebaseapp.com",
  databaseURL: "https://hrms-efb58-default-rtdb.firebaseio.com",
  projectId: "hrms-efb58",
  storageBucket: "hrms-efb58.firebasestorage.app",
  messagingSenderId: "300163431851",
  appId: "1:300163431851:web:f9091b645bebbe35b526ee",
  measurementId: "G-Q1ZNEJ5NHN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database ,app};