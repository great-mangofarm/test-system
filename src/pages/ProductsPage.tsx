import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/firestore'
import { logout } from '@/store/auth'
import type { Product } from '@/types'
import { Plus, Package, ArrowRight, Pencil, Trash2, LogOut } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setProducts(await getProducts()) }
    finally { setLoading(false) }
  }

  function openCreate() {
    setEditTarget(null)
    setForm({ name: '', description: '' })
    setDialogOpen(true)
  }

  function openEdit(p: Product) {
    setEditTarget(p)
    setForm({ name: p.name, description: p.description })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        await updateProduct(editTarget.id, { name: form.name, description: form.description })
        toast({ title: '프로덕트 수정 완료' })
      } else {
        await createProduct({ name: form.name, description: form.description })
        toast({ title: '프로덕트 등록 완료' })
      }
      setDialogOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteProduct(id)
    toast({ title: '프로덕트 삭제됨', variant: 'destructive' })
    await load()
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">QA 테스트 시스템</h1>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} size="sm">
                <Plus /> 프로덕트 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editTarget ? '프로덕트 수정' : '새 프로덕트'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>프로덕트명 *</Label>
                  <Input
                    placeholder="예: 에버온 앱 v2.0"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>설명</Label>
                  <Textarea
                    placeholder="테스트 대상에 대한 간단한 설명"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
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
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut /> 로그아웃
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">프로덕트 선택</h2>
          <p className="text-slate-500 mt-1">테스트할 프로덕트를 선택하세요</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>등록된 프로덕트가 없습니다</p>
            <Button className="mt-4" onClick={openCreate}><Plus /> 첫 프로덕트 추가</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
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
                            <AlertDialogTitle>프로덕트 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{p.name}"을 삭제하시겠습니까? 연결된 테스트 데이터는 삭제되지 않습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardTitle className="text-base mt-2">{p.name}</CardTitle>
                  {p.description && <CardDescription className="text-xs line-clamp-2">{p.description}</CardDescription>}
                </CardHeader>
                <CardFooter className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/products/${p.id}/suites`)}
                  >
                    테스트 관리 <ArrowRight className="ml-auto w-4 h-4" />
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
