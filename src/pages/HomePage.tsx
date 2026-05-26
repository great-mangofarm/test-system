import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import {
  getProducts, createProduct, updateProduct, deleteProduct, reorderProducts,
  getSuites, createSuite, updateSuite, deleteSuite, reorderSuites, getSuiteStats,
  type SuiteStats,
} from '@/lib/firestore'
import { useAuth, logout, deleteAccount } from '@/store/auth'
import type { Product, TestSuite, SuiteType } from '@/types'
import {
  Plus, Package, ClipboardList, ArrowRight, Pencil, Trash2,
  LogOut, Users, KeyRound, ChevronDown, GripVertical, Wrench,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const SUITE_TYPE_LABELS: Record<SuiteType, string> = { qa: '테스트케이스', dev: '개발요청' }
const SUITE_TYPE_COLORS: Record<SuiteType, string> = {
  qa: 'bg-blue-50 text-blue-600 border-blue-100',
  dev: 'bg-orange-50 text-orange-600 border-orange-100',
}

function DonutChart({ stats }: { stats: SuiteStats }) {
  const { pass, fail, blocked, notTested, total } = stats
  if (total === 0) {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="20" fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <text x="28" y="32" textAnchor="middle" fontSize="10" fill="#94a3b8">0</text>
      </svg>
    )
  }

  const r = 20
  const cx = 28, cy = 28
  const circ = 2 * Math.PI * r
  const segments = [
    { value: pass, color: '#22c55e' },
    { value: fail, color: '#ef4444' },
    { value: blocked, color: '#f97316' },
    { value: notTested, color: '#e2e8f0' },
  ]

  let cumulative = 0
  const passRate = Math.round((pass / total) * 100)

  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const offset = -(cumulative / total) * circ
        cumulative += seg.value
        return (
          <circle
            key={i}
            r={r} cx={cx} cy={cy}
            fill="none"
            stroke={seg.color}
            strokeWidth="7"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fontWeight="600" fill="#475569">{passRate}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#94a3b8">통과율</text>
    </svg>
  )
}

type ProductDialog = { mode: 'create' | 'edit'; target?: Product }
type SuiteDialog = { mode: 'create' | 'edit'; target?: TestSuite }

// Sortable product item
function SortableProduct({
  product, selected, isAdmin, onSelect, onEdit, onDelete,
}: {
  product: Product
  selected: boolean
  isAdmin: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id, disabled: !isAdmin })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-2 mx-2 my-0.5 px-2 py-2 rounded-md cursor-pointer transition-colors',
        selected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-slate-50 text-slate-700',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={onSelect}
    >
      {isAdmin && (
        <span
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}
      <Package className="w-4 h-4 shrink-0" />
      <span className="text-sm flex-1 truncate">{product.name}</span>
      {isAdmin && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
          <button className="p-0.5 rounded hover:bg-slate-200" onClick={(e) => { e.stopPropagation(); onEdit() }}>
            <Pencil className="w-3 h-3" />
          </button>
          <button className="p-0.5 rounded hover:bg-red-100 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// Sortable suite item
function SortableSuite({
  suite, stats, isAdmin, onOpen, onEdit, onDelete,
}: {
  suite: TestSuite
  stats?: SuiteStats
  isAdmin: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: suite.id, disabled: !isAdmin })

  const s = stats

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group bg-white border rounded-xl px-4 py-4 hover:shadow-md transition-shadow cursor-pointer',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={onOpen}
    >
      {/* 상단: 제목 + 차트 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {isAdmin && (
            <span
              {...attributes}
              {...listeners}
              className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing mt-0.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </span>
          )}
          {suite.type === 'dev'
            ? <Wrench className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            : <ClipboardList className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800">{suite.name}</p>
              <span className={cn('text-xs px-1.5 py-0.5 rounded border font-medium', SUITE_TYPE_COLORS[suite.type ?? 'qa'])}>
                {SUITE_TYPE_LABELS[suite.type ?? 'qa']}
              </span>
              {suite.version && <span className="text-xs text-slate-400">{suite.version}</span>}
            </div>
            {s && s.total > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                처리완료 <span className="font-medium text-slate-600">{s.resolved}</span> / 전체 <span className="font-medium text-slate-600">{s.total}</span>
              </p>
            )}
            {s && s.total === 0 && (
              <p className="text-xs text-slate-300 mt-0.5">항목 없음</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
              <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                onClick={(e) => { e.stopPropagation(); onEdit() }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded hover:bg-red-50 text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete() }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {s ? <DonutChart stats={s} /> : <div className="w-14 h-14 rounded-full border-4 border-slate-100 animate-pulse" />}
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* 하단: 상태 바 */}
      {s && s.total > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {s.pass > 0 && <div className="bg-green-500" style={{ flex: s.pass }} />}
            {s.fail > 0 && <div className="bg-red-400" style={{ flex: s.fail }} />}
            {s.blocked > 0 && <div className="bg-orange-400" style={{ flex: s.blocked }} />}
            {s.notTested > 0 && <div className="bg-slate-200" style={{ flex: s.notTested }} />}
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
            {s.pass > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />통과 {s.pass}</span>}
            {s.fail > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />실패 {s.fail}</span>}
            {s.blocked > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />블로킹 {s.blocked}</span>}
            {s.notTested > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />미테스트 {s.notTested}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingSuites, setLoadingSuites] = useState(false)

  const [productDialog, setProductDialog] = useState<ProductDialog | null>(null)
  const [productForm, setProductForm] = useState({ name: '', description: '', jiraProjectKey: '' })
  const [productSaving, setProductSaving] = useState(false)
  const [deleteProduct_, setDeleteProduct_] = useState<Product | null>(null)

  const [suiteStats, setSuiteStats] = useState<Record<string, SuiteStats>>({})

  const [suiteDialog, setSuiteDialog] = useState<SuiteDialog | null>(null)
  const [suiteForm, setSuiteForm] = useState({ name: '', version: '', type: 'qa' as SuiteType })
  const [suiteSaving, setSuiteSaving] = useState(false)
  const [deleteSuite_, setDeleteSuite_] = useState<TestSuite | null>(null)

  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { loadProducts() }, [])
  useEffect(() => {
    if (selectedProduct) loadSuites(selectedProduct.id)
    else setSuites([])
  }, [selectedProduct])

  async function loadProducts() {
    setLoadingProducts(true)
    try {
      const list = await getProducts()
      setProducts(list)
      if (list.length > 0) setSelectedProduct((prev) => prev ?? list[0])
    } finally { setLoadingProducts(false) }
  }

  async function loadSuites(productId: string) {
    setLoadingSuites(true)
    try {
      const list = await getSuites(productId)
      setSuites(list)
      // 각 suite의 stats 병렬 로드
      const statsEntries = await Promise.all(
        list.map(async (s) => [s.id, await getSuiteStats(s.id)] as const)
      )
      setSuiteStats(Object.fromEntries(statsEntries))
    } finally { setLoadingSuites(false) }
  }

  // DnD
  async function handleProductDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = products.findIndex((p) => p.id === active.id)
    const newIndex = products.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(products, oldIndex, newIndex)
    setProducts(reordered)
    await reorderProducts(reordered.map((p) => p.id))
  }

  async function handleSuiteDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = suites.findIndex((s) => s.id === active.id)
    const newIndex = suites.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(suites, oldIndex, newIndex)
    setSuites(reordered)
    await reorderSuites(reordered.map((s) => s.id))
  }

  // Product CRUD
  function openProductCreate() {
    setProductForm({ name: '', description: '', jiraProjectKey: '' })
    setProductDialog({ mode: 'create' })
  }
  function openProductEdit(p: Product) {
    setProductForm({ name: p.name, description: p.description, jiraProjectKey: p.jiraProjectKey ?? '' })
    setProductDialog({ mode: 'edit', target: p })
  }
  async function handleProductSave() {
    if (!productForm.name.trim()) return
    setProductSaving(true)
    try {
      if (productDialog?.mode === 'edit' && productDialog.target) {
        await updateProduct(productDialog.target.id, productForm)
        toast({ title: '프로덕트 수정 완료' })
      } else {
        await createProduct(productForm, products.length)
        toast({ title: '프로덕트 추가 완료' })
      }
      setProductDialog(null)
      await loadProducts()
    } finally { setProductSaving(false) }
  }
  async function handleProductDelete() {
    if (!deleteProduct_) return
    await deleteProduct(deleteProduct_.id)
    toast({ title: '프로덕트 삭제됨', variant: 'destructive' })
    if (selectedProduct?.id === deleteProduct_.id) setSelectedProduct(null)
    setDeleteProduct_(null)
    await loadProducts()
  }

  // Suite CRUD
  function openSuiteCreate() {
    setSuiteForm({ name: '', version: '', type: 'qa' })
    setSuiteDialog({ mode: 'create' })
  }
  function openSuiteEdit(s: TestSuite) {
    setSuiteForm({ name: s.name, version: s.version, type: s.type ?? 'qa' })
    setSuiteDialog({ mode: 'edit', target: s })
  }
  async function handleSuiteSave() {
    if (!suiteForm.name.trim() || !selectedProduct) return
    setSuiteSaving(true)
    try {
      if (suiteDialog?.mode === 'edit' && suiteDialog.target) {
        await updateSuite(suiteDialog.target.id, suiteForm)
        toast({ title: '수정 완료' })
      } else {
        await createSuite({ productId: selectedProduct.id, ...suiteForm }, suites.length)
        toast({ title: '추가 완료' })
      }
      setSuiteDialog(null)
      await loadSuites(selectedProduct.id)
    } finally { setSuiteSaving(false) }
  }
  async function handleSuiteDelete() {
    if (!deleteSuite_ || !selectedProduct) return
    await deleteSuite(deleteSuite_.id)
    toast({ title: '삭제됨', variant: 'destructive' })
    setDeleteSuite_(null)
    await loadSuites(selectedProduct.id)
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  async function handleDeleteAccount() {
    try {
      await deleteAccount()
      navigate('/login')
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/requires-recent-login') {
        toast({
          title: '재로그인 필요',
          description: '보안을 위해 로그아웃 후 다시 로그인하여 탈퇴해주세요',
          variant: 'destructive',
        })
      } else {
        toast({ title: '계정 삭제 실패', description: String((e as Error).message), variant: 'destructive' })
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800">에버온 이슈트래커</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <Users className="w-4 h-4" /> 사용자 관리
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {user?.displayName} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPwModalOpen(true)}>
                <KeyRound className="w-4 h-4" /> 비밀번호 변경
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4" /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Products */}
        <aside className="w-60 bg-white border-r flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">프로덕트</span>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openProductCreate}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loadingProducts ? (
              <div className="space-y-1 px-2 pt-1">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm px-4">
                <Package className="w-7 h-7 mx-auto mb-2 opacity-30" />
                {isAdmin
                  ? <button className="text-primary hover:underline text-xs" onClick={openProductCreate}>+ 프로덕트 추가</button>
                  : '프로덕트가 없습니다'}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
                <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {products.map((p) => (
                    <SortableProduct
                      key={p.id}
                      product={p}
                      selected={selectedProduct?.id === p.id}
                      isAdmin={isAdmin}
                      onSelect={() => setSelectedProduct(p)}
                      onEdit={() => openProductEdit(p)}
                      onDelete={() => setDeleteProduct_(p)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </aside>

        {/* Right: Suites */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
            <span className="text-sm font-semibold text-slate-600">
              {selectedProduct ? selectedProduct.name : '프로덕트를 선택하세요'}
            </span>
            {isAdmin && selectedProduct && (
              <Button size="sm" onClick={openSuiteCreate}>
                <Plus /> 묶음 추가
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!selectedProduct ? (
              <div className="text-center py-20 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">좌측에서 프로덕트를 선택하세요</p>
              </div>
            ) : loadingSuites ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-200 animate-pulse" />)}
              </div>
            ) : suites.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">묶음이 없습니다</p>
                {isAdmin && <Button className="mt-3" size="sm" onClick={openSuiteCreate}><Plus /> 묶음 추가</Button>}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSuiteDragEnd}>
                <SortableContext items={suites.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {suites.map((s) => (
                      <SortableSuite
                        key={s.id}
                        suite={s}
                        stats={suiteStats[s.id]}
                        isAdmin={isAdmin}
                        onOpen={() => navigate(`/products/${selectedProduct.id}/suites/${s.id}`)}
                        onEdit={() => openSuiteEdit(s)}
                        onDelete={() => setDeleteSuite_(s)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </main>
      </div>

      {/* Product Dialog */}
      <Dialog open={!!productDialog} onOpenChange={(o) => !o && setProductDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{productDialog?.mode === 'edit' ? '프로덕트 수정' : '새 프로덕트'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>프로덕트명 *</Label>
              <Input placeholder="예: 에버온 앱 v2.0" value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea placeholder="테스트 대상에 대한 간단한 설명" value={productForm.description} rows={3}
                onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Jira 프로젝트 키 <span className="text-xs text-slate-400 font-normal">— 티켓 자동 생성 연동</span></Label>
              <Input placeholder="예: EPC, ADMIN" value={productForm.jiraProjectKey}
                onChange={(e) => setProductForm((f) => ({ ...f, jiraProjectKey: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>취소</Button>
            <Button onClick={handleProductSave} disabled={!productForm.name.trim() || productSaving}>
              {productSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suite Dialog */}
      <Dialog open={!!suiteDialog} onOpenChange={(o) => !o && setSuiteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{suiteDialog?.mode === 'edit' ? '묶음 수정' : '새 묶음'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>종류</Label>
              <div className="flex gap-2">
                {(['qa', 'dev'] as SuiteType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSuiteForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                      suiteForm.type === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    {SUITE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input placeholder="예: v2.1 릴리즈" value={suiteForm.name}
                onChange={(e) => setSuiteForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>버전/태그</Label>
              <Input placeholder="예: v2.1.0" value={suiteForm.version}
                onChange={(e) => setSuiteForm((f) => ({ ...f, version: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuiteDialog(null)}>취소</Button>
            <Button onClick={handleSuiteSave} disabled={!suiteForm.name.trim() || suiteSaving}>
              {suiteSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirms */}
      <AlertDialog open={!!deleteProduct_} onOpenChange={(o) => !o && setDeleteProduct_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로덕트 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteProduct_?.name}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleProductDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSuite_} onOpenChange={(o) => !o && setDeleteSuite_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>묶음 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteSuite_?.name}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuiteDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pwModalOpen} onOpenChange={setPwModalOpen}>
        <ChangePasswordModal onClose={() => setPwModalOpen(false)} />
      </Dialog>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정 탈퇴</AlertDialogTitle>
            <AlertDialogDescription>
              정말 탈퇴하시겠습니까? 계정이 영구 삭제되며 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              탈퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
