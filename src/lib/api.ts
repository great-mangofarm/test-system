import { auth } from './firebase'

// /api 서버리스 함수 호출용 — 현재 로그인 사용자의 Firebase ID 토큰을
// Authorization: Bearer 헤더로 자동 첨부한다.
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
