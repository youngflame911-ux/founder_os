import { lazy } from 'react'
import { BrowserRouter, HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { EditorHost } from '@/features/common/EditorHost'
import DashboardPage from '@/pages/DashboardPage'

// Тяжёлые разделы (календарь, Гант, графики) грузятся по требованию
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const TasksPage = lazy(() => import('@/pages/TasksPage'))
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'))
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const ResultsPage = lazy(() => import('@/pages/ResultsPage'))

/**
 * VITE_ROUTER=memory — встраиваемая страница (Claude, один файл);
 * VITE_ROUTER=hash — статический хостинг без серверных маршрутов (GitHub Pages);
 * по умолчанию — обычные адреса (dev-сервер, хостинг с переписыванием на index.html).
 */
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      <EditorHost />
    </Router>
  )
}
