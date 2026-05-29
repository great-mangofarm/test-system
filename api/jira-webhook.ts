import type { VercelRequest, VercelResponse } from '@vercel/node'

const FIREBASE_PROJECT_ID = 'qa-test-274fa'
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY!
const JIRA_BASE_URL = process.env.JIRA_BASE_URL! // e.g. https://yourteam.atlassian.net

// Jira 상태명 → 우리 processingStatus 매핑
const STATUS_MAP: Record<string, string> = {
  '백로그': 'pending',
  '기획중': 'in_progress',
  '개발대기': 'in_progress',
  '개발중': 'in_progress',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body
    console.log('[webhook] received:', JSON.stringify(body?.changelog?.items))

    // 상태 변경 이벤트만 처리
    const statusChange = (body?.changelog?.items ?? []).find(
      (item: Record<string, string>) => item.field === 'status'
    )
    if (!statusChange) {
      console.log('[webhook] skipped: no status change')
      return res.status(200).json({ skipped: 'no status change in payload' })
    }

    const issueKey: string = body?.issue?.key
    // Jira changelog item의 실제 키명은 "toString" (문자열 속성)
    const newJiraStatus: string = statusChange['toString']
    console.log('[webhook] issueKey:', issueKey, '| newJiraStatus:', newJiraStatus)

    if (!issueKey || !newJiraStatus) {
      return res.status(200).json({ skipped: 'missing issueKey or status' })
    }

    const newProcessingStatus = STATUS_MAP[newJiraStatus]
    if (!newProcessingStatus) {
      console.log('[webhook] skipped: unmapped status:', newJiraStatus)
      return res.status(200).json({ skipped: `unmapped jira status: ${newJiraStatus}` })
    }

    // ticketLink로 Firestore 테스트케이스 조회
    const ticketLink = `${JIRA_BASE_URL}/browse/${issueKey}`
    console.log('[webhook] searching ticketLink:', ticketLink)

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

    if (!queryRes.ok) {
      const err = await queryRes.json()
      console.log('[webhook] firestore query error:', JSON.stringify(err))
      return res.status(500).json({ error: 'firestore query failed', detail: err })
    }

    const queryData = await queryRes.json()
    console.log('[webhook] query result count:', queryData?.length, '| has doc:', !!queryData?.[0]?.document)

    const doc = queryData?.[0]?.document
    if (!doc) {
      return res.status(200).json({ skipped: `no testcase found for ${ticketLink}` })
    }

    const docId = doc.name.split('/').pop()
    console.log('[webhook] found docId:', docId, '| updating to:', newProcessingStatus)

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
      console.log('[webhook] firestore update error:', JSON.stringify(err))
      return res.status(500).json({ error: 'firestore update failed', detail: err })
    }

    console.log('[webhook] success:', issueKey, '->', newProcessingStatus)
    return res.status(200).json({ ok: true, issueKey, newProcessingStatus })
  } catch (e) {
    console.log('[webhook] exception:', String(e))
    return res.status(500).json({ error: String(e) })
  }
}
