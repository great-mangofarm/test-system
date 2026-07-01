import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminDb } from './lib/admin.js'

// 다우오피스 전자결재 콜백 수신 + 진단 캡처.
// 상신 시 다우(DOAS)가 이 URL을 호출하는데 그 요청 원문을 Firestore(_daouCallbacks)에 저장해
// 실제로 무엇을 보내고 어떤 응답을 기대하는지 파악한다.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const record = {
    at: new Date().toISOString(),
    method: req.method ?? '',
    url: req.url ?? '',
    query: req.query ?? {},
    headers: {
      'content-type': req.headers['content-type'] ?? '',
      'user-agent': req.headers['user-agent'] ?? '',
    },
    body: req.body ?? null,
    bodyType: typeof req.body,
  }
  try {
    await adminDb.collection('_daouCallbacks').add(record)
  } catch (e) {
    // 저장 실패해도 응답은 진행
    record.body = record.body ?? String(e)
  }
  // 임시: 진단용. 다우 규격 확인 후 정식 응답으로 교체.
  return res.status(200).json({ ok: true })
}
