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

// HTML 태그 제거 (Tiptap 출력 → 평문)
function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

// HTML → ADF paragraph 노드 배열 (줄바꿈마다 별도 paragraph)
function htmlToADFParagraphs(html: string): unknown[] {
  const text = stripHtml(html)
  if (!text.trim()) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }))
}

function buildIssueADF(background: string, requirements: string, figmaLink: string, featureSpec: string) {
  const content: unknown[] = []

  function addSection(label: string, html: string) {
    const paras = htmlToADFParagraphs(html)
    if (paras.length === 0) return
    content.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: label }] },
      ...paras,
    )
  }

  addSection('개요', background)
  addSection('범위 및 요구사항', requirements)
  if (figmaLink) {
    content.push(
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '피그마 링크' }] },
      { type: 'paragraph', content: [{ type: 'text', text: figmaLink, marks: [{ type: 'link', attrs: { href: figmaLink } }] }] },
    )
  }
  addSection('기능 / 화면 정의', featureSpec)

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
    reporterName,
    reporterEmail,
    dueDate,
    startDate,
    planningLink,
    images,
    // 개발요청 이슈 전용
    recordType,
    background,
    requirements,
    figmaLink,
    featureSpec,
  } = req.body

  if (!projectKey || !title) {
    return res.status(400).json({ error: 'projectKey and title are required' })
  }

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary: title,
    issuetype: { name: issueType || '버그' },
    priority: { name: PRIORITY_MAP[priority] ?? 'Medium' },
    description: recordType === 'issue'
      ? buildIssueADF(background ?? '', requirements ?? '', figmaLink ?? '', featureSpec ?? '')
      : buildADF(area, steps, expectedResult, actualResult),
  }

  if (assigneeAccountId) {
    fields.assignee = { id: assigneeAccountId }
  }

  // 보고자 (reporter) - 이메일로 accountId 조회
  if (reporterEmail) {
    try {
      const authHeader = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
      const r = await fetch(
        `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(reporterEmail)}`,
        { headers: { Authorization: authHeader, Accept: 'application/json' } }
      )
      if (r.ok) {
        const users = await r.json()
        const match = users.find((u: { emailAddress: string }) => u.emailAddress === reporterEmail)
        if (match) fields.reporter = { id: match.accountId }
      }
    } catch { /* reporter 설정 실패 시 무시 */ }
  }

  // 요청자 (커스텀 필드)
  if (reporterName) {
    fields.customfield_10037 = reporterName
  }
  // 기한
  if (dueDate) {
    fields.duedate = dueDate
  }
  // 시작일
  if (startDate) {
    fields.customfield_10015 = startDate
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

    // 첨부 이미지 업로드
    const imageUrls: string[] = Array.isArray(images) ? images : []
    const authHeader = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
    for (const imageUrl of imageUrls) {
      try {
        const imgRes = await fetch(imageUrl)
        if (!imgRes.ok) continue
        const imgBuffer = await imgRes.arrayBuffer()
        const contentType = imgRes.headers.get('content-type') || 'image/png'
        const ext = contentType.split('/')[1]?.split('+')[0] || 'png'
        const filename = `image-${Date.now()}.${ext}`

        const formData = new FormData()
        formData.append('file', new Blob([imgBuffer], { type: contentType }), filename)

        await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/attachments`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'X-Atlassian-Token': 'no-check',
          },
          body: formData,
        })
      } catch {
        // 개별 이미지 업로드 실패는 무시하고 계속 진행
      }
    }

    return res.status(200).json({ issueKey, issueUrl })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
