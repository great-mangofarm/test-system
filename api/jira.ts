import type { VercelRequest, VercelResponse } from '@vercel/node'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!        // https://everonteam.atlassian.net
const JIRA_EMAIL = process.env.JIRA_EMAIL!              // jyp@everon.co.kr
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!      // API 토큰

const PRIORITY_MAP: Record<string, string> = {
  critical: 'Hotfix',
  high: 'Hotfix',
  medium: 'Medium',
  low: 'Low',
}

function buildADF(area: string, steps: string, expectedResult: string, actualResult: string) {
  const content: unknown[] = []

  function addSection(label: string, text: string) {
    if (!text) return
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: `${label}: `, marks: [{ type: 'strong' }] },
        { type: 'text', text },
      ],
    })
  }

  if (area) addSection('영역', area)
  if (steps) addSection('테스트 절차', steps)
  if (expectedResult) addSection('기대 결과', expectedResult)
  if (actualResult) addSection('실제 결과', actualResult)

  return {
    type: 'doc',
    version: 1,
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    projectKey,
    title,
    area,
    priority,
    steps,
    expectedResult,
    actualResult,
    issueType,
    assigneeAccountId,
    reporterAccountId,
    dueDate,
    planningLink,
  } = req.body

  if (!projectKey || !title) {
    return res.status(400).json({ error: 'projectKey and title are required' })
  }

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary: title,
    issuetype: { name: issueType || '버그' },
    priority: { name: PRIORITY_MAP[priority] ?? 'Medium' },
    description: buildADF(area, steps, expectedResult, actualResult),
  }

  if (assigneeAccountId) {
    fields.assignee = { id: assigneeAccountId }
  }
  if (reporterAccountId) {
    fields.customfield_10037 = { id: reporterAccountId }
  }
  if (dueDate) {
    fields.duedate = dueDate
  }
  if (planningLink) {
    fields.customfield_10122 = planningLink
  }

  const body = { fields }

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
