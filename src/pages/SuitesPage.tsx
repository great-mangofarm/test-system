import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getProducts, getSuites, createSuite, updateSuite, deleteSuite } from '@/lib/firestore'
import { useAuth } from '@/store/auth'
import type { Product, TestSuite } from '@/types'
import { Plus, ClipboardList, ArrowRight, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function SuitesPage() {
  const { productId } = useParams<{ productId: string }>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [product, setProduct] = useState<Product | null>(null)
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TestSuite | null>(null)
  const [form, setForm] = useState({ name: '', version: '' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load() }, [productId])

  async function load() {
    if (!productId) return
    setLoading(true)
    try {
      const [prods, suitesData] = await Promise.all([getProducts(), getSuites(productId)])
      setProduct(prods.find((p) => p.id === productId) ?? null)
      setSuites(suitesData)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditTarget(null)
    setForm({ name: '', version: '' })
    setDialogOpen(true)
  }

  function openEdit(s: TestSuite) {
    setEditTarget(s)
    setForm({ name: s.name, version: s.version })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !productId) return
    setSaving(true)
    try {
      if (editTarget) {
        await updateSuite(editTarget.id, { name: form.name, version: form.version })
        toast({ title: '테스트 묶음 수정 완료' })
      } else {
        await createSuite({ productId, name: form.name, version: form.version })
        toast({ title: '테스트 묶음 생성 완료' })
      }
      setDialogOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteSuite(id)
    toast({ title: '테스트 묶음 삭제됨', variant: 'destructive' })
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800">
            <ChevronLeft className="w-4 h-4" /> 프로덕트 선택
          </Button>
          <span className="text-slate-300">/</span>
          <h1 className="text-lg font-bold text-slate-800">{product?.name ?? '...'}</h1>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} size="sm">
                <Plus /> 테스트 묶음 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editTarget ? '테스트 묶음 수정' : '새 테스트 묶음'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>이름 *</Label>
                  <Input
                    placeholder="예: v2.1 릴리즈 테스트"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>버전/태그</Label>
                  <Input
                    placeholder="예: v2.1.0"
                    value={form.version}
                    onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
                <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">테스트 묶음</h2>
          <p className="text-slate-500 mt-1">버전별/릴리즈별로 테스트 케이스를 묶어 관리하세요</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => <div key={i} className="h-36 rounded-lg bg-slate-200 animate-pulse" />)}
          </div>
        ) : suites.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>테스트 묶음이 없습니다</p>
            {isAdmin && <Button className="mt-4" onClick={openCreate}><Plus /> 테스트 묶음 추가</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suites.map((s) => (
              <Card key={s.id} className="hover:shadow-md transition-shadow group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                    </div>
                    {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>테스트 묶음 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{s.name}"을 삭제하시겠습니까?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{s.name}</CardTitle>
                  {s.version && <CardDescription className="text-xs">{s.version}</CardDescription>}
                </CardHeader>
                <CardFooter className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/products/${productId}/suites/${s.id}`)}
                  >
                    테스트 케이스 보기 <ArrowRight className="ml-auto w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
