import { useState } from 'react'
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { changePassword } from '@/store/auth'
import { toast } from '@/hooks/use-toast'
import { Eye, EyeOff } from 'lucide-react'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다')
      return
    }
    setLoading(true)
    setError('')
    try {
      await changePassword(next)
      toast({ title: '비밀번호가 변경되었습니다' })
      onClose()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/requires-recent-login') {
        setError('보안을 위해 다시 로그인 후 시도해주세요')
      } else {
        setError('비밀번호 변경에 실패했습니다')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>비밀번호 변경</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>현재 비밀번호</Label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              placeholder="현재 비밀번호"
              value={current}
              onChange={(e) => { setCurrent(e.target.value); setError('') }}
              className="pr-10"
              autoFocus
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowCurrent((v) => !v)}
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>새 비밀번호</Label>
          <div className="relative">
            <Input
              type={showNext ? 'text' : 'password'}
              placeholder="6자 이상"
              value={next}
              onChange={(e) => { setNext(e.target.value); setError('') }}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowNext((v) => !v)}
              tabIndex={-1}
            >
              {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>새 비밀번호 확인</Label>
          <Input
            type="password"
            placeholder="새 비밀번호 재입력"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError('') }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={!current || !next || !confirm || loading}>
            {loading ? '변경 중...' : '변경'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
