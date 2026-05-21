import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const hasToasts = toasts.some((t) => t.open !== false)

  return (
    <ToastProvider duration={4000}>
      {hasToasts && (
        <div
          className="fixed inset-0 z-[49]"
          onClick={() => toasts.forEach((t) => dismiss(t.id))}
        />
      )}
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className={`${props.className ?? ''} relative z-50`}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
