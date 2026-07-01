import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminDb } from './lib/admin.js'

// 다우오피스 전자결재 콜백 수신 + 진단 캡처.
// 상신 시 다우(DOAS)가 이 URL을 호출 → 요청 원문을 Firestore(_daouCallbacks)에 저장.
// GET ?peek=<PEEK_TOKEN> 이면 최근 캡처를 반환(진단용 임시).
const PEEK_TOKEN = 'daou-peek-3f9a2'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' && req.query.peek === PEEK_TOKEN) {
    try {
      const snap = await adminDb.collection('_daouCallbacks').get()
      const docs = snap.docs
        .map((d) => d.data())
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 8)
      return res.status(200).json({ count: snap.size, docs })
    } catch (e) {
      return res.status(500).json({ error: String(e) })
    }
  }

  const record = {
    at: new Date().toISOString(),
    method: req.method ?? '',
    url: req.url ?? '',
    query: req.query ?? {},
    contentType: req.headers['content-type'] ?? '',
    body: req.body ?? null,
    bodyType: typeof req.body,
    bodyRaw: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null),
  }
  try {
    await adminDb.collection('_daouCallbacks').add(record)
  } catch {
    // 저장 실패해도 응답은 진행
  }
  return res.status(200).json({ ok: true })
}
