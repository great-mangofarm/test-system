import { getAuth } from 'firebase-admin/auth'
import { adminDb } from './admin.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface AuthedUser {
  uid: string
  role: string
  email?: string
}

// Authorization: Bearer <Firebase ID 토큰> 검증 + Firestore에서 role 조회
export async function getAuthedUser(req: VercelRequest): Promise<AuthedUser | null> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    if (!snap.exists) return null // 삭제된 계정
    const data = snap.data() as { role?: string; email?: string }
    return { uid: decoded.uid, role: data.role ?? 'staff', email: data.email }
  } catch {
    return null
  }
}

// 인증(+옵션 권한) 검사. 실패하면 401/403 응답을 보내고 null 반환.
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  opts?: { adminOrDev?: boolean }
): Promise<AuthedUser | null> {
  const user = await getAuthedUser(req)
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  if (opts?.adminOrDev && user.role !== 'admin' && user.role !== 'pm' && user.role !== 'developer') {
    res.status(403).json({ error: 'forbidden' })
    return null
  }
  return user
}
