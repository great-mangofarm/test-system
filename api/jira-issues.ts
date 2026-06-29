import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './lib/auth.js'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

const authHeader = () => `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`

// 프로젝트 + 상태로 Jira 이슈 목록 조회 (티켓 그룹 선택용)
// GET /api/jira-issues?projectKey=APP&statuses=테스트중,배포대기
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await requireAuth(req, res, { adminOrDev: true }))) return

  const projectKey = String(req.query.projectKey ?? '').trim()
  const statusesRaw = String(req.query.statuses ?? '').trim()
  if (!projectKey) return res.status(400).json({ error: 'projectKey is required' })

  const statuses = statusesRaw ? statusesRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  // 프로젝트키/상태 검증 (JQL 인젝션 방지)
  if (!/^[A-Z][A-Z0-9_]+$/.test(projectKey)) return res.status(400).json({ error: 'invalid projectKey' })

  // JQL: 따옴표 이스케이프
  const esc = (s: string) => `"${s.replace(/["\\]/g, '\\$&')}"`
  let jql = `project = ${esc(projectKey)}`
  if (statuses.length > 0) jql += ` AND status in (${statuses.map(esc).join(',')})`
  jql += ' ORDER BY created DESC'

  try {
    // 신 JQL 검색 엔드포인트 (구 /rest/api/3/search 제거됨, CHANGE-2046)
    const r = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Authorization: authHeader(), Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, fields: ['summary', 'status'], maxResults: 100 }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: data.errorMessages ?? data })

    const issues = (data.issues ?? []).map((it: { key: string; fields?: { summary?: string; status?: { name?: string } } }) => ({
      key: it.key,
      summary: it.fields?.summary ?? '',
      status: it.fields?.status?.name ?? '',
      url: `${JIRA_BASE_URL}/browse/${it.key}`,
    }))
    return res.status(200).json({ issues })
  } catch (e) {
    console.error('[jira-issues]', e)
    return res.status(500).json({ error: 'jira request failed' })
  }
}
