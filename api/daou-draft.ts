import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './lib/auth.js'
import { buildSwReqContent } from './lib/daou-form.js'

// 다우오피스 전자결재 기안 생성 — 스태프 개발요청을 모아 기안 본문으로 전송.
// 호출 성공 시 다우가 그룹웨어 기안 작성 팝업 URL로 302 리다이렉트 → 그 URL을 프론트에 반환.
// 시크릿은 서버에만 존재(브라우저 노출 X). 기안자는 팝업을 여는 그룹웨어 로그인 사용자로 자동 지정됨.
const DAOU_BASE = process.env.DAOU_BASE_URL || 'https://api.daouoffice.com'
const CLIENT_ID = process.env.DAOU_CLIENT_ID || ''
const CLIENT_SECRET = process.env.DAOU_CLIENT_SECRET || ''
const FORM_CODE = process.env.DAOU_FORM_CODE || 'IT-SW-REQ'
// 기안 처리상태 콜백 URL (필수 파라미터, 80/443 포트만 허용)
const CALLBACK_URL = process.env.DAOU_CALLBACK_URL || 'https://issue.datasystem.app/api/daou-callback'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!(await requireAuth(req, res))) return // 로그인 사용자(스태프 포함)면 OK
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'DAOU_CLIENT_ID / DAOU_CLIENT_SECRET 환경변수가 없습니다' })
  }

  const body = (req.body || {}) as {
    title?: string
    content?: string
    dueDate?: string
    policyUrl?: string
    background?: string
    requestContent?: string
  }
  const title = body.title
  if (!title) return res.status(400).json({ error: 'title은 필수입니다' })
  // content가 직접 오면 그대로, 아니면 소프트웨어 개발 요청서 템플릿에 값 주입
  const content =
    body.content ??
    buildSwReqContent({
      dueDate: body.dueDate,
      policyUrl: body.policyUrl,
      background: body.background,
      requestContent: body.requestContent,
    })

  const form = new FormData()
  form.append('clientId', CLIENT_ID)
  form.append('clientSecret', CLIENT_SECRET)
  form.append('formCode', FORM_CODE)
  form.append('title', title)
  form.append('content', content)
  form.append('callbackUrl', CALLBACK_URL)

  try {
    const r = await fetch(`${DAOU_BASE}/public/v4/approval/document/popup`, {
      method: 'POST',
      body: form,
      redirect: 'manual', // 302 Location(팝업 URL)을 직접 받기 위해 자동 추적 끔
    })
    const location = r.headers.get('location')
    if ((r.status === 302 || r.status === 301 || r.status === 303) && location) {
      return res.status(200).json({ url: location })
    }
    const text = await r.text().catch(() => '')
    return res.status(502).json({ error: '기안 생성 실패', status: r.status, body: text.slice(0, 1000) })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
