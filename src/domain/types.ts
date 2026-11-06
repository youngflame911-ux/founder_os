/**
 * Доменная модель Founder OS.
 * Даты без времени хранятся как строки `yyyy-MM-dd` (DateString),
 * моменты времени — как ISO-строки (ISODateTime). Это упрощает
 * сериализацию в localStorage и будущий перенос в Supabase (date / timestamptz).
 */

export type ID = string
export type DateString = string // yyyy-MM-dd
export type ISODateTime = string // ISO 8601
export type TimeString = string // HH:mm

/** Общие поля всех сущностей */
export interface BaseEntity {
  id: ID
  createdAt: ISODateTime
  updatedAt: ISODateTime
  /** Демонстрационная запись — явно помечается в интерфейсе и удаляется одной кнопкой */
  isDemo?: boolean
}

// ───────────── Задачи ─────────────

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'planned' | 'in_progress' | 'waiting' | 'done'

export interface ReminderSettings {
  enabled: boolean
  /** За сколько минут до дедлайна (дедлайн считается на 09:00 дня) */
  offsetMinutes: number
}

export interface Task extends BaseEntity {
  title: string
  description: string
  projectId: ID | null
  priority: Priority
  status: TaskStatus
  /** Дата начала работ — используется в диаграмме Ганта */
  startDate: DateString | null
  deadline: DateString | null
  /** Плановая продолжительность, минуты */
  plannedMinutes: number | null
  /** Фактическая продолжительность, минуты */
  actualMinutes: number | null
  sprintId: ID | null
  /** Номер недели спринта (1..13) — недельный этап */
  sprintWeek: number | null
  /** ID задач, которые должны быть выполнены раньше */
  dependsOn: ID[]
  reminder: ReminderSettings
  completedAt: ISODateTime | null
}

// ───────────── Проекты ─────────────

export type ProjectStatus = 'idea' | 'active' | 'paused' | 'closed'

export interface ProjectClosure {
  reason: string
  lessons: string
  closedAt: ISODateTime
}

export interface Project extends BaseEntity {
  name: string
  description: string
  goal: string
  startDate: DateString
  deadline: DateString | null
  status: ProjectStatus
  color: string
  closure: ProjectClosure | null
}

// ───────────── Календарь ─────────────

export type EventCategory = 'meeting' | 'conference' | 'payment' | 'event' | 'focus' | 'personal'

export interface CalendarEvent extends BaseEntity {
  title: string
  description: string
  start: ISODateTime
  end: ISODateTime
  allDay: boolean
  category: EventCategory
  projectId: ID | null
}

// ───────────── База знаний ─────────────

export type NoteCategory = 'idea' | 'note' | 'hypothesis' | 'observation' | 'material'

export interface Note extends BaseEntity {
  title: string
  content: string
  date: DateString
  category: NoteCategory
  source: string
  projectId: ID | null
  tags: string[]
}

// ───────────── Результаты ─────────────

export interface Achievement extends BaseEntity {
  title: string
  date: DateString
  projectId: ID | null
  description: string
  /** Количественный результат, например 150000 */
  metricValue: number | null
  /** Единица, например «₽», «клиентов» */
  metricUnit: string
  lessons: string
}

// ───────────── 90-дневный спринт ─────────────

export interface SprintGoal {
  id: ID
  title: string
  /** Критерий успеха / метрика */
  target: string
  done: boolean
}

export interface SprintWeek {
  /** 1..N */
  index: number
  startDate: DateString
  endDate: DateString
  /** Цель недельного этапа */
  goal: string
}

export interface Sprint extends BaseEntity {
  name: string
  startDate: DateString
  endDate: DateString
  goals: SprintGoal[]
  weeks: SprintWeek[]
}

// ───────────── Планирование дня ─────────────

export interface WorkdaySettings {
  start: TimeString
  end: TimeString
  breakMinutes: number
  /** Желаемое начало перерыва */
  breakStart: TimeString
}

export interface PlannedBlock {
  taskId: ID
  start: ISODateTime
  end: ISODateTime
}

export interface DayPlan {
  date: DateString
  settings: WorkdaySettings
  blocks: PlannedBlock[]
  fixedAt: ISODateTime
}

// ───────────── Еженедельный обзор ─────────────

export interface WeeklyReviewSnapshot {
  id: ID
  /** Понедельник недели, которая анализируется */
  weekStart: DateString
  createdAt: ISODateTime
  completedTaskIds: ID[]
  plannedHours: number
  actualHours: number
  overdueCount: number
  /** Приоритеты новой недели, сформулированные пользователем */
  priorities: string
  notes: string
}

// ───────────── Корневое состояние ─────────────

export interface AppSettings {
  workday: WorkdaySettings
  /** Сколько дней без изменений считать «проект без активности» */
  inactivityDays: number
  activeSprintId: ID | null
}

export interface AppData {
  schemaVersion: number
  projects: Project[]
  tasks: Task[]
  events: CalendarEvent[]
  notes: Note[]
  results: Achievement[]
  sprints: Sprint[]
  /** Переопределения рабочего дня по датам */
  workdays: Record<DateString, WorkdaySettings>
  dayPlans: Record<DateString, DayPlan>
  /** Главный фокус недели: ключ — понедельник */
  weeklyFocus: Record<DateString, string>
  reviews: WeeklyReviewSnapshot[]
  settings: AppSettings
}

export type EntityKind = 'task' | 'event' | 'project' | 'note' | 'result'
