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
      const assigneeAccountId: string | undefined = body?.issue?.fields?.assignee?.accountId

      if (!assigneeAccountId) {
        updates.assignedDeveloper = ''
        console.log('[webhook] assignee removed')
      } else {
        // assignable/search로 프로젝트 멤버 전체 조회 → accountId로 매칭 → 이메일로 우리 유저 찾기
        try {
          const projectKey = issueKey.split('-')[0]
          const r = await fetch(
            `${JIRA_BASE_URL}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&maxResults=100`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
                Accept: 'application/json',
              },
            }
          )
          const jiraUsers: Array<{ accountId: string; displayName: string; emailAddress?: string }> = await r.json()
          const jiraUser = jiraUsers.find((u) => u.accountId === assigneeAccountId)
          console.log('[webhook] assignable search result for accountId:', assigneeAccountId, '->', jiraUser?.displayName ?? 'not found')

          if (jiraUser) {
            const email = jiraUser.emailAddress ?? ''
            if (email) {
              // 이메일로 우리 유저 매핑
              const emailSnap = await adminDb.collection('users').where('email', '==', email).limit(1).get()
              if (!emailSnap.empty) {
                updates.assignedDeveloper = emailSnap.docs[0].data().displayName
                console.log('[webhook] matched by email:', email, '->', updates.assignedDeveloper)
              } else {
                console.log('[webhook] no Firestore user for email:', email)
              }
            } else {
              // 이메일 비공개면 jiraDisplayName → displayName 순으로 fallback
              const jiraName = jiraUser.displayName
              console.log('[webhook] email hidden, trying jiraName:', jiraName)
              const jiraNameSnap = await adminDb.collection('users').where('jiraDisplayName', '==', jiraName).limit(1).get()
              if (!jiraNameSnap.empty) {
                updates.assignedDeveloper = jiraNameSnap.docs[0].data().displayName
                console.log('[webhook] matched by jiraDisplayName:', jiraName, '->', updates.assignedDeveloper)
              } else {
                const nameSnap = await adminDb.collection('users').where('displayName', '==', jiraName).limit(1).get()
                if (!nameSnap.empty) {
                  updates.assignedDeveloper = jiraName
                  console.log('[webhook] matched by displayName:', jiraName)
                } else {
                  console.log('[webhook] no match for jiraName:', jiraName)
                }
              }
            }
          }
        } catch (e) {
          console.log('[webhook] assignee lookup error:', String(e))
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
