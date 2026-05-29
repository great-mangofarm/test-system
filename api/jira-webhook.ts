import type { VercelRequest, VercelResponse } from '@vercel/node'

const FIREBASE_PROJECT_ID = 'qa-test-274fa'
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY!
const JIRA_BASE_URL = process.env.JIRA_BASE_URL! // e.g. https://yourteam.atlassian.net

// Jira 상태명(소문자) → 우리 processingStatus 매핑
const STATUS_MAP: Record<string, string> = {
  'to do': 'pending',
  'open': 'pending',
  'backlog': 'pending',
  '할 일': 'pending',
  'in progress': 'in_progress',
  'in review': 'in_progress',
  '진행 중': 'in_progress',
  '검토 중': 'in_progress',
  'done': 'resolved',
  'resolved': 'resolved',
  'closed': 'resolved',
  '완료': 'resolved',
  "won't do": 'wont_fix',
  'wont do': 'wont_fix',
  'invalid': 'wont_fix',
  '보류': 'wont_fix',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body

    // 상태 변경 이벤트만 처리
    const statusChange = (body?.changelog?.items ?? []).find(
      (item: { field: string }) => item.field === 'status'
    )
    if (!statusChange) {
      return res.status(200).json({ skipped: 'no status change in payload' })
    }

    const issueKey: string = body?.issue?.key
    const newJiraStatus: string = statusChange.toString // e.g. "In Progress"
    if (!issueKey || !newJiraStatus) {
      return res.status(200).json({ skipped: 'missing issueKey or status' })
    }

    const newProcessingStatus = STATUS_MAP[newJiraStatus.toLowerCase()]
    if (!newProcessingStatus) {
      return res.status(200).json({ skipped: `unmapped jira status: ${newJiraStatus}` })
    }

    // ticketLink로 Firestore 테스트케이스 조회
    const ticketLink = `${JIRA_BASE_URL}/browse/${issueKey}`
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`

    const queryRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'testcases' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'ticketLink' },
              op: 'EQUAL',
              value: { stringValue: ticketLink },
            },
          },
          limit: 1,
        },
      }),
    })

    const queryData = await queryRes.json()
    const doc = queryData?.[0]?.document
    if (!doc) {
      return res.status(200).json({ skipped: `no testcase found for ${ticketLink}` })
    }

    // document name에서 ID 추출: .../documents/testcases/{docId}
    const docId = doc.name.split('/').pop()

    // processingStatus 업데이트
    const updateUrl = [
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}`,
      `/databases/(default)/documents/testcases/${docId}`,
      `?updateMask.fieldPaths=processingStatus&updateMask.fieldPaths=updatedAt`,
      `&key=${FIREBASE_API_KEY}`,
    ].join('')

    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          processingStatus: { stringValue: newProcessingStatus },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    })

    if (!updateRes.ok) {
      const err = await updateRes.json()
      return res.status(500).json({ error: 'firestore update failed', detail: err })
    }

    return res.status(200).json({ ok: true, issueKey, newProcessingStatus })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
