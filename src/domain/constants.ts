import type { EventCategory, NoteCategory, Priority, ProjectStatus, TaskStatus } from './types'

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
}
export const PRIORITY_WEIGHT: Record<Priority, number> = { low: 1, medium: 2, high: 3, critical: 4 }
export const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: 'Запланировано',
  in_progress: 'В работе',
  waiting: 'Ожидает',
  done: 'Выполнено',
}
export const STATUSES: TaskStatus[] = ['planned', 'in_progress', 'waiting', 'done']

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'Идея',
  active: 'Активный',
  paused: 'На паузе',
  closed: 'Закрыт',
}

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  meeting: 'Встреча',
  conference: 'Конференция',
  payment: 'Платёж',
  event: 'Событие',
  focus: 'Фокус-блок',
  personal: 'Личное',
}
/** Цвета категорий: подобраны так, чтобы читаться в обеих темах */
export const EVENT_CATEGORY_COLOR: Record<EventCategory, string> = {
  meeting: '#2346e0',
  conference: '#0891b2',
  payment: '#ca8a04',
  event: '#0e9f6e',
  focus: '#64748b',
  personal: '#ec4899',
}

export const NOTE_CATEGORY_LABEL: Record<NoteCategory, string> = {
  idea: 'Идея',
  note: 'Заметка',
  hypothesis: 'Гипотеза',
  observation: 'Наблюдение',
  material: 'Материал',
}

export const PROJECT_COLORS = ['#2346e0', '#0e9f6e', '#e8590c', '#0891b2', '#ca8a04', '#db2777', '#65a30d', '#64748b']

export const DEFAULT_TASK_MINUTES = 60
export const MIN_BLOCK_MINUTES = 15

/** Первый 90-дневный спринт из ТЗ */
export const FIRST_SPRINT = { startDate: '2026-11-09', endDate: '2027-02-06', name: 'Спринт 1 · 90 дней' }

export const SCHEMA_VERSION = 1
