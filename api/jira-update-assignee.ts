import type { VercelRequest, VercelResponse } from '@vercel/node'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

const authHeader = () =>
  `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { issueKey, developerEmail } = req.body
  if (!issueKey) return res.status(400).json({ error: 'issueKey required' })

  try {
    let accountId: string | null = null

    if (developerEmail) {
      // 이메일로 Jira accountId 조회
      const r = await fetch(
        `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(developerEmail)}`,
        { headers: { Authorization: authHeader(), Accept: 'application/json' } }
      )
      if (r.ok) {
        const users = await r.json()
        const match = users.find((u: { emailAddress: string }) => u.emailAddress === developerEmail)
        if (match) accountId = match.accountId
      }
      // 이메일로 Jira 계정을 못 찾으면 미정으로 만들지 않고 종료
      if (!accountId) {
        return res.status(200).json({ skipped: `no Jira account for ${developerEmail}` })
      }
    }

    // Jira 담당자 업데이트 (accountId null = 담당자 제거)
    const r = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/assignee`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    })

    if (r.status === 204) return res.status(200).json({ ok: true })

    const data = await r.json().catch(() => ({}))
    return res.status(r.status).json({ error: data })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
