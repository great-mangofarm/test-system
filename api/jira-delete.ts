import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './lib/auth.js'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await requireAuth(req, res, { adminOrDev: true }))) return

  const { issueKey } = req.body
  if (!issueKey) return res.status(400).json({ error: 'issueKey is required' })

  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
        'Accept': 'application/json',
      },
    })

    // 204 No Content = 성공
    if (response.status === 204) {
      return res.status(200).json({ ok: true })
    }

    const data = await response.json().catch(() => ({}))
    return res.status(response.status).json({ error: data.errorMessages ?? data })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
