// Chat info: everything about this chat in one sheet. The header tap and the gear both open it.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Conversation } from '../../lib/types'
import { useMe } from '../../lib/hooks'
import { useStore } from '../../lib/store'
import { clearChat, nameHistory, report, setBlocked, setFriend, setGraffiti, setImages, setMuted, setTheme, setVoice } from '../../lib/engine'
import { enable } from '../../lib/push'
import { usePushBusy, usePushState } from '../../lib/hooks'
import { GoofyFace } from '../../ui/GoofyFace'
import { Segmented, Toggle, spring } from '../../ui/kit'
import { IconAddFriend, IconArrowRight, IconBack, IconBan, IconBell, IconCheck, IconFlag, IconFriend, IconImage, IconMic, IconPin, IconPlus, IconShare, IconSparkle } from '../../ui/icons'
import { EMBER_THEMES, getTheme, themeList, themeVars } from '../../themes/themes'
import { GRAFFITI, graffitiIcon } from '../../themes/graffiti'
import { itemById } from '../shop/catalog'
import { askBuy, coinText, useOwnsFn, useShop } from '../shop/shop'
import { Coin } from '../shop/Coin'
import { useThemeMode } from '../../themes/mode'
import { AMBIENT_LABEL, PARTICLE_AMBIENTS, SCENE_AMBIENTS, SPEED_ONLY, setAmbientPrefs, setLanding, useAmbientPrefs } from '../../themes/ambientPrefs'
import { setThemeOrigin } from './ThemeReveal'
import { togglePin, usePins } from '../inbox/pins'
import { peek } from '../profile/peek'

/** first tap arms (red, label ends in '?'), second tap does it; disarms on its own */
export function useArm(): [boolean, () => boolean] {
  const [arm, setArm] = useState(false)
  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(false), 3000)
    return () => clearTimeout(t)
  }, [arm])
  return [arm, () => (arm ? (setArm(false), true) : (setArm(true), false))]
}

function NameHistory({ peerId }: { peerId: string }) {
  const [list, setList] = useState<{ username: string; changed_at: string }[]>([])
  useEffect(() => {
    let live = true
    nameHistory(peerId).then((l) => live && setList(l || [])).catch(() => {})
    return () => {
      live = false
    }
  }, [peerId])
  if (!list.length) return null
  return (
    <span className="ci-aka ellipsis">was {list.map((h) => h.username).join(', ')}</span>
  )
}

function Effects({ convId, themeId }: { convId: string; themeId: string }) {
  const [open, setOpen] = useState(false)
  const kind = getTheme(themeId).ambient
  const amount = useAmbientPrefs((p) => p.amount)
  const speed = useAmbientPrefs((p) => p.speed)
  const landing = useAmbientPrefs((p) => p.landing[convId] ?? 'shake')
  const ambient = [...PARTICLE_AMBIENTS, ...SCENE_AMBIENTS].includes(kind as never)
  const label = AMBIENT_LABEL[kind]
  const fixed = (SPEED_ONLY as readonly string[]).includes(kind)
  return (
    <>
      <button type="button" className={'settings-row ci-row' + (open ? ' is-open' : '')} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <IconSparkle size={22} />
        <span className="grow">effects</span>
        <IconBack size={18} className="ci-chev" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ci-drop" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
            {ambient && (
              <div className="amb-ctl">
                {!fixed && (
                  <label className="amb-row">
                    <span>{label}</span>
                    <input type="range" min={0.25} max={4} step={0.05} value={amount} onChange={(e) => setAmbientPrefs({ amount: +e.target.value })} aria-label={label + ' amount'} />
                    <b className="tnum">{amount < 0.6 ? 'few' : amount > 2.2 ? 'loads' : amount > 1.3 ? 'more' : 'some'}</b>
                  </label>
                )}
                <label className="amb-row">
                  <span>speed</span>
                  <input type="range" min={0.3} max={3} step={0.05} value={speed} onChange={(e) => setAmbientPrefs({ speed: +e.target.value })} aria-label={label + ' speed'} />
                  <b className="tnum">{speed < 0.7 ? 'chill' : speed > 1.8 ? 'zoom' : speed > 1.2 ? 'quick' : 'normal'}</b>
                </label>
              </div>
            )}
            <div className="ci-land">
              <span className="grow">confetti</span>
              <Segmented layoutId={'land-' + convId} value={landing} onChange={(v) => setLanding(convId, v)} items={[{ id: 'shake' as const, label: 'shake' }, { id: 'slide' as const, label: 'slide' }]} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Themes({ conv, onPicked }: { conv: Conversation; onPicked: () => void }) {
  const mode = useThemeMode()
  const [tab, setTab] = useState<'default' | 'ember'>(EMBER_THEMES.includes(conv.theme ?? '') ? 'ember' : 'default')
  const me = useStore((s) => s.me)
  const spicy = useStore((s) => s.me?.nsfw === true && s.online[conv.peer.id]?.nsfw === true)
  const has = useOwnsFn()
  const prices = useShop((s) => s.prices)
  const pick = (id: string, x: number, y: number) => {
    setThemeOrigin(x, y)
    onPicked()
    setTimeout(() => void setTheme(conv.id, id), 260)
  }
  const list = themeList(mode)
    .filter((t) => (t.id !== 'matrix' || me?.admin) && (t.id !== 'lust' || spicy || conv.theme === 'lust') && EMBER_THEMES.includes(t.id) === (tab === 'ember'))
    .map((t) => ({ t, item: t.id === conv.theme || has('theme:' + t.id) ? null : itemById('theme:' + t.id) ?? null }))
    // current first, then everything you can use, the shop ones last
    .sort((a, b) => Number(b.t.id === conv.theme) - Number(a.t.id === conv.theme) || Number(!!a.item) - Number(!!b.item))
  return (
    <>
      <div className="theme-tabs">
        <Segmented layoutId="theme-tab" value={tab} onChange={setTab} items={[{ id: 'default', label: 'default' }, { id: 'ember', label: 'ember' }]} />
      </div>
      <div className="swatches ci-swatches" key={tab}>
        {list.map(({ t, item }) => {
          const on = t.id === conv.theme
          return (
            <motion.button
              key={t.id}
              type="button"
              className={'swatch' + (on ? ' is-on' : '') + (item ? ' is-locked' : '')}
              onClick={(e) => {
                if (on) return
                const x = e.clientX
                const y = e.clientY
                if (item) return askBuy(item.id, () => pick(t.id, x, y))
                pick(t.id, x, y)
              }}
              whileTap={{ scale: 0.94 }}
              aria-pressed={on}
              aria-label={t.name + (item ? ', in the shop' : '')}
            >
              <span className="swatch-prev" style={{ ...themeVars(t), background: t.bg }}>
                <span className="sw-b sw-recv" />
                <span className="sw-b sw-sent" />
                {on && (
                  <motion.span className="swatch-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
                    <IconCheck size={14} />
                  </motion.span>
                )}
              </span>
              <span className="swatch-name">{t.name}</span>
              {item && (
                <span className="swatch-price tnum">
                  <Coin size={13} />
                  {coinText(prices[item.id] ?? item.price)}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </>
  )
}

/** the doodle wall for this theme: a switch when you own it (or it's up), the price when you don't */
function GraffitiRow({ conv }: { conv: Conversation }) {
  const set = GRAFFITI[conv.theme]
  const id = 'graffiti:' + conv.theme
  const has = useOwnsFn()(id)
  const price = useShop((s) => s.prices[id] ?? itemById(id)?.price ?? 0)
  const [busy, setBusy] = useState(false)
  if (!set) return null
  const on = !!conv.graffiti
  const flip = (v: boolean) => {
    setBusy(true)
    setGraffiti(conv.id, v)
      .catch(() => {})
      .finally(() => setBusy(false))
  }
  const icon = graffitiIcon(set[0])
  return (
    <div className="settings-row ci-row ci-graf">
      <span className="ci-graf-ico" style={{ WebkitMaskImage: icon, maskImage: icon }} aria-hidden="true" />
      <span className="grow">graffiti</span>
      {has || on ? (
        <Toggle label="graffiti" on={on} disabled={busy} onChange={flip} />
      ) : (
        <button type="button" className="ci-buy tnum" onClick={() => askBuy(id, () => flip(true))}>
          <Coin size={14} />
          {coinText(price)}
        </button>
      )}
    </div>
  )
}

function Notifications({ conv }: { conv: Conversation }) {
  const push = usePushState(conv.id)
  const busy = usePushBusy()
  const on = !conv.muted
  const flip = (v: boolean) => {
    if (!v) return void setMuted(conv.id, true)
    // asks for push when the browser can, otherwise just unmutes (in-app alerts still work)
    if (push === 'off') void enable(conv.id)
    else void setMuted(conv.id, false)
  }
  return (
    <>
      <div className="settings-row">
        <IconBell size={22} />
        <span className="grow">notifications</span>
        {on && push === 'denied' && <span className="ci-state">blocked</span>}
        <Toggle label="notifications" on={on} disabled={busy} onChange={flip} />
      </div>
      {on && push === 'needs-install' && (
        <div className="ci-install" aria-label="add to home screen for notifications">
          <IconShare size={18} />
          <IconArrowRight size={14} />
          <span className="ci-install-plus">
            <IconPlus size={14} />
          </span>
        </div>
      )}
    </>
  )
}

function PinRow({ convId }: { convId: string }) {
  const on = usePins((s) => s.ids.includes(convId))
  return (
    <div className="settings-row">
      <IconPin size={22} filled={on} />
      <span className="grow">pin chat</span>
      <Toggle label="pin chat" on={on} onChange={() => togglePin(convId)} />
    </div>
  )
}

function FriendRow({ conv }: { conv: Conversation }) {
  const mine = !!conv.my_friend
  const theirs = !!conv.peer_friend
  const [arm, tap] = useArm()
  if (conv.status === 'pending' || conv.status === 'declined' || conv.blocked) return null
  return (
    <div className="settings-row">
      {mine && theirs ? <IconFriend size={22} /> : <IconAddFriend size={22} />}
      <span className="grow">{mine && theirs ? 'friends' : mine ? 'requested' : theirs ? 'added you' : 'friend'}</span>
      {mine && theirs ? (
        <button type="button" className={'acc-btn acc-forget' + (arm ? ' is-armed' : '')} onClick={() => tap() && void setFriend(conv.id, false)}>
          {arm ? 'unfriend?' : 'unfriend'}
        </button>
      ) : mine ? (
        <button type="button" className="acc-btn" onClick={() => void setFriend(conv.id, false)}>
          cancel
        </button>
      ) : (
        <button type="button" className="acc-btn is-main" onClick={() => void setFriend(conv.id, true)}>
          {theirs ? 'add back' : 'add friend'}
        </button>
      )}
    </div>
  )
}

function MediaRow({ kind, conv }: { kind: 'images' | 'voice'; conv: Conversation }) {
  const mine = kind === 'images' ? !!conv.my_images : !!conv.my_voice
  const theirs = kind === 'images' ? !!conv.peer_images : !!conv.peer_voice
  const state = mine && theirs ? 'on for both' : mine ? `waiting on ${conv.peer.username}` : theirs ? `${conv.peer.username} is on` : null
  return (
    <div className="settings-row">
      {kind === 'images' ? <IconImage size={22} /> : <IconMic size={22} />}
      <span className="grow ci-label">
        {kind === 'images' ? 'photos' : 'voice notes'}
        {state && <small className={'ellipsis' + (mine && theirs ? ' is-ok' : '')}>{state}</small>}
      </span>
      <Toggle label={kind === 'images' ? 'photos' : 'voice notes'} on={mine} onChange={(v) => void (kind === 'images' ? setImages(conv.id, v) : setVoice(conv.id, v))} />
    </div>
  )
}

const REASONS = ['spam', 'creepy', 'underage', 'nasty', 'other'] as const

function Safety({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const [rep, setRep] = useState<'idle' | 'pick' | 'done'>('idle')
  const [arm, tap] = useArm()
  const blocked = conv.blocked === 'me'
  const block = () => {
    if (blocked) return void setBlocked(conv.peer.id, false)
    if (!tap()) return
    void setBlocked(conv.peer.id, true)
    onClose()
  }
  return (
    <>
      {rep === 'pick' ? (
        <div className="report-chips">
          {REASONS.map((r) => (
            <button key={r} type="button" className="acc-btn" onClick={() => void report(conv.peer.username, r).then(() => setRep('done'), () => setRep('idle'))}>
              {r}
            </button>
          ))}
          <button type="button" className="acc-btn is-quiet" onClick={() => setRep('idle')}>
            cancel
          </button>
        </div>
      ) : (
        <div className="ci-safety">
          {rep === 'done' ? (
            <span className="ci-done">
              <IconCheck size={16} /> reported
            </span>
          ) : (
            <button type="button" className="block-btn" onClick={() => setRep('pick')}>
              <IconFlag size={18} /> report
            </button>
          )}
          <button type="button" className={'block-btn' + (arm ? ' is-armed' : '') + (blocked ? ' is-on' : '')} onClick={block}>
            <IconBan size={18} /> {blocked ? 'unblock' : rep === 'done' && !arm ? 'block too' : arm ? 'block?' : 'block'}
          </button>
        </div>
      )}
    </>
  )
}

function DeleteChat({ conv, onDone }: { conv: Conversation; onDone: () => void }) {
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = async (both: boolean) => {
    setBusy(true)
    navigator.vibrate?.([12, 30, 12])
    try {
      await clearChat(conv.id, both)
      onDone()
    } finally {
      setBusy(false)
      setAsk(false)
    }
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!ask ? (
        <motion.button key="del" type="button" className="ci-del" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAsk(true)}>
          delete chat
        </motion.button>
      ) : (
        <motion.div key="ask" className="del-ask" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
          <b>delete chat?</b>
          <button type="button" className="del-opt" disabled={busy} onClick={() => void go(false)}>
            for me
          </button>
          <button type="button" className="del-opt is-both" disabled={busy} onClick={() => void go(true)}>
            for both
          </button>
          <button type="button" className="del-cancel" disabled={busy} onClick={() => setAsk(false)}>
            cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ChatInfo({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const me = useMe()
  const peer = conv.peer
  return (
    <div className="settings ci">
      <button
        type="button"
        className="ci-peer"
        onClick={() => {
          onClose()
          setTimeout(() => peek(peer.username, peer.id), 180)
        }}
      >
        <GoofyFace name={peer.username} size={48} />
        <span className="ci-peer-text">
          <b className="ellipsis">{peer.username}</b>
          <NameHistory peerId={peer.id} />
        </span>
        <IconBack size={18} className="ci-chev is-right" />
      </button>
      <FriendRow conv={conv} />

      <h3 className="settings-label">theme</h3>
      <Themes conv={conv} onPicked={onClose} />
      <GraffitiRow conv={conv} />
      <Effects convId={conv.id} themeId={conv.theme} />

      <h3 className="settings-label">chat</h3>
      <Notifications conv={conv} />
      <PinRow convId={conv.id} />
      <MediaRow kind="images" conv={conv} />
      <MediaRow kind="voice" conv={conv} />

      {me && (
        <>
          <h3 className="settings-label">safety</h3>
          <Safety conv={conv} onClose={onClose} />
        </>
      )}
      <DeleteChat conv={conv} onDone={onClose} />
    </div>
  )
}
