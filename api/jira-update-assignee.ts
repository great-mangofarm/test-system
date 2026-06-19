import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './lib/auth.js'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

const authHeader = () =>
  `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`

// 이슈키에서 프로젝트키 추출 (e.g. "DSP-123" → "DSP")
function extractProjectKey(issueKey: string): string {
  return issueKey.split('-')[0]
}

// 프로젝트 assignable 유저 목록에서 이름으로 accountId 찾기 (이메일 공개 여부 무관)
async function findByAssignable(projectKey: string, displayName: string): Promise<string | null> {
  const r = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&maxResults=100`,
    { headers: { Authorization: authHeader(), Accept: 'application/json' } }
  )
  if (!r.ok) return null
  const users: Array<{ accountId: string; displayName: string; emailAddress?: string }> = await r.json()
  const match = users.find((u) => u.displayName === displayName)
  return match?.accountId ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireAuth(req, res, { adminOrDev: true }))) return

  const { issueKey, developerEmail, jiraDisplayName } = req.body
  if (!issueKey) return res.status(400).json({ error: 'issueKey required' })

  try {
    let accountId: string | null = null
    const projectKey = extractProjectKey(issueKey)

    // 1순위: 이메일로 검색 (이메일 공개 유저)
    if (developerEmail) {
      const r = await fetch(
        `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(developerEmail)}`,
        { headers: { Authorization: authHeader(), Accept: 'application/json' } }
      )
      if (r.ok) {
        const users = await r.json()
        const match = users.find((u: { emailAddress: string }) => u.emailAddress === developerEmail)
        if (match) accountId = match.accountId
      }
      console.log('[jira-assignee] email search:', developerEmail, '->', accountId ?? 'not found')
    }

    // 2순위: assignable 목록에서 이름으로 검색 (이메일 비공개 유저도 포함)
    if (!accountId && jiraDisplayName) {
      accountId = await findByAssignable(projectKey, jiraDisplayName)
      console.log('[jira-assignee] assignable search by jiraDisplayName:', jiraDisplayName, '->', accountId ?? 'not found')
    }

    if (!accountId) {
      console.log('[jira-assignee] skipped: no account found for', developerEmail ?? jiraDisplayName)
      return res.status(200).json({ skipped: `no Jira account found for ${developerEmail ?? jiraDisplayName}` })
    }

    // Jira 담당자 업데이트
    const r = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/assignee`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    })

    if (r.status === 204) {
      console.log('[jira-assignee] updated', issueKey, 'accountId:', accountId)
      return res.status(200).json({ ok: true })
    }

    const data = await r.json().catch(() => ({}))
    return res.status(r.status).json({ error: data })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
