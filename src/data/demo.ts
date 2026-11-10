import { addDays, subDays } from 'date-fns'
import { newEvent, newNote, newProject, newResult, newTask } from '@/domain/factories'
import type { ID } from '@/domain/types'
import { toDateString } from '@/lib/dates'

/**
 * Демонстрационные данные. Все записи помечены `isDemo: true`,
 * отображаются с бейджем «Демо» и удаляются одной кнопкой в настройках.
 * Они не загружаются автоматически — только по явному действию пользователя.
 */
export function buildDemoData(sprintId: ID | null) {
  const now = new Date()
  const d = (offset: number) => toDateString(addDays(now, offset))
  const at = (offset: number, h: number, m = 0) => {
    const x = addDays(now, offset)
    x.setHours(h, m, 0, 0)
    return x.toISOString()
  }
  const iso = (offset: number) => subDays(now, -offset).toISOString()
  const demo = { isDemo: true }

  const p1 = newProject({ ...demo, name: 'Демо: Запуск сервиса', description: 'Пример проекта для знакомства с системой', goal: 'Первые 10 платящих клиентов', startDate: d(-40), deadline: d(50), color: '#2346e0', createdAt: iso(-40) })
  const p2 = newProject({ ...demo, name: 'Демо: Привлечение инвестиций', description: 'Пример проекта', goal: 'Закрыть раунд', startDate: d(-20), deadline: d(80), color: '#0e9f6e', createdAt: iso(-20) })
  const p3 = newProject({ ...demo, name: 'Демо: Старый эксперимент', description: 'Пример проекта без активности', goal: 'Проверить гипотезу', startDate: d(-90), deadline: d(-10), color: '#e8590c', createdAt: iso(-90), updatedAt: iso(-30) })

  const t1 = newTask({ ...demo, title: 'Демо: Описать оффер', projectId: p1.id, priority: 'high', status: 'done', startDate: d(-12), deadline: d(-8), plannedMinutes: 120, actualMinutes: 150, createdAt: iso(-14), completedAt: iso(-9), sprintId })
  const t2 = newTask({ ...demo, title: 'Демо: Собрать лендинг', projectId: p1.id, priority: 'critical', status: 'in_progress', startDate: d(-5), deadline: d(2), plannedMinutes: 240, actualMinutes: 90, dependsOn: [t1.id], createdAt: iso(-7), sprintId, sprintWeek: 1 })
  const t3 = newTask({ ...demo, title: 'Демо: 20 интервью с клиентами', projectId: p1.id, priority: 'high', status: 'planned', startDate: d(1), deadline: d(14), plannedMinutes: 600, dependsOn: [t2.id], createdAt: iso(-3), sprintId, sprintWeek: 2 })
  const t4 = newTask({ ...demo, title: 'Демо: Подготовить питч-дек', projectId: p2.id, priority: 'high', status: 'waiting', startDate: d(-6), deadline: d(-1), plannedMinutes: 180, createdAt: iso(-6), sprintId, sprintWeek: 1 })
  const t5 = newTask({ ...demo, title: 'Демо: Список из 30 инвесторов', projectId: p2.id, priority: 'medium', status: 'planned', deadline: d(5), plannedMinutes: 90, createdAt: iso(-2) })
  const t6 = newTask({ ...demo, title: 'Демо: Разобрать почту', priority: 'low', status: 'planned', deadline: d(0), plannedMinutes: 30, createdAt: iso(-1) })
  const t7 = newTask({ ...demo, title: 'Демо: Финмодель v1', projectId: p2.id, priority: 'medium', status: 'done', startDate: d(-18), deadline: d(-15), plannedMinutes: 240, actualMinutes: 200, createdAt: iso(-19), completedAt: iso(-16) })

  const events = [
    newEvent({ ...demo, title: 'Демо: Созвон с партнёром', category: 'meeting', projectId: p1.id, start: at(0, 11), end: at(0, 12) }),
    newEvent({ ...demo, title: 'Демо: Оплата сервера', category: 'payment', start: at(1, 10), end: at(1, 10, 30) }),
    newEvent({ ...demo, title: 'Демо: Встреча с инвестором', category: 'meeting', projectId: p2.id, start: at(2, 15), end: at(2, 16, 30) }),
    newEvent({ ...demo, title: 'Демо: Отраслевая конференция', category: 'conference', allDay: true, start: at(6, 0), end: at(6, 23, 59) }),
  ]

  const notes = [
    newNote({ ...demo, title: 'Демо: Подписка вместо разовой оплаты', content: 'Гипотеза: клиенты охотнее платят помесячно.', category: 'hypothesis', source: 'Интервью', projectId: p1.id, tags: ['монетизация'], date: d(-4) }),
    newNote({ ...demo, title: 'Демо: Идея партнёрской программы', content: 'Комиссия 20% за привлечённого клиента.', category: 'idea', source: 'Собственная', tags: ['рост', 'партнёры'], date: d(-2) }),
  ]

  const results = [
    newResult({ ...demo, title: 'Демо: Первая оплата', date: d(-3), projectId: p1.id, description: 'Через 37 дней работы над проектом получили первую оплату.', metricValue: 15000, metricUnit: '₽', lessons: 'Продажи стоит начинать раньше, чем готов продукт.' }),
  ]

  return { projects: [p1, p2, p3], tasks: [t1, t2, t3, t4, t5, t6, t7], events, notes, results }
}
