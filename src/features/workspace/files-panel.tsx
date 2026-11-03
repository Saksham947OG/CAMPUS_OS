import { useEffect, useRef, useState } from 'react'
import { loadBlob, removeBlob, saveBlob } from '@/data/evidence/evidence-store'
import { Button } from '@/components/ui/button'
import {
  ATTACHMENT_HELP,
  addAttachment,
  canReadAttachment,
  checkAttachment,
  removeAttachment,
  sniffMatches,
} from '@/domain/workspace-ext'
import type { Attachment } from '@/domain/workspace'
import { can, roleOf } from '@/domain/workspace-access'
import { formatInstant } from '@/lib/time'
import type { WorkspaceApi } from './use-workspace'
import { Empty, Pill, fieldClass } from './ws-ui'

const IMAGE = /^image\/(png|jpeg|gif|webp)$/
const size = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

/** A local object URL for a stored file, released when the row goes away. */
function useBlobUrl(ref: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let made: string | null = null
    let live = true
    loadBlob(ref)
      .then((b) => {
        if (b && live) {
          made = URL.createObjectURL(b)
          setUrl(made)
        }
      })
      .catch(() => {})
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [ref, enabled])
  return url
}

interface Pending {
  key: string
  file: File
  state: 'saving' | 'failed'
  error?: string
  retry: boolean
}

function Row({ w, a }: { w: WorkspaceApi; a: Attachment }) {
  const image = IMAGE.test(a.mime)
  const url = useBlobUrl(a.storageRef, true)
  const mayRemove = a.uploaderId === w.actor || can(roleOf(w.ws, a.spaceId, w.actor), 'manage')
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2 text-sm">
      {image && url ? (
        <img src={url} alt={`Preview of ${a.filename}`} className="size-14 rounded object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{a.filename}</p>
        <p className="text-xs text-ink-muted">
          {size(a.bytes)} · {w.name(a.uploaderId)} · {formatInstant(a.createdAt)} · saved on this
          device
        </p>
      </div>
      {a.audience === 'private' ? <Pill tone="warn">Only you</Pill> : null}
      {url ? (
        <a href={url} download={a.filename} className="min-h-9 py-2 text-coffee underline">
          Download<span className="sr-only"> {a.filename}</span>
        </a>
      ) : null}
      {mayRemove ? (
        <button
          type="button"
          className="min-h-9 text-coffee underline"
          onClick={() =>
            void w
              .act((s, c) => removeAttachment(s, c, w.actor, a.id), 'File removed.')
              .then((r) => {
                if (r.ok) void removeBlob(a.storageRef).catch(() => {})
              })
          }
        >
          Remove<span className="sr-only"> {a.filename}</span>
        </button>
      ) : null}
    </li>
  )
}

/** Files kept on THIS device: validated, saved, listed, removable. Nothing is uploaded to a server. */
export function FilesPanel({
  w,
  spaceId,
  projectId,
  pageId,
  audience,
}: {
  w: WorkspaceApi
  spaceId: string
  projectId?: string
  pageId?: string
  audience: 'private' | 'space'
}) {
  const { ws, actor } = w
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const edit = can(roleOf(ws, spaceId, actor), 'edit')
  const files = ws.attachments
    .filter(
      (a) =>
        a.spaceId === spaceId &&
        (pageId
          ? a.pageId === pageId
          : projectId
            ? a.projectId === projectId ||
              ws.pages.some((p) => p.id === a.pageId && p.projectId === projectId)
            : true),
    )
    .filter((a) => canReadAttachment(ws, a, actor))

  const patch = (key: string, next: Partial<Pending> | null) =>
    setPending((p) =>
      next ? p.map((x) => (x.key === key ? { ...x, ...next } : x)) : p.filter((x) => x.key !== key),
    )

  const save = async (item: Pending) => {
    patch(item.key, { state: 'saving', error: undefined })
    const checked = checkAttachment(item.file.name, item.file.type, item.file.size)
    if (!checked.ok)
      return patch(item.key, { state: 'failed', error: checked.reason, retry: false })
    const head = new Uint8Array(await item.file.slice(0, 16).arrayBuffer())
    if (!sniffMatches(checked.mime, head))
      return patch(item.key, {
        state: 'failed',
        error: `${item.file.name} does not look like the ${checked.mime} file its name says.`,
        retry: false,
      })
    const ref = w.services.newId('blob')
    try {
      await saveBlob(ref, item.file)
    } catch (e) {
      return patch(item.key, {
        state: 'failed',
        error: e instanceof Error ? e.message : 'The file could not be saved on this device.',
        retry: true,
      })
    }
    const r = await w.act((s, c) =>
      addAttachment(s, c, actor, {
        spaceId,
        ...(projectId ? { projectId } : {}),
        ...(pageId ? { pageId } : {}),
        filename: item.file.name,
        mime: checked.mime,
        bytes: item.file.size,
        storageRef: ref,
        audience,
      }),
    )
    if (r.ok) patch(item.key, null)
    else {
      void removeBlob(ref).catch(() => {})
      patch(item.key, { state: 'failed', error: r.error.message, retry: false })
    }
  }

  const pick = (list: FileList | null) => {
    if (!list) return
    const items: Pending[] = [...list].map((file) => ({
      key: w.services.newId('up'),
      file,
      state: 'saving',
      retry: true,
    }))
    setPending((p) => [...p, ...items])
    items.forEach((i) => void save(i))
    if (input.current) input.current.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      {edit ? (
        <div>
          <label
            htmlFor={`file-${pageId ?? projectId ?? spaceId}`}
            className="mb-1 block text-sm font-medium text-ink"
          >
            Add files
          </label>
          <input
            ref={input}
            id={`file-${pageId ?? projectId ?? spaceId}`}
            type="file"
            multiple
            onChange={(e) => pick(e.target.files)}
            className={`${fieldClass} w-full py-2`}
          />
          <p className="mt-1 text-xs text-ink-muted">
            {ATTACHMENT_HELP} Kept in this browser only: nobody else, on any device, can open them
            yet.
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">You can open files here but not add them.</p>
      )}
      {pending.length ? (
        <ul className="flex flex-col gap-1">
          {pending.map((p) => (
            <li key={p.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{p.file.name}</span>
              {p.state === 'saving' ? (
                <output className="text-ink-muted">Saving…</output>
              ) : (
                <>
                  <span role="alert" className="text-danger">
                    {p.error}
                  </span>
                  {p.retry ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() => void save(p)}
                    >
                      Retry
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    onClick={() => patch(p.key, null)}
                  >
                    Dismiss
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {files.length ? (
        <ul className="flex flex-col gap-2">
          {files.map((a) => (
            <Row key={a.id} w={w} a={a} />
          ))}
        </ul>
      ) : (
        <Empty>No files yet.</Empty>
      )}
    </div>
  )
}
