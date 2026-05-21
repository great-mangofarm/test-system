import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth, logout, sendPasswordReset, deleteUserDoc } from '@/store/auth'
import type { UserProfile, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft, LogOut, Users, RotateCcw, Trash2 } from 'lucide-react'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  developer: '개발자',
  viewer: '뷰어',
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700 border border-red-200',
  developer: 'bg-blue-100 text-blue-700 border border-blue-200',
  viewer: 'bg-slate-100 text-slate-600 border border-slate-200',
}

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const list = snap.docs.map((d) => d.data() as UserProfile)
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      setUsers(list)
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    setUpdating(uid)
    try {
      await updateDoc(doc(db, 'users', uid), { role })
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)))
      toast({ title: '권한이 변경되었습니다' })
    } catch {
      toast({ title: '권한 변경 실패', variant: 'destructive' })
    } finally {
      setUpdating(null)
    }
  }

  async function handlePasswordReset(email: string) {
    setResetting(email)
    try {
      await sendPasswordReset(email)
      toast({ title: '비밀번호 초기화 메일을 발송했습니다' })
    } catch {
      toast({ title: '메일 발송 실패', variant: 'destructive' })
    } finally {
      setResetting(null)
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    try {
      await deleteUserDoc(deleteTarget.uid)
      setUsers((prev) => prev.filter((u) => u.uid !== deleteTarget.uid))
      toast({ title: `${deleteTarget.displayName} 계정이 삭제되었습니다` })
    } catch (e) {
      toast({ title: '계정 삭제 실패', description: String((e as Error).message), variant: 'destructive' })
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-slate-800">사용자 관리</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut /> 로그아웃
        </Button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-sm text-slate-500 mb-6">
          총 {users.length}명 · 로그인: {user?.email}
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.uid}
                className="bg-white rounded-lg border px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">{u.displayName}</p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.uid !== user?.uid && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-slate-500"
                        disabled={resetting === u.email}
                        onClick={() => handlePasswordReset(u.email)}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {resetting === u.email ? '발송 중...' : '비밀번호 초기화'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </Button>
                    </>
                  )}
                  {u.uid === user?.uid ? (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]} (나)
                    </span>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => handleRoleChange(u.uid, v as UserRole)}
                      disabled={updating === u.uid}
                    >
                      <SelectTrigger className="w-28 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">관리자</SelectItem>
                        <SelectItem value="developer">개발자</SelectItem>
                        <SelectItem value="viewer">뷰어</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.displayName}</strong> ({deleteTarget?.email}) 계정을 삭제하시겠습니까?<br />
              삭제 후 해당 계정으로 로그인할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
