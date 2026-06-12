import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_LOW, createCommand, type LexicalCommand } from 'lexical'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAttachmentHost, type AttachmentInfo } from '../attachments/host'
import { postBridge } from '../bridge'
import { INSERT_ATTACHMENT_COMMAND } from './AttachmentPlugin'

export const OPEN_ATTACHMENT_PICKER_COMMAND: LexicalCommand<void> = createCommand('OPEN_ATTACHMENT_PICKER_COMMAND')

export function AttachmentPickerPlugin() {
  const [editor] = useLexicalComposerContext()
  const host = useAttachmentHost()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<AttachmentInfo[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return editor.registerCommand(
      OPEN_ATTACHMENT_PICKER_COMMAND,
      () => {
        if (!host) return false
        void host.list().then((f) => {
          setFiles(f)
          setOpen(true)
        })
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, host])

  if (!open || !host) return null

  const insert = (path: string, label: string) => {
    editor.dispatchCommand(INSERT_ATTACHMENT_COMMAND, { path, label })
    setOpen(false)
  }

  const uploadAndInsert = async (file: File) => {
    try {
      const { path } = await host.upload(file)
      postBridge({ type: 'attachment-uploaded', path })
      insert(path, file.name)
    } catch (err) {
      postBridge({ type: 'attachment-error', message: String(err) })
      setOpen(false)
    }
  }

  return createPortal(
    <div className="mb-attach-picker-backdrop" onClick={() => setOpen(false)}>
      <div className="mb-attach-picker" role="dialog" aria-label="Insert attachment" onClick={(e) => e.stopPropagation()}>
        <div className="mb-attach-picker-title">Insert attachment</div>
        <div className="mb-attach-picker-list">
          {files.length === 0 && <div className="mb-attach-picker-empty">No attachments yet</div>}
          {files.map((f) => (
            <button key={f.path} type="button" className="mb-attach-picker-item" onClick={() => insert(f.path, f.name)}>
              {f.name}
            </button>
          ))}
        </div>
        <div className="mb-attach-picker-actions">
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadAndInsert(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="mb-attach-picker-upload" onClick={() => inputRef.current?.click()}>
            Upload file…
          </button>
          <button type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
