import { addDays, format, parse as parseDate } from 'date-fns'
import { ru } from 'date-fns/locale'
import { EVENT_CATEGORY_LABEL, NOTE_CATEGORY_LABEL, PRIORITY_LABEL, PROJECT_STATUS_LABEL, STATUS_LABEL } from '@/domain/constants'
import { newEvent, newNote, newProject, newResult, newTask } from '@/domain/factories'
import type { CalendarEvent, EventCategory, NoteCategory, Priority, Project, ProjectStatus, Task, TaskStatus } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import type { SampleTool } from '@/lib/claudeRuntime'
import { fmt, toDateString, todayString, weekStartString } from '@/lib/dates'
import { sortByUrgency } from '@/services/tasks'
import { sprintProgress } from '@/services/sprint'

/**
 * Ядро ИИ-ассистента: контекст, который видит Claude, и инструменты,
 * через которые он меняет данные. Каждое изменение записывается в журнал
 * с состоянием «до», чтобы его можно было отменить.
 */

export type ActionKind = 'task' | 'project' | 'event' | 'note' | 'result' | 'focus'
export interface AssistantAction {
  kind: ActionKind
  id: string
  label: string
  /** null — запись создана ассистентом (отмена = удаление) */
  before: unknown | null
}

const S = () => useAppStore.getState()
const str = (v: unknown) => (v == null ? '' : String(v).trim())
const optStr = (v: unknown) => (v == null || v === '' ? undefined : String(v).trim())
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : undefined
}
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

function dateOrNull(v: unknown, field: string): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const s = String(v).slice(0, 10)
  if (!isDate(s)) throw new Error(`${field}: ожидается дата YYYY-MM-DD, получено «${v}»`)
  return s
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']
const STATUSES: TaskStatus[] = ['planned', 'in_progress', 'waiting', 'done']
const enumOr = <T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined => {
  if (v == null || v === '') return undefined
  if (!allowed.includes(v as T)) throw new Error(`${field}: допустимо ${allowed.join(', ')}`)
  return v as T
}

/** Проект по id или по названию (без учёта регистра, допускается часть названия) */
export function findProject(ref: unknown): Project | null {
  const q = str(ref).toLowerCase()
  if (!q) return null
  const list = S().projects
  const exact = list.find((p) => p.id === str(ref) || p.name.toLowerCase() === q)
  if (exact) return exact
  const partial = list.filter((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) throw new Error(`Несколько проектов подходят под «${ref}»: ${partial.map((p) => p.name).join('; ')}. Уточни у пользователя.`)
  throw new Error(`Проект «${ref}» не найден. Существующие: ${list.map((p) => p.name).join('; ') || 'нет'}. Создай проект или уточни у пользователя.`)
}

const projectIdFrom = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  return findProject(v)?.id ?? null
}

/** Локальная дата-время 'YYYY-MM-DDTHH:mm' → ISO */
function localToIso(v: string, field: string) {
  const s = v.replace(' ', 'T').slice(0, 16)
  const d = s.length === 10 ? parseDate(s, 'yyyy-MM-dd', new Date()) : parseDate(s, "yyyy-MM-dd'T'HH:mm", new Date())
  if (Number.isNaN(d.getTime())) throw new Error(`${field}: ожидается YYYY-MM-DDTHH:mm`)
  return d.toISOString()
}

const short = (t: string, n = 60) => (t.length > n ? t.slice(0, n - 1) + '…' : t)

// ───────────── Контекст ─────────────

export function buildContext(now = new Date()): string {
  const s = S()
  const today = todayString(now)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(now, i + 1)
    return `${format(d, 'EEEEEE', { locale: ru })} ${toDateString(d)}`
  }).join(', ')
  const sprint = s.sprints.find((x) => x.id === s.settings.activeSprintId)
  const sp = sprint ? sprintProgress(sprint, s.tasks, today) : null
  const pname = (id: string | null) => s.projects.find((p) => p.id === id)?.name ?? '—'

  const projects = s.projects
    .map((p) => `[${p.id}] ${p.name} · ${PROJECT_STATUS_LABEL[p.status]}${p.goal ? ` · цель: ${short(p.goal, 80)}` : ''}${p.deadline ? ` · дедлайн ${p.deadline}` : ''}`)
    .join('\n')
  const open = sortByUrgency(s.tasks.filter((t) => t.status !== 'done'), today).slice(0, 180)
  const tasks = open
    .map(
      (t) =>
        `[${t.id}] ${t.title} | проект: ${pname(t.projectId)} | ${PRIORITY_LABEL[t.priority]} | ${STATUS_LABEL[t.status]}` +
        `${t.deadline ? ` | дедлайн ${t.deadline}` : ''}${t.plannedMinutes ? ` | план ${Math.round((t.plannedMinutes / 60) * 10) / 10} ч` : ''}` +
        `${t.sprintWeek ? ` | спринт нед. ${t.sprintWeek}` : ''}`,
    )
    .join('\n')
  const doneRecent = s.tasks
    .filter((t) => t.status === 'done' && t.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
    .slice(0, 15)
    .map((t) => `[${t.id}] ${t.title} (выполнена ${t.completedAt!.slice(0, 10)})`)
    .join('\n')
  const from = addDays(now, -7).toISOString()
  const to = addDays(now, 30).toISOString()
  const events = s.events
    .filter((e) => e.end >= from && e.start <= to)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 60)
    .map((e) => `[${e.id}] ${fmt(e.start, e.allDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm")}${e.allDay ? ' весь день' : `–${fmt(e.end, 'HH:mm')}`} ${e.title} · ${EVENT_CATEGORY_LABEL[e.category]}${e.projectId ? ` · ${pname(e.projectId)}` : ''}`)
    .join('\n')
  const results = [...s.results]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((r) => `[${r.id}] ${r.date} ${r.title}${r.projectId ? ` · ${pname(r.projectId)}` : ''}`)
    .join('\n')

  return [
    `Сегодня: ${fmt(now, 'EEEE, d MMMM yyyy')} (${today}), сейчас ${fmt(now, 'HH:mm')}, часовой пояс ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`,
    `Ближайшие дни: ${days}.`,
    sprint && sp
      ? `Активный спринт «${sprint.name}» ${sprint.startDate}–${sprint.endDate}; ${sp.phase === 'upcoming' ? `стартует через ${sp.daysToStart} дн.` : `день ${sp.elapsedDays} из ${sp.totalDays}`}${sp.currentWeek ? `, сейчас неделя ${sp.currentWeek.index}` : ''}. Недели: ${sprint.weeks.map((w) => `${w.index}: ${w.startDate}–${w.endDate}`).join('; ')}.`
      : 'Спринта нет.',
    `Фокус недели: ${s.weeklyFocus[weekStartString(now)] || 'не задан'}.`,
    `\nПРОЕКТЫ:\n${projects || 'нет'}`,
    `\nОТКРЫТЫЕ ЗАДАЧИ (по срочности):\n${tasks || 'нет'}`,
    `\nНЕДАВНО ВЫПОЛНЕННЫЕ:\n${doneRecent || 'нет'}`,
    `\nСОБЫТИЯ (неделя назад — месяц вперёд):\n${events || 'нет'}`,
    `\nПОСЛЕДНИЕ РЕЗУЛЬТАТЫ:\n${results || 'нет'}`,
  ].join('\n')
}

export const RULES = `Ты — ассистент внутри Founder OS, личной системы предпринимателя (интерфейс на русском).
Пользователь пишет команды, отчёты о сделанном и мысли — коротко и неформально. Твоя работа — обновить систему через инструменты, а не советовать.

Правила:
- Сначала сверяйся с данными ниже. Не создавай дубликаты: если похожая задача уже есть — обнови её.
- Отчёт «сделал / закрыл / отправил X» → найди задачу и поставь status=done (и actualHours, если назвал время). Нет такой задачи — создай сразу выполненной.
- Достижение (оплата, клиент, договор, запуск, цифры) → create_result с проектом и числом (metricValue + metricUnit). Если это закрывает задачу — отметь её выполненной.
- Встреча/звонок/платёж/конференция с датой и временем → create_event. Без времени — allDay.
- Идея, гипотеза, наблюдение, ссылка → create_note с подходящей категорией.
- Переводи относительные даты сам («завтра», «до пятницы», «через 2 недели») по датам ниже. «До пятницы» = дедлайн в ближайшую пятницу.
- Приоритет: «срочно», «горит», «критично» → critical; «важно» → high; по умолчанию medium.
- Проект указывай по названию из списка. Если проект явно назван, но его нет — спроси, создать ли, ничего не меняя.
- Если запрос неоднозначен (несколько подходящих задач, непонятно что сделать) — задай один короткий уточняющий вопрос и ничего не меняй.
- Можно выполнять несколько действий за раз.
- Если пользователь спрашивает («что у меня сегодня?», «что горит?») — ответь по данным, ничего не меняя.
- Удаляй только по явной просьбе.
- Ответ — 1–3 коротких предложения на русском: что сделано. Без markdown-таблиц и заголовков. Не перечисляй id.`

// ───────────── Инструменты ─────────────

const TASK_PROPS = {
  title: { type: 'string', description: 'Название задачи — конкретное действие' },
  description: { type: 'string' },
  project: { type: 'string', description: 'Название или id проекта; пустая строка — без проекта' },
  priority: { type: 'string', enum: PRIORITIES },
  status: { type: 'string', enum: STATUSES, description: 'planned / in_progress / waiting / done' },
  startDate: { type: 'string', description: 'YYYY-MM-DD' },
  deadline: { type: 'string', description: 'YYYY-MM-DD' },
  plannedHours: { type: 'number' },
  actualHours: { type: 'number' },
  inSprint: { type: 'boolean', description: 'Включить в активный 90-дневный спринт' },
  sprintWeek: { type: 'number', description: 'Номер недели спринта 1..13' },
}

export function buildTools(log: (a: AssistantAction) => void): SampleTool[] {
  const applyTaskFields = (t: Task, i: Record<string, unknown>): Task => {
    const s = S()
    const next = { ...t }
    if (i.title !== undefined) next.title = str(i.title) || t.title
    if (i.description !== undefined) next.description = str(i.description)
    const pid = projectIdFrom(i.project)
    if (pid !== undefined) next.projectId = pid
    next.priority = enumOr(i.priority, PRIORITIES, 'priority') ?? next.priority
    next.status = enumOr(i.status, STATUSES, 'status') ?? next.status
    const sd = dateOrNull(i.startDate, 'startDate')
    if (sd !== undefined) next.startDate = sd
    const dl = dateOrNull(i.deadline, 'deadline')
    if (dl !== undefined) next.deadline = dl
    const ph = num(i.plannedHours)
    if (ph !== undefined) next.plannedMinutes = Math.round(ph * 60)
    const ah = num(i.actualHours)
    if (ah !== undefined) next.actualMinutes = Math.round(ah * 60)
    const sprintId = s.settings.activeSprintId
    if (i.inSprint === true || i.sprintWeek !== undefined) next.sprintId = sprintId
    if (i.inSprint === false) {
      next.sprintId = null
      next.sprintWeek = null
    }
    const w = num(i.sprintWeek)
    if (w !== undefined) next.sprintWeek = Math.max(1, Math.round(w))
    return next
  }
  const taskById = (id: unknown) => {
    const t = S().tasks.find((x) => x.id === str(id))
    if (!t) throw new Error(`Задача с id «${id}» не найдена`)
    return t
  }

  return [
    {
      name: 'create_task',
      description: 'Создать задачу. Возвращает id. Для уже сделанного передай status=done.',
      inputSchema: { type: 'object', properties: TASK_PROPS, required: ['title'] },
      execute: (i) => {
        if (!str(i.title)) throw new Error('Нужно название задачи')
        const t = applyTaskFields(newTask(), i)
        S().upsertTask(t)
        log({ kind: 'task', id: t.id, label: `${t.status === 'done' ? 'Выполнена' : 'Создана'} задача «${short(t.title)}»`, before: null })
        return { id: t.id }
      },
    },
    {
      name: 'update_task',
      description: 'Изменить задачу по id: статус (done — выполнено), сроки, приоритет, проект, часы. Передавай только меняющиеся поля.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...TASK_PROPS }, required: ['id'] },
      execute: (i) => {
        const before = taskById(i.id)
        const t = applyTaskFields(before, i)
        S().upsertTask(t)
        const what = t.status === 'done' && before.status !== 'done' ? 'Выполнена' : 'Обновлена'
        log({ kind: 'task', id: t.id, label: `${what} задача «${short(t.title)}»`, before })
        return 'ok'
      },
    },
    {
      name: 'create_project',
      description: 'Создать проект. Возвращает id.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          goal: { type: 'string', description: 'Измеримая цель проекта' },
          description: { type: 'string' },
          startDate: { type: 'string', description: 'YYYY-MM-DD, по умолчанию сегодня' },
          deadline: { type: 'string', description: 'YYYY-MM-DD' },
          status: { type: 'string', enum: ['idea', 'active', 'paused'] },
        },
        required: ['name'],
      },
      execute: (i) => {
        const name = str(i.name)
        if (!name) throw new Error('Нужно название проекта')
        if (S().projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error(`Проект «${name}» уже существует`)
        const p = newProject({
          name,
          goal: str(i.goal),
          description: str(i.description),
          startDate: dateOrNull(i.startDate, 'startDate') ?? todayString(),
          deadline: dateOrNull(i.deadline, 'deadline') ?? null,
          status: enumOr(i.status, ['idea', 'active', 'paused'] as ProjectStatus[], 'status') ?? 'active',
        })
        S().upsertProject(p)
        log({ kind: 'project', id: p.id, label: `Создан проект «${short(p.name)}»`, before: null })
        return { id: p.id }
      },
    },
    {
      name: 'update_project',
      description: 'Изменить проект (по id или названию): цель, описание, сроки, статус idea/active/paused.',
      inputSchema: {
        type: 'object',
        properties: { project: { type: 'string' }, name: { type: 'string' }, goal: { type: 'string' }, description: { type: 'string' }, startDate: { type: 'string' }, deadline: { type: 'string' }, status: { type: 'string', enum: ['idea', 'active', 'paused'] } },
        required: ['project'],
      },
      execute: (i) => {
        const before = findProject(i.project)!
        if (before.status === 'closed') throw new Error('Проект в архиве — сначала его нужно восстановить в интерфейсе')
        const p: Project = {
          ...before,
          name: optStr(i.name) ?? before.name,
          goal: i.goal !== undefined ? str(i.goal) : before.goal,
          description: i.description !== undefined ? str(i.description) : before.description,
          startDate: dateOrNull(i.startDate, 'startDate') ?? before.startDate,
          deadline: dateOrNull(i.deadline, 'deadline') === undefined ? before.deadline : (dateOrNull(i.deadline, 'deadline') as string | null),
          status: enumOr(i.status, ['idea', 'active', 'paused'] as ProjectStatus[], 'status') ?? before.status,
        }
        S().upsertProject(p)
        log({ kind: 'project', id: p.id, label: `Обновлён проект «${short(p.name)}»`, before })
        return 'ok'
      },
    },
    {
      name: 'close_project',
      description: 'Закрыть проект и отправить в архив. Причина и выводы обязательны — если пользователь их не назвал, спроси, не вызывая инструмент.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, reason: { type: 'string' }, lessons: { type: 'string' } }, required: ['project', 'reason', 'lessons'] },
      execute: (i) => {
        const before = findProject(i.project)!
        if (str(i.reason).length < 3 || str(i.lessons).length < 3) throw new Error('Нужны причина и выводы — спроси пользователя')
        S().closeProject(before.id, str(i.reason), str(i.lessons))
        log({ kind: 'project', id: before.id, label: `Проект «${short(before.name)}» закрыт и в архиве`, before })
        return 'ok'
      },
    },
    {
      name: 'create_event',
      description: 'Создать событие в календаре: встреча, звонок, конференция, платёж. Время — локальное.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start: { type: 'string', description: 'YYYY-MM-DDTHH:mm, или YYYY-MM-DD для события на весь день' },
          end: { type: 'string', description: 'YYYY-MM-DDTHH:mm; по умолчанию через 1 час' },
          allDay: { type: 'boolean' },
          category: { type: 'string', enum: Object.keys(EVENT_CATEGORY_LABEL), description: 'meeting встреча/звонок, conference, payment, event, focus, personal' },
          project: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['title', 'start'],
      },
      execute: (i) => {
        const allDay = i.allDay === true || str(i.start).length === 10
        const start = allDay ? localToIso(str(i.start).slice(0, 10) + 'T00:00', 'start') : localToIso(str(i.start), 'start')
        const end = allDay
          ? localToIso((optStr(i.end) ?? str(i.start)).slice(0, 10) + 'T23:59', 'end')
          : i.end
            ? localToIso(str(i.end), 'end')
            : new Date(new Date(start).getTime() + 3600000).toISOString()
        if (end <= start) throw new Error('Окончание раньше начала')
        const e: CalendarEvent = newEvent({
          title: str(i.title),
          start,
          end,
          allDay,
          category: enumOr(i.category, Object.keys(EVENT_CATEGORY_LABEL) as EventCategory[], 'category') ?? 'meeting',
          projectId: projectIdFrom(i.project) ?? null,
          description: str(i.description),
        })
        S().upsertEvent(e)
        log({ kind: 'event', id: e.id, label: `В календаре: «${short(e.title)}», ${fmt(e.start, allDay ? 'd MMM' : 'd MMM, HH:mm')}`, before: null })
        return { id: e.id }
      },
    },
    {
      name: 'create_note',
      description: 'Записать в базу знаний идею, заметку, гипотезу, наблюдение или полезный материал.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string', enum: Object.keys(NOTE_CATEGORY_LABEL), description: 'idea, note, hypothesis, observation, material' },
          source: { type: 'string', description: 'Откуда идея: книга, встреча, клиент…' },
          project: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title'],
      },
      execute: (i) => {
        const n = newNote({
          title: str(i.title),
          content: str(i.content),
          category: enumOr(i.category, Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[], 'category') ?? 'idea',
          source: str(i.source),
          projectId: projectIdFrom(i.project) ?? null,
          tags: Array.isArray(i.tags) ? i.tags.map((t) => str(t).toLowerCase()).filter(Boolean).slice(0, 8) : [],
        })
        S().upsertNote(n)
        log({ kind: 'note', id: n.id, label: `В базу знаний: «${short(n.title)}»`, before: null })
        return { id: n.id }
      },
    },
    {
      name: 'create_result',
      description: 'Записать достижение в журнал результатов: оплата, клиент, договор, запуск, рекорд.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD, по умолчанию сегодня' },
          project: { type: 'string' },
          description: { type: 'string' },
          metricValue: { type: 'number', description: 'Число, например 150000' },
          metricUnit: { type: 'string', description: '₽, $, клиентов, кВт…' },
          lessons: { type: 'string', description: 'Выводы, если пользователь их сформулировал' },
        },
        required: ['title'],
      },
      execute: (i) => {
        const r = newResult({
          title: str(i.title),
          date: dateOrNull(i.date, 'date') ?? todayString(),
          projectId: projectIdFrom(i.project) ?? null,
          description: str(i.description),
          metricValue: num(i.metricValue) ?? null,
          metricUnit: str(i.metricUnit),
          lessons: str(i.lessons),
        })
        S().upsertResult(r)
        log({ kind: 'result', id: r.id, label: `Результат: «${short(r.title)}»`, before: null })
        return { id: r.id }
      },
    },
    {
      name: 'update_record',
      description: 'Изменить событие, заметку или результат по id. fields — только меняющиеся поля (те же имена, что при создании).',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['event', 'note', 'result'] }, id: { type: 'string' }, fields: { type: 'object' } }, required: ['kind', 'id', 'fields'] },
      execute: (i) => {
        const f = (i.fields ?? {}) as Record<string, unknown>
        const s = S()
        if (i.kind === 'event') {
          const before = s.events.find((x) => x.id === str(i.id))
          if (!before) throw new Error('Событие не найдено')
          const next = { ...before }
          if (f.title !== undefined) next.title = str(f.title)
          if (f.description !== undefined) next.description = str(f.description)
          if (f.start !== undefined) {
            const dur = new Date(before.end).getTime() - new Date(before.start).getTime()
            next.start = localToIso(str(f.start), 'start')
            next.end = f.end !== undefined ? localToIso(str(f.end), 'end') : new Date(new Date(next.start).getTime() + dur).toISOString()
          } else if (f.end !== undefined) next.end = localToIso(str(f.end), 'end')
          if (f.category !== undefined) next.category = enumOr(f.category, Object.keys(EVENT_CATEGORY_LABEL) as EventCategory[], 'category') ?? next.category
          const pid = projectIdFrom(f.project)
          if (pid !== undefined) next.projectId = pid
          s.upsertEvent(next)
          log({ kind: 'event', id: next.id, label: `Изменено событие «${short(next.title)}»`, before })
        } else if (i.kind === 'note') {
          const before = s.notes.find((x) => x.id === str(i.id))
          if (!before) throw new Error('Запись не найдена')
          const next = { ...before, ...(f.title !== undefined && { title: str(f.title) }), ...(f.content !== undefined && { content: str(f.content) }), ...(f.source !== undefined && { source: str(f.source) }) }
          if (f.category !== undefined) next.category = enumOr(f.category, Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[], 'category') ?? next.category
          if (Array.isArray(f.tags)) next.tags = f.tags.map((t) => str(t).toLowerCase()).filter(Boolean)
          const pid = projectIdFrom(f.project)
          if (pid !== undefined) next.projectId = pid
          s.upsertNote(next)
          log({ kind: 'note', id: next.id, label: `Изменена запись «${short(next.title)}»`, before })
        } else if (i.kind === 'result') {
          const before = s.results.find((x) => x.id === str(i.id))
          if (!before) throw new Error('Результат не найден')
          const next = { ...before }
          if (f.title !== undefined) next.title = str(f.title)
          if (f.description !== undefined) next.description = str(f.description)
          if (f.lessons !== undefined) next.lessons = str(f.lessons)
          if (f.metricUnit !== undefined) next.metricUnit = str(f.metricUnit)
          if (f.metricValue !== undefined) next.metricValue = num(f.metricValue) ?? null
          const d = dateOrNull(f.date, 'date')
          if (d) next.date = d
          const pid = projectIdFrom(f.project)
          if (pid !== undefined) next.projectId = pid
          s.upsertResult(next)
          log({ kind: 'result', id: next.id, label: `Изменён результат «${short(next.title)}»`, before })
        } else throw new Error('kind: event, note или result')
        return 'ok'
      },
    },
    {
      name: 'delete_record',
      description: 'Удалить задачу, событие, заметку или результат по id. Только по явной просьбе пользователя.',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['task', 'event', 'note', 'result'] }, id: { type: 'string' } }, required: ['kind', 'id'] },
      execute: (i) => {
        const s = S()
        const id = str(i.id)
        const map = { task: s.tasks, event: s.events, note: s.notes, result: s.results } as const
        const kind = i.kind as keyof typeof map
        const before = map[kind]?.find((x) => x.id === id)
        if (!before) throw new Error('Запись не найдена')
        if (kind === 'task') s.deleteTask(id)
        if (kind === 'event') s.deleteEvent(id)
        if (kind === 'note') s.deleteNote(id)
        if (kind === 'result') s.deleteResult(id)
        log({ kind, id, label: `Удалено: «${short((before as { title: string }).title)}»`, before })
        return 'ok'
      },
    },
    {
      name: 'set_weekly_focus',
      description: 'Задать главный фокус текущей недели (показывается на главной).',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute: (i) => {
        const week = weekStartString(new Date())
        const before = S().weeklyFocus[week] ?? ''
        S().setWeeklyFocus(week, str(i.text))
        log({ kind: 'focus', id: week, label: `Фокус недели: «${short(str(i.text))}»`, before })
        return 'ok'
      },
    },
    {
      name: 'search',
      description: 'Найти записи, которых нет в контексте: старые выполненные задачи, заметки, прошлые события, результаты. Возвращает до 20 совпадений.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: (i) => {
        const q = str(i.query).toLowerCase()
        if (!q) throw new Error('Пустой запрос')
        const s = S()
        const hit = (t: string) => t.toLowerCase().includes(q)
        return [
          ...s.tasks.filter((t) => hit(t.title) || hit(t.description)).map((t) => ({ kind: 'task', id: t.id, title: t.title, status: t.status, deadline: t.deadline })),
          ...s.notes.filter((n) => hit(n.title) || hit(n.content) || n.tags.some(hit)).map((n) => ({ kind: 'note', id: n.id, title: n.title, date: n.date })),
          ...s.events.filter((e) => hit(e.title)).map((e) => ({ kind: 'event', id: e.id, title: e.title, start: e.start })),
          ...s.results.filter((r) => hit(r.title) || hit(r.description)).map((r) => ({ kind: 'result', id: r.id, title: r.title, date: r.date })),
        ].slice(0, 20)
      },
    },
  ]
}

/** Отмена действий ассистента в обратном порядке */
export function undoActions(actions: AssistantAction[]) {
  const s = S()
  for (const a of [...actions].reverse()) {
    const b = a.before as never
    if (a.kind === 'focus') s.setWeeklyFocus(a.id, (a.before as string) ?? '')
    else if (a.kind === 'task') {
      if (b) s.upsertTask(b)
      else s.deleteTask(a.id)
    } else if (a.kind === 'event') {
      if (b) s.upsertEvent(b)
      else s.deleteEvent(a.id)
    } else if (a.kind === 'note') {
      if (b) s.upsertNote(b)
      else s.deleteNote(a.id)
    } else if (a.kind === 'result') {
      if (b) s.upsertResult(b)
      else s.deleteResult(a.id)
    } else if (a.kind === 'project') {
      if (b) s.upsertProject(b)
      else s.purgeProject(a.id)
    }
  }
}
