// Phone nav: home, chats, rooms in the thumb zone. Chat and room screens slide in over it.
import { useLocation } from 'wouter'
import { useUnreadTotal } from '../../lib/hooks'
import { Badge } from '../../ui/kit'
import { IconDm, IconLive, IconRooms } from '../../ui/icons'
import { useRoomsUnread } from '../rooms/rooms'
import { goTab } from './nav'

export const tabOf = (path: string): '/' | '/dm' | '/rooms' | null =>
  path === '/dm' || path === '/rooms' ? path : path.startsWith('/dm/') || path.startsWith('/rooms/') ? null : '/'

export default function TabBar({ path }: { path: string }) {
  const [, nav] = useLocation()
  const unread = useUnreadTotal()
  const roomsUnread = useRoomsUnread()
  const cur = tabOf(path)
  const tabs = [
    { to: '/', label: 'home', ico: <IconLive size={24} />, n: 0 },
    { to: '/dm', label: 'chats', ico: <IconDm size={24} filled={cur === '/dm'} />, n: unread },
    { to: '/rooms', label: 'rooms', ico: <IconRooms size={24} />, n: roomsUnread },
  ]
  const pick = (to: string) => {
    // same tab again: back to the top of its list
    if (to === cur) document.querySelector('.m-screen.is-tab .scroll-y')?.scrollTo({ top: 0, behavior: 'smooth' })
    else goTab(nav, to)
  }
  return (
    <nav className="tabbar" aria-label="tabs" inert={!cur}>
      {tabs.map((t) => (
        <button key={t.to} type="button" className={'tab' + (t.to === cur ? ' is-on' : '')} aria-current={t.to === cur ? 'page' : undefined} onClick={() => pick(t.to)}>
          <span className="tab-ico">
            {t.ico}
            <Badge n={t.n} className="tab-badge" />
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
