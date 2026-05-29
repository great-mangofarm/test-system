import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminDb } from './lib/admin.js'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!

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

    // 상태 변경 이벤트만 처리
    const statusChange = (body?.changelog?.items ?? []).find(
      (item: Record<string, string>) => item.field === 'status'
    )
    if (!statusChange) {
      return res.status(200).json({ skipped: 'no status change' })
    }

    const issueKey: string = body?.issue?.key
    const newJiraStatus: string = statusChange['toString']
    console.log('[webhook] issueKey:', issueKey, '| status:', newJiraStatus)

    if (!issueKey || !newJiraStatus) {
      return res.status(200).json({ skipped: 'missing data' })
    }

    const newProcessingStatus = STATUS_MAP[newJiraStatus]
    if (!newProcessingStatus) {
      console.log('[webhook] skipped unmapped status:', newJiraStatus)
      return res.status(200).json({ skipped: `unmapped: ${newJiraStatus}` })
    }

    // ticketLink로 Firestore 테스트케이스 조회
    const ticketLink = `${JIRA_BASE_URL}/browse/${issueKey}`
    const snap = await adminDb
      .collection('testcases')
      .where('ticketLink', '==', ticketLink)
      .limit(1)
      .get()

    if (snap.empty) {
      console.log('[webhook] no testcase found for', ticketLink)
      return res.status(200).json({ skipped: `no testcase for ${ticketLink}` })
    }

    await snap.docs[0].ref.update({
      processingStatus: newProcessingStatus,
      updatedAt: new Date().toISOString(),
    })

    console.log('[webhook] updated', issueKey, '->', newProcessingStatus)
    return res.status(200).json({ ok: true, issueKey, newProcessingStatus })
  } catch (e) {
    console.log('[webhook] error:', String(e))
    return res.status(500).json({ error: String(e) })
  }
}
