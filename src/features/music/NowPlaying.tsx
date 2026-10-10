// A small "now playing" card: album art, track, artist, a little equalizer. Opens the track in Spotify.
import { IconPlay } from '../../ui/icons'
type Track = { t: string; by: string; img: string; url: string }

function Bars() {
  return (
    <span className="np-eq" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

export function NowPlaying({ track, compact }: { track: Track; compact?: boolean }) {
  return (
    <a className={'np' + (compact ? ' is-compact' : '')} href={track.url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
      <span className="np-art">
        <img src={track.img} alt="" loading="lazy" decoding="async" />
        <Bars />
      </span>
      <span className="np-text">
        <b className="ellipsis">{track.t}</b>
        <small className="ellipsis">{track.by}</small>
      </span>
    </a>
  )
}

type SongT = { id: string; t: string; by: string; img: string }

/** the profile song: big cover on a blurred cover backdrop, opens a song.link page (every music app) */
export function SongCard({ song }: { song: SongT }) {
  return (
    <a className="song-card" href={`https://song.link/i/${song.id}`} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
      <img className="song-bg" src={song.img} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      <img className="song-art" src={song.img} alt="" loading="lazy" decoding="async" />
      <span className="song-meta">
        <small>on repeat</small>
        <b className="ellipsis">{song.t}</b>
        <span className="ellipsis">{song.by}</span>
      </span>
      <span className="song-play">
        <IconPlay size={18} />
      </span>
    </a>
  )
}
