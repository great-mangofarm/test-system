import type { VercelRequest, VercelResponse } from '@vercel/node'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

function authHeader() {
  return `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { projectKey, email } = req.query

  try {
    if (email) {
      // Look up a single user by email
      const url = `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(email as string)}&maxResults=1`
      const response = await fetch(url, {
        headers: {
          'Authorization': authHeader(),
          'Accept': 'application/json',
        },
      })
      if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch user' })
      const data = await response.json() as Array<{ accountId: string; displayName: string }>
      if (!data || data.length === 0) return res.status(200).json(null)
      return res.status(200).json({ accountId: data[0].accountId, displayName: data[0].displayName })
    }

    if (projectKey) {
      // Get users assignable to project
      const url = `${JIRA_BASE_URL}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey as string)}&maxResults=100`
      const response = await fetch(url, {
        headers: {
          'Authorization': authHeader(),
          'Accept': 'application/json',
        },
      })
      if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch users' })
      const data = await response.json() as Array<{ accountId: string; displayName: string }>
      const users = data.map(({ accountId, displayName }) => ({ accountId, displayName }))
      return res.status(200).json(users)
    }

    return res.status(400).json({ error: 'projectKey or email query parameter required' })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
