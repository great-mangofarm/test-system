import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { login, sendPasswordReset, useAuth } from '@/store/auth'
import { Lock, Eye, EyeOff, ChevronLeft } from 'lucide-react'

type View = 'login' | 'reset'

export default function LoginPage() {
  const { user } = useAuth()
  const [view, setView] = useState<View>('login')

  // 로그인
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from

  useEffect(() => {
    if (user) {
      const dest = from ? `${from.pathname}${from.search}${from.hash}` : '/'
      navigate(dest, { replace: true })
    }
  }, [user])

  // 비밀번호 찾기
  const [resetLocal, setResetLocal] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetDone, setResetDone] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      await login(email, password, remember)
    } catch {
      setLoginError('이메일 또는 비밀번호가 올바르지 않습니다')
      setPassword('')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetLocal.trim()) {
      setResetError('이메일을 입력해주세요')
      return
    }
    setResetLoading(true)
    setResetError('')
    try {
      await sendPasswordReset(`${resetLocal}@everon.co.kr`)
      setResetDone(true)
    } catch {
      setResetError('메일 발송에 실패했습니다. 등록된 계정인지 확인해주세요')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">에버온 이슈트래커</CardTitle>
          <CardDescription>
            {view === 'login' ? '계정 정보를 입력하세요' : '비밀번호 찾기'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {view === 'login' ? (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="이메일 입력"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLoginError('') }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호 입력"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginError && <p className="text-sm text-destructive">{loginError}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={remember} onChange={setRemember} />
                    <span className="font-normal text-sm text-slate-600">로그인 유지</span>
                  </label>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-primary hover:underline"
                    onClick={() => setView('reset')}
                  >
                    비밀번호 찾기
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={!email || !password || loginLoading}>
                  {loginLoading ? '로그인 중...' : '로그인'}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">또는</span>
                </div>
              </div>

              <Link to="/register">
                <Button variant="outline" className="w-full">계정 등록</Button>
              </Link>
            </>
          ) : (
            <>
              <button
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 -mt-1"
                onClick={() => { setView('login'); setResetDone(false); setResetLocal(''); setResetError('') }}
              >
                <ChevronLeft className="w-4 h-4" /> 로그인으로 돌아가기
              </button>

              {resetDone ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm font-medium text-slate-800">메일을 발송했습니다</p>
                  <p className="text-xs text-slate-500">
                    {resetLocal}@everon.co.kr 으로 비밀번호 재설정 링크를 보냈어요.
                    메일함을 확인해주세요.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label>이메일</Label>
                    <div className="flex">
                      <Input
                        type="text"
                        placeholder="example"
                        value={resetLocal}
                        onChange={(e) => { setResetLocal(e.target.value); setResetError('') }}
                        className="rounded-r-none border-r-0"
                        autoFocus
                      />
                      <span className="flex items-center px-3 bg-slate-50 border border-slate-200 rounded-r-md text-sm text-slate-500 whitespace-nowrap">
                        @everon.co.kr
                      </span>
                    </div>
                    {resetError && <p className="text-sm text-destructive">{resetError}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={!resetLocal || resetLoading}>
                    {resetLoading ? '발송 중...' : '재설정 메일 발송'}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
