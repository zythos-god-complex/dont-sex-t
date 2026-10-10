// A small "now playing" card: album art, track, artist, a little equalizer. Opens the track in Spotify.
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
