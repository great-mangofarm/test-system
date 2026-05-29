import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminDb } from './lib/admin.js'

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!

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
    const items: Record<string, string>[] = body?.changelog?.items ?? []
    const issueKey: string = body?.issue?.key
    console.log('[webhook] event:', body?.webhookEvent, '| issue:', issueKey, '| items:', JSON.stringify(items))

    // 이 티켓에 연결된 테스트케이스 조회
    const ticketLink = `${JIRA_BASE_URL}/browse/${issueKey}`
    const snap = await adminDb
      .collection('testcases')
      .where('ticketLink', '==', ticketLink)
      .limit(1)
      .get()

    if (snap.empty) {
      console.log('[webhook] no testcase for', ticketLink)
      return res.status(200).json({ skipped: `no testcase for ${ticketLink}` })
    }

    const updates: Record<string, string> = {}

    // 1. 상태 변경
    const statusChange = items.find((i) => i.field === 'status')
    if (statusChange) {
      const mapped = STATUS_MAP[statusChange['toString']]
      if (mapped) {
        updates.processingStatus = mapped
        console.log('[webhook] status:', statusChange['toString'], '->', mapped)
      } else {
        console.log('[webhook] unmapped status:', statusChange['toString'])
      }
    }

    // 2. 담당자 변경
    const assigneeChange = items.find((i) => i.field === 'assignee')
    if (assigneeChange) {
      const assigneeEmail: string | undefined = body?.issue?.fields?.assignee?.emailAddress
      const assigneeAccountId: string | undefined = body?.issue?.fields?.assignee?.accountId

      if (!body?.issue?.fields?.assignee) {
        // 담당자 제거
        updates.assignedDeveloper = ''
        console.log('[webhook] assignee removed')
      } else if (assigneeEmail) {
        // 이메일로 우리 유저 조회
        const userSnap = await adminDb
          .collection('users')
          .where('email', '==', assigneeEmail)
          .limit(1)
          .get()
        if (!userSnap.empty) {
          updates.assignedDeveloper = userSnap.docs[0].data().displayName
          console.log('[webhook] assignee email match:', assigneeEmail, '->', updates.assignedDeveloper)
        } else {
          console.log('[webhook] no user found for email:', assigneeEmail)
        }
      } else if (assigneeAccountId) {
        // 이메일이 숨겨진 경우 → Jira API로 이메일 조회
        try {
          const r = await fetch(
            `${JIRA_BASE_URL}/rest/api/3/user?accountId=${assigneeAccountId}`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
                Accept: 'application/json',
              },
            }
          )
          if (r.ok) {
            const jiraUser = await r.json()
            const email = jiraUser.emailAddress
            if (email) {
              const userSnap = await adminDb
                .collection('users')
                .where('email', '==', email)
                .limit(1)
                .get()
              if (!userSnap.empty) {
                updates.assignedDeveloper = userSnap.docs[0].data().displayName
                console.log('[webhook] assignee accountId match:', email, '->', updates.assignedDeveloper)
              }
            }
          }
        } catch (e) {
          console.log('[webhook] failed to fetch assignee by accountId:', String(e))
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString()
      await snap.docs[0].ref.update(updates)
      console.log('[webhook] updated', issueKey, updates)
    }

    return res.status(200).json({ ok: true, issueKey, updates })
  } catch (e) {
    console.log('[webhook] error:', String(e))
    return res.status(500).json({ error: String(e) })
  }
}
