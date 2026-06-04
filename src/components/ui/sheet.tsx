import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Sheet({ open, onClose, children, className }: SheetProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* 오버레이 */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />
      {/* 드로어 패널 */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full bg-white shadow-2xl transition-transform duration-250 ease-in-out flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full',
          className ?? 'w-[780px] max-w-[95vw]',
        )}
      >
        {children}
      </div>
    </>
  )
}

export function SheetHeader({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onClose}
        className="ml-4 shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      {children}
    </div>
  )
}

export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 px-6 py-4 border-t bg-slate-50 flex items-center justify-end gap-2">
      {children}
    </div>
  )
}
