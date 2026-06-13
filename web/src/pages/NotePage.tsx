import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { NoteView } from '@/components/NoteView'
import type { ShellContext } from '@/layouts/AppShell'
import { safeDecodeURIComponent } from '@/lib/utils'

export function NotePage() {
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const path = safeDecodeURIComponent(splat ?? '').replace(/^\/+/, '')
  const { refresh } = useOutletContext<ShellContext>()

  if (!path) return <Navigate to="/" replace />

  return (
    <NoteView
      path={path}
      onDeleted={async () => {
        await refresh()
        navigate('/')
      }}
    />
  )
}
