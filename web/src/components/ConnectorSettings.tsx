import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { api, type ConnectorConfig, type CredentialsView } from '../api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

/** Configure the Notion→Google Drive pipeline: credentials + auto-sync settings. */
export function ConnectorSettings({ open, onOpenChange, onSaved }: Props) {
  const [creds, setCreds] = useState<CredentialsView | null>(null)
  const [config, setConfig] = useState<ConnectorConfig | null>(null)
  const [notionToken, setNotionToken] = useState('')
  const [gdriveJson, setGdriveJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setMessage('')
    setNotionToken('')
    setGdriveJson('')
    api.connectors.credentials.get().then(setCreds).catch((e) => setMessage(String(e)))
    api.connectors.config.get().then(setConfig).catch((e) => setMessage(String(e)))
  }, [open])

  const autoSync = config?.auto_sync ?? true
  const interval = Number(config?.sync_interval_min ?? 15)

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const credReq: { notion_token?: string; gdrive_credentials_json?: string } = {}
      if (notionToken.trim()) credReq.notion_token = notionToken.trim()
      if (gdriveJson.trim()) credReq.gdrive_credentials_json = gdriveJson.trim()
      if (credReq.notion_token || credReq.gdrive_credentials_json) {
        setCreds(await api.connectors.credentials.update(credReq))
      }
      if (config) {
        await api.connectors.config.update(config)
      }
      setNotionToken('')
      setGdriveJson('')
      setMessage('Saved')
      onSaved?.()
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }

  const patchConfig = (patch: Partial<ConnectorConfig>) =>
    setConfig((c) => (c ? { ...c, ...patch } : c))

  const clearCredential = async (key: 'notion_token' | 'gdrive') => {
    setSaving(true)
    setMessage('')
    try {
      setCreds(await api.connectors.credentials.update({ clear: [key] }))
      setMessage('Cleared')
      onSaved?.()
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }

  const reimportNotion = async () => {
    if (!confirm('Re-import every Notion page? This clears the sync cache so all pages are fetched again on the next sync.')) return
    setSaving(true)
    setMessage('')
    try {
      const { cleared } = await api.connectors.resetNotion()
      const result = await api.connectors.sync()
      // SyncAll returns 200 even when a connector failed — surface those.
      const err = result.notion?.error || result.gdrive?.error
      setMessage(err ? `Reset ${cleared}, but sync failed: ${err}` : `Re-imported (${cleared} cached pages reset)`)
      onSaved?.()
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync settings</DialogTitle>
          <DialogDescription>Connect Notion and Google Drive, and tune auto-sync.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 font-medium" htmlFor="notion-token">
              Notion token
              {creds?.notion_token_set && (
                <>
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" /> set
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-auto px-2 py-0.5 text-xs"
                    onClick={() => clearCredential('notion_token')}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                </>
              )}
            </label>
            <Input
              id="notion-token"
              type="password"
              placeholder={creds?.notion_token_set ? `current: ${creds.notion_token_preview ?? '••••'}` : 'secret_…'}
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 font-medium" htmlFor="gdrive-json">
              Google Drive credentials JSON
              {creds?.gdrive_connected && (
                <>
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" /> {creds.gdrive_auth_method || 'connected'}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-auto px-2 py-0.5 text-xs"
                    onClick={() => clearCredential('gdrive')}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                </>
              )}
            </label>
            <textarea
              id="gdrive-json"
              className="min-h-20 w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-xs"
              placeholder='{"type":"service_account",…} or OAuth client JSON'
              value={gdriveJson}
              onChange={(e) => setGdriveJson(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="font-medium" htmlFor="auto-sync">
              Auto-sync
            </label>
            <input
              id="auto-sync"
              type="checkbox"
              checked={autoSync}
              disabled={!config}
              onChange={(e) => patchConfig({ auto_sync: e.target.checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="font-medium" htmlFor="interval">
              Interval (minutes)
            </label>
            <Input
              id="interval"
              type="number"
              min={1}
              className="w-24"
              value={interval}
              disabled={!config}
              onChange={(e) => patchConfig({ sync_interval_min: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <div className="font-medium">Re-import all from Notion</div>
              <div className="text-xs text-muted-foreground">Clears the cache and re-fetches every page.</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reimportNotion}
              disabled={saving || !creds?.notion_token_set}
              title={creds?.notion_token_set ? undefined : 'Connect Notion first'}
            >
              Re-import
            </Button>
          </div>
        </div>

        <DialogFooter className="items-center">
          {message && <span className="mr-auto text-xs text-muted-foreground">{message}</span>}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
