import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { DatabaseView } from '@/components/DatabaseView'
import type { ShellContext } from '@/layouts/AppShell'

export function DatabasePage() {
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const name = decodeURIComponent(splat ?? '').replace(/^\/+/, '').replace(/\.csv$/i, '')
  const { refresh } = useOutletContext<ShellContext>()

  if (!name) return <Navigate to="/" replace />

  return (
    <DatabaseView
      name={name}
      onDeleted={async () => {
        await refresh()
        navigate('/')
      }}
    />
  )
}
