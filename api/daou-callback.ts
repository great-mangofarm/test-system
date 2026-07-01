import type { VercelRequest, VercelResponse } from '@vercel/node'

// 다우오피스 전자결재 기안 처리상태 콜백 수신.
// 다우(DOAS)가 상신/승인/반려/취소 등 상태 변경 시 이 URL로 POST 한다.
// 다우는 표준 응답 형식(code/message)을 기대하며, 그 외 형식이면 973(유효하지 않은 데이터 포맷)으로 상신이 막힌다.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = req.body as { docId?: string; docStatusName?: string; title?: string } | undefined
    if (body?.docId) {
      console.log('[daou-callback]', body.docStatusName ?? '', body.docId, body.title ?? '')
    }
  } catch {
    // 로깅 실패는 무시
  }
  return res.status(200).json({ code: '200', message: 'OK' })
}
