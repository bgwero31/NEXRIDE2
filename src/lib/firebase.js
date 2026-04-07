// File: src/lib/firebase.js

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB4UUX4vavo6AZXPVr7E5kP_V43CBfZdtc",
  authDomain: "nexride2.firebaseapp.com",
  projectId: "nexride2",
  storageBucket: "nexride2.firebasestorage.app",
  messagingSenderId: "639168322524",
  appId: "1:639168322524:web:4b99685f60bee65f324d19",

  // add this if you are using Realtime Database
  databaseURL: "https://nexride2-default-rtdb.firebaseio.com",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

export default app;
