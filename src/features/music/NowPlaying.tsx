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

type SongT = { id: string; t: string; by: string; img: string }

/** the profile song: opens a song.link page (every app), with a quick jiosaavn search on the side */
export function SongCard({ song }: { song: SongT }) {
  const saavn = 'https://www.jiosaavn.com/search/song/' + encodeURIComponent(`${song.t} ${song.by}`.slice(0, 80))
  return (
    <div className="np np-song">
      <a className="np-main" href={`https://song.link/i/${song.id}`} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
        <span className="np-art">
          <img src={song.img} alt="" loading="lazy" decoding="async" />
        </span>
        <span className="np-text">
          <b className="ellipsis">{song.t}</b>
          <small className="ellipsis">{song.by}</small>
        </span>
      </a>
      <a className="np-saavn" href={saavn} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
        saavn
      </a>
    </div>
  )
}
