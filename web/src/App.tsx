import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { HomePage } from '@/pages/HomePage'
import { NotePage } from '@/pages/NotePage'
import { DatabasePage } from '@/pages/DatabasePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="notes/*" element={<NotePage />} />
        <Route path="databases/*" element={<DatabasePage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  )
}
