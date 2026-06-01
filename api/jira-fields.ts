import type { VercelRequest, VercelResponse } from '@vercel/node'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
  const r = await fetch(`${JIRA_BASE_URL}/rest/api/3/field`, {
    headers: { Authorization: auth, Accept: 'application/json' }
  })
  const fields = await r.json()
  return res.status(200).json(fields)
}
