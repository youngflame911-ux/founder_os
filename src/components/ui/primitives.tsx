import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ───── Button ─────
export const buttonVariants = cva(
  'fos-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background hover:bg-foreground/85',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 sm:h-9 sm:px-3.5',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-10 px-5',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'

// ───── Inputs ─────
const fieldBase =
  'w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:opacity-50'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-9 py-1', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[80px] py-2 leading-relaxed', className)} {...props} />
))
Textarea.displayName = 'Textarea'

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

/** Нативный select: лучший UX на мобильных. Стрелка — inline-стилем, чтобы tailwind-merge не снял фон */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, style, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, 'h-9 appearance-none pr-8', className)}
    style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.6rem center', backgroundSize: 16, ...style }}
    {...props}
  />
))
Select.displayName = 'Select'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-medium text-muted-foreground', className)} {...props} />
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Checkbox({ checked, onChange, className, label, ...rest }: { checked: boolean; onChange: (v: boolean) => void; className?: string; label?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked'>) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={cn('h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[hsl(var(--primary))]', className)}
      {...rest}
    />
  )
}

// ───── Card ─────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border bg-card text-card-foreground', className)} {...props} />
}
export function CardHeader({ title, action, description, className, icon }: { title: React.ReactNode; action?: React.ReactNode; description?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pb-3 pt-4', className)}>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-display text-[17px] font-bold leading-tight [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

// ───── Badge ─────
export const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap', {
  variants: {
    variant: {
      default: 'bg-secondary text-secondary-foreground',
      outline: 'border border-border text-muted-foreground',
      primary: 'bg-primary/10 text-primary',
      success: 'bg-success/12 text-success',
      warning: 'bg-warning/15 text-warning',
      destructive: 'bg-destructive/12 text-destructive',
      demo: 'border border-dashed border-warning/60 text-warning',
    },
  },
  defaultVariants: { variant: 'default' },
})
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
export const DemoBadge = () => (
  <Badge variant="demo" title="Демонстрационная запись — удаляется в настройках">
    Демо
  </Badge>
)

// ───── Progress ─────
export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${v}%`, ...(color ? { background: color } : {}) }} />
    </div>
  )
}

// ───── Segmented control ─────
export function Segmented<T extends string>({ value, onChange, options, className, size = 'default' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; className?: string; size?: 'default' | 'sm' }) {
  return (
    <div className={cn('inline-flex rounded-md bg-secondary p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[3px] font-medium text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-3.5',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
            value === o.value && 'bg-background text-foreground shadow-sm',
          )}
        >
          {o.icon}
          <span className="whitespace-nowrap">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ───── Empty state ─────
export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 rounded-md bg-secondary p-2.5 text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ───── Stat ─────
export function Stat({ label, value, sub, tone, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'default' | 'danger' | 'success' | 'warning'; icon?: React.ReactNode }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground [&_svg]:size-3.5">
        <span>{label}</span>
        {icon}
      </div>
      <div
        className={cn(
          'mt-1 font-display text-[30px] font-bold leading-tight tabular',
          tone === 'danger' && 'text-destructive',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fos-rule fos-enter mb-6 flex flex-wrap items-end justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] font-bold leading-[1.1] md:text-[40px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
