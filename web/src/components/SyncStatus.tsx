import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Cloud, FileText, RefreshCw } from 'lucide-react'
import { api, type ConnectorStatus, type SyncResult } from '../api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatWhen(iso?: string): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t) || t <= 0) return 'never'
  const secs = Math.round((Date.now() - t) / 1000)
  if (secs < 0) {
    // Future timestamp (clock skew): minor skew reads as "just now", otherwise
    // show the absolute date rather than a misleading "just now".
    return secs > -300 ? 'just now' : new Date(iso).toLocaleDateString()
  }
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

function summarize(r: SyncResult): string {
  // Report both connectors independently — an error on one shouldn't hide the
  // other's result (e.g. Notion failed but Drive still pushed files).
  const parts: string[] = []
  if (r.notion) {
    parts.push(
      r.notion.error
        ? `Notion error: ${r.notion.error}`
        : `Notion: +${r.notion.imported} new, ${r.notion.updated} updated`,
    )
  }
  if (r.gdrive) {
    if (r.gdrive.error) {
      parts.push(`Drive error: ${r.gdrive.error}`)
    } else {
      const bits = [`${r.gdrive.uploaded + r.gdrive.updated} pushed`]
      if (r.gdrive.downloaded) bits.push(`${r.gdrive.downloaded} pulled`)
      parts.push(`Drive: ${bits.join(', ')}`)
    }
  }
  return parts.length ? parts.join(' · ') : 'Up to date'
}

/** Surfaces the core product pipeline — continuous Notion → Google Drive sync. */
export function SyncStatus() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState('')

  const refresh = useCallback(() => {
    api.connectors
      .status()
      .then((s) => {
        setStatus(s)
        setError('')
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const syncNow = async () => {
    setSyncing(true)
    setLastResult('')
    try {
      const result = await api.connectors.sync()
      setLastResult(summarize(result))
      refresh()
    } catch (e) {
      setLastResult(String(e))
    } finally {
      setSyncing(false)
    }
  }

  if (error) {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Sync status unavailable: {error}
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const interval = status.config.sync_interval_min || 15

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <FileText className="size-4" /> Notion <ArrowRight className="size-3.5" /> Google Drive{' '}
            <Cloud className="size-4" />
          </span>
          <Button type="button" size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" /> Notion
            <Badge variant={status.notion.connected ? 'secondary' : 'outline'}>
              {status.notion.connected ? 'Connected' : 'Not connected'}
            </Badge>
          </span>
          <span className="text-muted-foreground">
            {status.notion.cached_pages} pages · {formatWhen(status.notion.last_import)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cloud className="size-4 text-muted-foreground" /> Google Drive
            <Badge variant={status.gdrive.connected ? 'secondary' : 'outline'}>
              {status.gdrive.connected ? 'Connected' : 'Not connected'}
            </Badge>
          </span>
          <span className="text-muted-foreground">
            {status.gdrive.cached_files} files · {formatWhen(status.gdrive.last_sync)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {status.config.auto_sync
            ? `Auto-sync every ${interval} min`
            : 'Auto-sync off — use Sync now'}
          {lastResult && ` · ${lastResult}`}
        </p>
      </CardContent>
    </Card>
  )
}
