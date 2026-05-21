import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { UserProfile, UserRole } from '@/types'

interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        // Firestore 문서가 아직 없으면 (등록 직후 race condition) 잠시 후 재시도
        if (!snap.exists()) {
          await new Promise((r) => setTimeout(r, 800))
          snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        }
        if (snap.exists()) {
          setUser(snap.data() as UserProfile)
        } else {
          // Firestore 문서 없음 = 삭제된 계정 → 강제 로그아웃
          await signOut(auth)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export async function login(email: string, password: string, remember: boolean): Promise<void> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
  await signInWithEmailAndPassword(auth, email, password)
}

export async function register(email: string, password: string, displayName: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(user, { displayName })
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    displayName,
    role: 'viewer' as UserRole,
    createdAt: new Date().toISOString(),
  })
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export async function changePassword(newPassword: string): Promise<void> {
  if (!auth.currentUser) throw new Error('not_logged_in')
  await updatePassword(auth.currentUser, newPassword)
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

// 본인 계정 삭제 (Firebase Auth + Firestore)
export async function deleteAccount(): Promise<void> {
  if (!auth.currentUser) throw new Error('not_logged_in')
  const uid = auth.currentUser.uid
  await deleteDoc(doc(db, 'users', uid))
  await deleteUser(auth.currentUser)
}

// 관리자가 다른 계정 삭제 (Firestore 문서만 삭제 → 앱 접근 차단)
export async function deleteUserDoc(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid))
}
