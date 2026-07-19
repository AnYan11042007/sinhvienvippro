/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE",
  authDomain: "appsinhvien-24482.firebaseapp.com",
  databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "appsinhvien-24482"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
