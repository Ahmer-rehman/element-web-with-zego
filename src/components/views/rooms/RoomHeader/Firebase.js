/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

PDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCLrnltcBSh2js9vG3IsleJTL6oFxOUS90",
  authDomain: "elements-ff900.firebaseapp.com",
  databaseURL: "https://elements-ff900-default-rtdb.firebaseio.com",
  projectId: "elements-ff900",
  storageBucket: "elements-ff900.appspot.com",
  messagingSenderId: "1090199940608",
  appId: "1:1090199940608:web:63367e477fc56821dc72e5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export default app;