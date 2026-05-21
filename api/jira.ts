import type { VercelRequest, VercelResponse } from '@vercel/node'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!        // https://everonteam.atlassian.net
const JIRA_EMAIL = process.env.JIRA_EMAIL!              // jyp@everon.co.kr
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!      // API 토큰

const PRIORITY_MAP: Record<string, string> = {
  critical: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { projectKey, title, area, priority, steps, expectedResult, actualResult } = req.body

  if (!projectKey || !title) {
    return res.status(400).json({ error: 'projectKey and title are required' })
  }

  const description = [
    area && `*영역:* ${area}`,
    steps && `\n*테스트 절차:*\n${steps}`,
    expectedResult && `\n*기대 결과:*\n${expectedResult}`,
    actualResult && `\n*실제 결과:*\n${actualResult}`,
  ].filter(Boolean).join('\n')

  const body = {
    fields: {
      project: { key: projectKey },
      summary: title,
      description: {
        type: 'doc',
        version: 1,
        content: description ? [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: description }],
          },
        ] : [],
      },
      issuetype: { name: 'Bug' },
      priority: { name: PRIORITY_MAP[priority] ?? 'Medium' },
    },
  }

  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.errorMessages ?? data })
    }

    const issueKey = data.key  // 예: EPC-42
    const issueUrl = `${JIRA_BASE_URL}/browse/${issueKey}`

    return res.status(200).json({ issueKey, issueUrl })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
