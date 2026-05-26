import { cn } from '@/lib/utils'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
  color?: 'primary' | 'destructive'
}

export function Checkbox({ checked, onChange, className, color = 'primary' }: CheckboxProps) {
  const borderColor = color === 'destructive' ? 'border-destructive' : 'border-primary'
  const bgColor = color === 'destructive' ? 'bg-destructive' : 'bg-primary'

  return (
    <label className={cn('relative flex items-center cursor-pointer shrink-0', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div className={cn(
        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
        checked ? `${bgColor} border-transparent` : `bg-white ${borderColor}`
      )}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </label>
  )
}
