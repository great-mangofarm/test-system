import type { VercelRequest, VercelResponse } from '@vercel/node'

// 다우오피스 전자결재 기안 처리상태 콜백 수신용 엔드포인트.
// 다우가 기안 처리상태(상신/승인/반려 등)를 이 URL로 전송한다.
// 현재는 수신 확인(200)만 — 필요 시 여기서 devRequests 상태 업데이트로 확장 가능.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[daou-callback]', req.method, JSON.stringify(req.body ?? {}).slice(0, 2000))
  } catch {
    // ignore
  }
  return res.status(200).json({ ok: true })
}
