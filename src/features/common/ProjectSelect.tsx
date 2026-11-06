import type { ID } from '@/domain/types'
import { Select } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'

export function ProjectSelect({ value, onChange, allowClosed, id }: { value: ID | null; onChange: (v: ID | null) => void; allowClosed?: boolean; id?: string }) {
  const projects = useAppStore((s) => s.projects)
  const list = projects.filter((p) => allowClosed || p.status !== 'closed' || p.id === value)
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Без проекта</option>
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.status === 'closed' ? ' (архив)' : ''}
        </option>
      ))}
    </Select>
  )
}

/** Часы ↔ минуты для полей длительности */
export const toHoursInput = (m: number | null) => (m == null ? '' : String(Math.round((m / 60) * 100) / 100))
export const fromHoursInput = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : null
}
