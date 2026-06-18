import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
// ignoreUndefinedProperties: 폼 상태에 undefined가 섞여도 쓰기 전체가 실패하지 않도록
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
export const storage = getStorage(app)
// Firebase 브라우저 기본값이 browserLocalPersistence — 별도 setPersistence 불필요
export const auth = getAuth(app)
