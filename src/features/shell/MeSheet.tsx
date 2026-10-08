import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMe } from '../../lib/hooks'
import { renameMe, saveAvatar, saveNsfw, savePrivacy } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { GoofyFace } from '../../ui/GoofyFace'
import { Sheet, Toggle } from '../../ui/kit'
import { IconBrush } from '../../ui/icons'
import { avatarFromTraits, faceTraits, type AvatarConfig } from '../../ui/face'
import { FaceBuilder } from '../onboarding/FaceBuilder'

const VALID = /^[A-Za-z0-9_.]{3,20}$/

function MeBody({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const [face, setFace] = useState<AvatarConfig | null>(null)
  const [name, setName] = useState(me?.username ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setName(me?.username ?? ''), [me?.username])
  if (!me) return null
  const temp = !!me.temp
  const current = me.avatar ?? avatarFromTraits(faceTraits(me.username))

  if (editing && face)
    return (
      <FaceBuilder
        name={me.username}
        value={face}
        onChange={setFace}
        onDone={() => {
          void saveAvatar(face)
          setEditing(false)
        }}
      />
    )

  const dirty = name !== me.username
  const saveName = async () => {
    if (!VALID.test(name)) return setErr('3 to 20 letters, numbers, _ or .')
    setBusy(true)
    try {
      await renameMe(name)
      setErr(null)
    } catch (e) {
      setErr(isApiError(e) && e.code === 'username_taken' ? 'taken, try another' : 'something broke, try again')
    }
    setBusy(false)
  }

  return (
    <div className="me">
      <div className="me-face">
        <GoofyFace name={me.username} avatar={current} size={112} mood="happy" />
        {!temp && (
          <button
            type="button"
            className="ob-face-btn ob-brush me-edit"
            aria-label="edit face"
            onClick={() => {
              setFace(current)
              setEditing(true)
            }}
          >
            <IconBrush size={22} />
          </button>
        )}
      </div>
      {temp ? (
        <p className="me-temp">
          {me.username} <span>temp</span>
        </p>
      ) : (
        <div className="me-name">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20))
              setErr(null)
            }}
            aria-label="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <AnimatePresence>
            {dirty && (
              <motion.button type="button" className="me-save" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} disabled={busy} onClick={saveName}>
                save
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
      {err && <p className="ob-error">{err}</p>}
      <h3 className="settings-label">vibe</h3>
      <div className="settings-row">
        <span className="grow">
          nsfw <small className="nsfw-sub">foul language ok</small>
        </span>
        <Toggle label="nsfw" on={me.nsfw === true} onChange={(v) => void saveNsfw(v)} />
      </div>
      <h3 className="settings-label">privacy</h3>
      <div className="settings-row">
        <span className="grow">show active status</span>
        <Toggle label="show active status" on={me.show_status !== false} onChange={(v) => void savePrivacy(v, null)} />
      </div>
      <div className="settings-row" style={{ marginTop: 8 }}>
        <span className="grow">show seen</span>
        <Toggle label="show seen" on={me.show_seen !== false} onChange={(v) => void savePrivacy(null, v)} />
      </div>
      <button type="button" className="fb-done" style={{ marginTop: 18 }} onClick={onClose}>
        done
      </button>
    </div>
  )
}

export function MeButton({ size = 32 }: { size?: number }) {
  const me = useMe()
  const [open, setOpen] = useState(false)
  if (!me) return null
  return (
    <>
      <button type="button" className="me-btn" aria-label="your profile" onClick={() => setOpen(true)}>
        <GoofyFace name={me.username} size={size} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="your profile">
        <MeBody onClose={() => setOpen(false)} />
      </Sheet>
    </>
  )
}
