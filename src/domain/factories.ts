import { addDays, min } from 'date-fns'
import { FIRST_SPRINT, PROJECT_COLORS, SCHEMA_VERSION } from './constants'
import type {
  Achievement,
  AppData,
  CalendarEvent,
  DateString,
  Note,
  Project,
  Sprint,
  SprintWeek,
  Task,
  WorkdaySettings,
} from './types'
import { daysBetween, fromDateString, toDateString, todayString } from '@/lib/dates'
import { nowISO, uid } from '@/lib/utils'

export const DEFAULT_WORKDAY: WorkdaySettings = {
  start: '09:00',
  end: '19:00',
  breakMinutes: 60,
  breakStart: '13:00',
}

/** Разбивает период спринта на недельные этапы по 7 дней (последний может быть короче) */
export function buildSprintWeeks(startDate: DateString, endDate: DateString, prev: SprintWeek[] = []): SprintWeek[] {
  const total = daysBetween(startDate, endDate) + 1
  const count = Math.max(1, Math.ceil(total / 7))
  const end = fromDateString(endDate)
  return Array.from({ length: count }, (_, i) => {
    const s = addDays(fromDateString(startDate), i * 7)
    const e = min([addDays(s, 6), end])
    return {
      index: i + 1,
      startDate: toDateString(s),
      endDate: toDateString(e),
      goal: prev.find((w) => w.index === i + 1)?.goal ?? '',
    }
  })
}

export function createSprint(input: { name: string; startDate: DateString; endDate: DateString }): Sprint {
  const now = nowISO()
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    goals: [],
    weeks: buildSprintWeeks(input.startDate, input.endDate),
  }
}

export function createEmptyData(): AppData {
  const sprint = createSprint(FIRST_SPRINT)
  return {
    schemaVersion: SCHEMA_VERSION,
    projects: [],
    tasks: [],
    events: [],
    notes: [],
    results: [],
    sprints: [sprint],
    workdays: {},
    dayPlans: {},
    weeklyFocus: {},
    reviews: [],
    settings: { workday: DEFAULT_WORKDAY, inactivityDays: 14, activeSprintId: sprint.id },
  }
}

const base = () => {
  const now = nowISO()
  return { id: uid(), createdAt: now, updatedAt: now }
}

export const newTask = (p: Partial<Task> = {}): Task => ({
  ...base(),
  title: '',
  description: '',
  projectId: null,
  priority: 'medium',
  status: 'planned',
  startDate: null,
  deadline: null,
  plannedMinutes: 60,
  actualMinutes: null,
  sprintId: null,
  sprintWeek: null,
  dependsOn: [],
  reminder: { enabled: false, offsetMinutes: 60 },
  completedAt: null,
  ...p,
})

export const newProject = (p: Partial<Project> = {}): Project => ({
  ...base(),
  name: '',
  description: '',
  goal: '',
  startDate: todayString(),
  deadline: null,
  status: 'active',
  color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
  closure: null,
  ...p,
})

export const newEvent = (p: Partial<CalendarEvent> = {}): CalendarEvent => {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 60 * 60000)
  return {
    ...base(),
    title: '',
    description: '',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    category: 'meeting',
    projectId: null,
    ...p,
  }
}

export const newNote = (p: Partial<Note> = {}): Note => ({
  ...base(),
  title: '',
  content: '',
  date: todayString(),
  category: 'idea',
  source: '',
  projectId: null,
  tags: [],
  ...p,
})

export const newResult = (p: Partial<Achievement> = {}): Achievement => ({
  ...base(),
  title: '',
  date: todayString(),
  projectId: null,
  description: '',
  metricValue: null,
  metricUnit: '',
  lessons: '',
  ...p,
})
