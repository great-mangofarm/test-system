import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setUser(snap.exists() ? (snap.data() as UserProfile) : null)
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

export async function login(email: string, password: string): Promise<void> {
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
