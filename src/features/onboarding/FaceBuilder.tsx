import { useState } from 'react'
import { motion } from 'motion/react'
import { GoofyFace } from '../../ui/GoofyFace'
import { Segmented, spring } from '../../ui/kit'
import { IconCheck, IconDice } from '../../ui/icons'
import {
  BLOB_KINDS,
  BROW_KINDS,
  EYE_KINDS,
  FACE_PALETTE,
  MOUTH_KINDS,
  TOP_KINDS,
  randomAvatar,
  type AvatarConfig,
} from '../../ui/face'

type Tab = 'color' | 'shape' | 'eyes' | 'mouth' | 'extras'

function Tile({ on, onPick, children, label }: { on: boolean; onPick: () => void; children: React.ReactNode; label: string }) {
  return (
    <motion.button type="button" className={'fb-tile' + (on ? ' is-on' : '')} onClick={onPick} whileTap={{ scale: 0.9 }} transition={spring} aria-pressed={on} aria-label={label}>
      {children}
      {on && (
        <motion.span className="fb-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
          <IconCheck size={12} />
        </motion.span>
      )}
    </motion.button>
  )
}

export function FaceBuilder({ name, value, onChange, onDone }: { name: string | null; value: AvatarConfig; onChange: (a: AvatarConfig) => void; onDone: () => void }) {
  const [tab, setTab] = useState<Tab>('color')
  const [spin, setSpin] = useState(0)
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch })
  const face = (a: AvatarConfig, size = 58) => <GoofyFace name={name} avatar={a} size={size} blink={false} />

  return (
    <div className="fb">
      <div className="fb-preview">
        <motion.div key={JSON.stringify(value)} initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
          <GoofyFace name={name} avatar={value} size={128} />
        </motion.div>
        <motion.button
          type="button"
          className="fb-dice"
          aria-label="shuffle"
          animate={{ rotate: spin * 360 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={() => {
            setSpin((n) => n + 1)
            onChange(randomAvatar())
          }}
        >
          <IconDice size={24} />
        </motion.button>
      </div>

      <Segmented
        layoutId="fb-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'color', label: 'color' },
          { id: 'shape', label: 'shape' },
          { id: 'eyes', label: 'eyes' },
          { id: 'mouth', label: 'mouth' },
          { id: 'extras', label: 'extras' },
        ]}
      />

      <div className="fb-grid">
        {tab === 'color' &&
          FACE_PALETTE.map((c) => (
            <Tile key={c} label={c} on={value.color === c} onPick={() => set({ color: c })}>
              <span className="fb-color" style={{ background: c }} />
            </Tile>
          ))}
        {tab === 'shape' &&
          BLOB_KINDS.map((b) => (
            <Tile key={b} label={b} on={value.blob === b} onPick={() => set({ blob: b })}>
              {face({ ...value, blob: b })}
            </Tile>
          ))}
        {tab === 'eyes' &&
          EYE_KINDS.map((e) => (
            <Tile key={e} label={e} on={value.eyes === e} onPick={() => set({ eyes: e })}>
              {face({ ...value, eyes: e })}
            </Tile>
          ))}
        {tab === 'mouth' &&
          MOUTH_KINDS.map((m) => (
            <Tile key={m} label={m} on={value.mouth === m} onPick={() => set({ mouth: m })}>
              {face({ ...value, mouth: m })}
            </Tile>
          ))}
        {tab === 'extras' && (
          <>
            {TOP_KINDS.map((t) => (
              <Tile key={'top' + t} label={t} on={value.top === t} onPick={() => set({ top: t })}>
                {face({ ...value, top: t })}
              </Tile>
            ))}
            {BROW_KINDS.map((b) => (
              <Tile key={'brow' + b} label={b ?? 'no brows'} on={value.brows === b} onPick={() => set({ brows: b })}>
                {face({ ...value, brows: b, eyes: value.eyes === 'three' && b ? 'pair' : value.eyes })}
              </Tile>
            ))}
            <Tile label="blush" on={value.blush} onPick={() => set({ blush: !value.blush })}>
              {face({ ...value, blush: true })}
              <span className="fb-tag">blush</span>
            </Tile>
            <Tile label="freckles" on={value.freckles} onPick={() => set({ freckles: !value.freckles })}>
              {face({ ...value, freckles: true })}
              <span className="fb-tag">freckles</span>
            </Tile>
          </>
        )}
      </div>

      <button type="button" className="fb-done" onClick={onDone}>
        done
      </button>
    </div>
  )
}
