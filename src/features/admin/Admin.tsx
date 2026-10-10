// Control room: pulse (numbers + megaphone), people (search, timeouts, perks), reports queue. Server gates every call on is_admin.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { adminCall } from '../../lib/engine'
import { useOnlineCounts } from '../../lib/hooks'
import { useStore } from '../../lib/store'
import { ago, duration } from '../../lib/format'
import { GoofyFace } from '../../ui/GoofyFace'
import { Segmented, Sheet, Toggle, TypingDots } from '../../ui/kit'
import { IconBack } from '../../ui/icons'
import { ProfileCardView } from '../profile/ProfileCard'
import { goHome } from '../shell/nav'
import './admin.css'

type Pair = [number, number]
type Stats = {
  users: number; temp: number; new1: number; new7: number; seen1h: number; seen1: number; seen7: number
  timeouts: number; vip: number; adults: number; nsfw: number; d1: Pair; d7: Pair; chat7: number
  msgs1: number; rmsgs1: number; convs1: number; day2: Pair; hours: number[]; signups: number[]
  storage: Record<string, Pair>; db: number; reports: number; rooms: { name: string; n: number }[]; notice: string | null
}
type Row = {
  id: string; username: string; gender: string; created_at: string; last_seen_at: string | null
  temp: boolean; nsfw: boolean; adult: boolean; age_set: boolean; vip: boolean; admin: boolean; banned: boolean; until: string | null; reports: number
}
type Line = { w: string; body: string; at: string }
type Detail = Row & { names: string[]; chats: number; blocked_by: number; push: number; room: Line[]; against: { id: number; reason: string; status: string; at: string; by: string | null }[] }
type Rep = { id: number; reason: string; status: string; at: string; by: string | null; target: string | null; target_id: string | null; snap: Line[] }
type Tab = 'pulse' | 'people' | 'reports'

const MB = 1024 * 1024
const FILE_CAP = 1024 * MB // supabase free tier
const DB_CAP = 500 * MB

export default function Admin() {
  const [, nav] = useLocation()
  const [tab, setTab] = useState<Tab>('pulse')
  const [who, setWho] = useState<string | null>(null)
  const [bump, setBump] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const refresh = useCallback(() => setBump((b) => b + 1), [])
  return (
    <div className="adm">
      <header className="m-head">
        <button type="button" className="icon-btn" aria-label="back" onClick={() => goHome(nav)}>
          <IconBack size={26} />
        </button>
        <h1 className="m-title">control room</h1>
        <span className="icon-btn-spacer" />
      </header>
      <div className="adm-tabs">
        <Segmented
          layoutId="adm-tab"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'pulse', label: 'pulse' },
            { id: 'people', label: 'people' },
            { id: 'reports', label: 'reports', ...(open ? { count: open } : {}) },
          ]}
        />
      </div>
      <div className="adm-scroll">
        {tab === 'pulse' && <Pulse bump={bump} onReports={() => setTab('reports')} onCount={setOpen} />}
        {tab === 'people' && <People bump={bump} open={setWho} />}
        {tab === 'reports' && <Reports bump={bump} open={setWho} onChange={refresh} />}
      </div>
      <UserSheet id={who} onClose={() => setWho(null)} onChange={refresh} />
    </div>
  )
}

function Loading({ err }: { err?: boolean }) {
  return <div className="adm-loading">{err ? <span>couldn't load</span> : <TypingDots />}</div>
}

function pct([a, b]: Pair): string {
  return b ? Math.round((a * 100) / b) + '%' : '·'
}

function size(b: number): string {
  return b >= 1024 * MB ? (b / 1024 / MB).toFixed(2) + ' GB' : b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'
}

function Tile({ k, v, sub, hot, alert, onClick }: { k: string; v: ReactNode; sub?: string; hot?: boolean; alert?: boolean; onClick?: () => void }) {
  const cls = 'adm-tile' + (hot ? ' is-hot' : '') + (alert ? ' is-alert' : '')
  const body = (
    <>
      <span className="adm-tile-v tnum">{v}</span>
      <span className="adm-tile-k">{k}</span>
      {sub && <span className="adm-tile-sub">{sub}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Bars({ data, from, to }: { data: number[]; from: string; to: string }) {
  const max = Math.max(1, ...data)
  return (
    <div className="adm-chart">
      <div className="adm-bars">
        {data.map((v, i) => (
          <span key={i} className={v ? '' : 'is-zero'} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={String(v)} />
        ))}
      </div>
      <div className="adm-bars-x">
        <span>{from}</span>
        <span>peak {max}</span>
        <span>{to}</span>
      </div>
    </div>
  )
}

function Gauge({ label, used, cap, sub }: { label: string; used: number; cap: number; sub?: string }) {
  const p = Math.min(100, (used / cap) * 100)
  return (
    <div className="adm-gauge">
      <div className="adm-gauge-top">
        <span>{label}</span>
        <span className="tnum">
          {size(used)} <small>of {size(cap)}</small>
        </span>
      </div>
      <div className={'adm-gauge-bar' + (p > 80 ? ' is-hot' : '')}>
        <span style={{ transform: `scaleX(${Math.max(0.01, p / 100)})` }} />
      </div>
      {sub && <span className="adm-gauge-sub">{sub}</span>}
    </div>
  )
}

function Pulse({ bump, onReports, onCount }: { bump: number; onReports: () => void; onCount: (n: number) => void }) {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState(false)
  const live = useOnlineCounts()
  const load = useCallback(() => {
    setErr(false)
    adminCall<Stats>('stats').then(
      (v) => {
        setS(v)
        onCount(v.reports)
      },
      () => setErr(true),
    )
  }, [onCount])
  useEffect(() => load(), [load, bump])
  if (!s) return <Loading err={err} />
  const img = s.storage['gat-img'] ?? [0, 0]
  const voice = s.storage['gat-voice'] ?? [0, 0]
  return (
    <div className="adm-body">
      <div className="adm-tiles">
        <Tile k="here now" v={live.all} sub={`${live.f} girls · ${live.m} boys`} hot />
        <Tile k="people" v={s.users} sub={`${s.temp} temp · ${s.vip} vip`} />
        <Tile k="new today" v={s.new1} sub={`${s.new7} this week`} />
        <Tile k="seen today" v={s.seen1} sub={`${s.seen1h} last hour · ${s.seen7} this week`} />
        <Tile k="dms today" v={s.msgs1} sub={`${s.convs1} chats going`} />
        <Tile k="room lines" v={s.rmsgs1} sub="today" />
        <Tile k="reports" v={s.reports} alert={s.reports > 0} onClick={onReports} sub={s.reports ? 'tap to sort' : 'all quiet'} />
        <Tile k="timeouts" v={s.timeouts} sub={`${s.adults} stamped 18+ · ${s.nsfw} spicy`} />
      </div>

      <h2 className="adm-h">do they stick</h2>
      <div className="adm-tiles">
        <Tile k="came back next day" v={pct(s.d1)} sub={`${s.d1[0]} of ${s.d1[1]}, last week`} />
        <Tile k="still here a week on" v={pct(s.d7)} sub={`${s.d7[0]} of ${s.d7[1]}`} />
        <Tile k="got a chat going" v={pct([s.chat7, s.new7])} sub={`${s.chat7} of ${s.new7} new`} />
        <Tile k="chats past day one" v={pct(s.day2)} sub={`${s.day2[0]} of ${s.day2[1]}`} />
      </div>

      <h2 className="adm-h">yap per hour</h2>
      <Bars data={s.hours} from="24h ago" to="now" />
      <h2 className="adm-h">signups</h2>
      <Bars data={s.signups} from="2 weeks ago" to="today" />

      <h2 className="adm-h">storage</h2>
      <Gauge label="files" used={img[1] + voice[1]} cap={FILE_CAP} sub={`${img[0]} photos ${size(img[1])} · ${voice[0]} voice ${size(voice[1])}`} />
      <Gauge label="database" used={s.db} cap={DB_CAP} />

      {s.rooms.length > 0 && (
        <>
          <h2 className="adm-h">loudest rooms today</h2>
          <ul className="adm-rank">
            {s.rooms.map((r) => (
              <li key={r.name}>
                <span className="ellipsis">{r.name}</span>
                <span className="tnum">{r.n}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="adm-h">megaphone</h2>
      <Megaphone current={s.notice} />
    </div>
  )
}

function Megaphone({ current }: { current: string | null }) {
  const [text, setText] = useState(current ?? '')
  const [live, setLive] = useState(current ?? '')
  const [busy, setBusy] = useState(false)
  const push = (t: string) => {
    setBusy(true)
    adminCall('notice', { text: t })
      .then(() => {
        setLive(t)
        if (!t) setText('')
      }, () => {})
      .finally(() => setBusy(false))
  }
  const next = text.trim()
  return (
    <div className="adm-mega">
      <textarea className="fl-bio" maxLength={160} value={text} onChange={(e) => setText(e.target.value)} placeholder="one line for everyone" />
      <div className="adm-row">
        <button type="button" className="adm-btn is-ink" disabled={busy || !next || next === live} onClick={() => push(next)}>
          {live ? 'update' : 'shout it'}
        </button>
        {live && (
          <button type="button" className="adm-btn" disabled={busy} onClick={() => push('')}>
            take it down
          </button>
        )}
        <span className="adm-count tnum">{160 - text.length}</span>
      </div>
    </div>
  )
}

const FILTERS: [string, string][] = [
  ['all', 'all'],
  ['new', 'new'],
  ['reported', 'reported'],
  ['timeout', 'timeout'],
  ['vip', 'vip'],
  ['nsfw', 'spicy'],
  ['gone', 'gone'],
]

function seen(r: Row, online: boolean): string {
  if (online) return 'here now'
  return r.last_seen_at ? `seen ${ago(r.last_seen_at)} ago` : 'never seen'
}

function Tags({ r }: { r: Row }) {
  return (
    <>
      {r.reports > 0 && <i className="adm-tag is-red">{r.reports} 🚩</i>}
      {r.until && <i className="adm-tag is-red">timeout</i>}
      {r.banned && <i className="adm-tag">gone</i>}
      {r.admin && <i className="adm-tag is-gold">admin</i>}
      {r.vip && !r.admin && <i className="adm-tag is-gold">vip</i>}
      {r.adult && <i className="adm-tag">18+</i>}
      {r.age_set && !r.adult && <i className="adm-tag is-red">minor</i>}
      {r.temp && <i className="adm-tag">temp</i>}
    </>
  )
}

function People({ bump, open }: { bump: number; open: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState('all')
  const [rows, setRows] = useState<Row[] | null>(null)
  const online = useStore((s) => s.online)
  useEffect(() => {
    const t = setTimeout(() => adminCall<Row[]>('users', { q, f }).then(setRows, () => setRows([])), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, f, bump])
  return (
    <div className="adm-body">
      <input
        className="adm-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search names"
        type="search"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="adm-chips">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className={'adm-chip' + (f === id ? ' is-on' : '')} onClick={() => setF(id)}>
            {label}
          </button>
        ))}
      </div>
      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="adm-empty">nobody here</p>
      ) : (
        <div className="adm-list">
          {rows.map((r) => (
            <button key={r.id} type="button" className="adm-person" onClick={() => open(r.id)}>
              <GoofyFace name={r.username} size={40} presence={online[r.id] ? 'online' : null} />
              <span className="adm-person-main">
                <span className="adm-person-name ellipsis">{r.username}</span>
                <span className="adm-person-sub ellipsis">
                  {seen(r, !!online[r.id])} · joined {ago(r.created_at)} ago
                </span>
              </span>
              <span className="adm-tags">
                <Tags r={r} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Body({ text }: { text: string }) {
  const img = /^\[\[img:([^|\]]+)/.exec(text)
  if (img) return <img className="adm-thumb" src={img[1]} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
  const tag = /^\[\[([a-z-]+)/.exec(text)
  if (tag) return <span className="adm-muted">{tag[1] === 'img-gone' ? 'photo, gone' : tag[1]}</span>
  return <>{text}</>
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <ul className="adm-lines">
      {lines.map((m, i) => (
        <li key={i}>
          <span className="adm-line-w">{m.w}</span>
          <span className="adm-line-b">
            <Body text={m.body} />
          </span>
          <time className="adm-line-t">{ago(m.at)}</time>
        </li>
      ))}
    </ul>
  )
}

const TIMEOUTS: [number, string][] = [
  [1, '1h'],
  [24, '1d'],
  [168, '7d'],
  [-1, 'forever'],
]

function UserSheet({ id, onClose, onChange }: { id: string | null; onClose: () => void; onChange: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [arm, setArm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, nav] = useLocation()
  const online = useStore((s) => (id ? !!s.online[id] : false))
  useEffect(() => {
    setD(null)
    setArm(null)
    if (id) adminCall<Detail>('user', { id }).then(setD, () => {})
  }, [id])
  const act = (op: string, a: Record<string, unknown>) => {
    if (!id) return
    setBusy(true)
    setArm(null)
    adminCall<Row>(op, { id, ...a })
      .then((r) => {
        setD((x) => (x ? { ...x, ...r } : x))
        onChange()
      }, () => {})
      .finally(() => setBusy(false))
  }
  return (
    <Sheet open={!!id} onClose={onClose} label="person">
      {!d ? (
        <Loading />
      ) : (
        <div className="adm-user">
          <ProfileCardView name={d.username} sub={seen(d, online)} />
          <div className="adm-tags is-wrap">
            <Tags r={d} />
          </div>
          <dl className="adm-facts">
            <div><dt>joined</dt><dd>{ago(d.created_at)} ago</dd></div>
            <div><dt>chats</dt><dd className="tnum">{d.chats}</dd></div>
            <div><dt>blocked by</dt><dd className="tnum">{d.blocked_by}</dd></div>
            <div><dt>age</dt><dd>{d.age_set ? (d.adult ? '18+' : 'under 18') : 'not stamped'}</dd></div>
            <div><dt>pings</dt><dd>{d.push ? 'on' : 'off'}</dd></div>
            <div><dt>gender</dt><dd>{d.gender === 'f' ? 'girl' : d.gender === 'm' ? 'boy' : d.gender}</dd></div>
          </dl>
          {d.names.length > 0 && <p className="adm-muted">used to be {d.names.join(', ')}</p>}

          {!d.admin && !d.banned && (
            <>
              <h3 className="adm-h">timeout</h3>
              <div className="adm-row is-wrap">
                {TIMEOUTS.map(([h, label]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={busy}
                    className={'adm-btn is-red' + (arm === label ? ' is-armed' : '')}
                    onClick={() => (arm === label ? act('ban', { h }) : setArm(label))}
                  >
                    {arm === label ? `${label}, sure?` : label}
                  </button>
                ))}
                {d.until && (
                  <button type="button" className="adm-btn" disabled={busy} onClick={() => act('ban', { h: 0 })}>
                    lift
                  </button>
                )}
              </div>
              {d.until && <p className="adm-muted">{d.until === 'infinity' ? 'out for good' : `out for ${duration(Date.parse(d.until) - Date.now())} more`}</p>}
            </>
          )}

          <h3 className="adm-h">extras</h3>
          <div className="settings-row">
            <span className="grow">crown, bio and live card</span>
            <Toggle label="perks" on={d.vip} disabled={busy} onChange={(v) => act('perks', { on: v })} />
          </div>
          <div className="adm-row is-wrap" style={{ marginTop: 10 }}>
            {d.age_set && (
              <button type="button" className="adm-btn" disabled={busy} onClick={() => act('passport', {})}>
                reset passport
              </button>
            )}
            <button type="button" className="adm-btn" disabled={busy} onClick={() => act('pfp', {})}>
              remove photo
            </button>
            {!d.banned && (
              <button
                type="button"
                className="adm-btn"
                onClick={() => {
                  onClose()
                  nav('/dm/' + encodeURIComponent(d.username))
                }}
              >
                message
              </button>
            )}
          </div>

          {d.against.length > 0 && (
            <>
              <h3 className="adm-h">reported for</h3>
              <ul className="adm-lines">
                {d.against.map((r) => (
                  <li key={r.id}>
                    <span className={'adm-tag' + (r.status === 'open' ? ' is-red' : '')}>{r.reason}</span>
                    <span className="adm-line-b">by {r.by ?? '?'}</span>
                    <time className="adm-line-t">{ago(r.at)}</time>
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.room.length > 0 && (
            <>
              <h3 className="adm-h">said in rooms</h3>
              <Lines lines={d.room} />
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

function Reports({ bump, open, onChange }: { bump: number; open: (id: string) => void; onChange: () => void }) {
  const [s, setS] = useState<'open' | 'done'>('open')
  const [list, setList] = useState<Rep[] | null>(null)
  useEffect(() => {
    setList(null)
    adminCall<Rep[]>('reports', { s }).then(setList, () => setList([]))
  }, [s, bump])
  const mark = (r: Rep) => {
    setList((l) => l?.filter((x) => x.id !== r.id) ?? l)
    void adminCall('report', { id: r.id, s: s === 'open' ? 'done' : 'open' }).then(onChange, () => {})
  }
  return (
    <div className="adm-body">
      <div className="adm-chips">
        {(['open', 'done'] as const).map((id) => (
          <button key={id} type="button" className={'adm-chip' + (s === id ? ' is-on' : '')} onClick={() => setS(id)}>
            {id}
          </button>
        ))}
      </div>
      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="adm-empty">{s === 'open' ? 'all quiet 😌' : 'nothing sorted yet'}</p>
      ) : (
        list.map((r) => (
          <article key={r.id} className="adm-rep">
            <header className="adm-rep-head">
              <button type="button" className="adm-rep-who" onClick={() => r.target_id && open(r.target_id)}>
                <GoofyFace name={r.target ?? '?'} size={34} />
                <span className="ellipsis">{r.target ?? '?'}</span>
              </button>
              <i className="adm-tag is-red">{r.reason}</i>
              <time className="adm-line-t">{ago(r.at)}</time>
            </header>
            <p className="adm-muted">from {r.by ?? '?'}</p>
            {r.snap.length ? <Lines lines={r.snap.slice(-10)} /> : <p className="adm-muted">nothing recent on record</p>}
            <div className="adm-row">
              <button type="button" className="adm-btn is-ink" onClick={() => r.target_id && open(r.target_id)}>
                deal with it
              </button>
              <button type="button" className="adm-btn" onClick={() => mark(r)}>
                {s === 'open' ? 'all good' : 'reopen'}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  )
}
