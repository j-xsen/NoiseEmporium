import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, GradientTexture } from '@react-three/drei'
import ReleaseBubble from './ReleaseBubble'
import type { Release, Collection } from '../types'

// 3 bubbles per row, spaced 3.8 units apart.
// Camera at z=22 fov=50: frustum half-width at z=0 is ~5.1 on 9:16 mobile.
// Outermost bubble center at x=3.8, max radius 1.6 → edge at 5.4 — fits safely.
const COLS = 3
const COL_SPACING = 3.8
const ROW_Y: [number, number] = [3.5, -2.0]

function colX(i: number): number {
  return (i - (COLS - 1) / 2) * COL_SPACING
}

interface Item {
  id: string
  name: string
  label: string      // accessible name e.g. "Forever — EP"
  cover?: string
  radius: number
  isActive: boolean
  onClick: () => void
}

interface BubbleWorldProps {
  releases: Release[]
  collections: Collection[]
  currentSongId?: string
}

export default function BubbleWorld({ releases, collections, currentSongId }: BubbleWorldProps) {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)

  const row0: Item[] = releases.map(r => ({
    id: r.id,
    name: r.name,
    label: `${r.name} — ${r.releaseType.charAt(0).toUpperCase() + r.releaseType.slice(1)}`,
    cover: r.cover,
    radius: r.releaseType === 'album' ? 1.6 : r.releaseType === 'ep' ? 1.2 : 0.9,
    isActive: r.songs.some(s => s.id === currentSongId),
    onClick: () => navigate(`/${r.releaseType}/${r.slug}`),
  }))

  const row1: Item[] = collections.map(c => ({
    id: c.id,
    name: c.title,
    label: `${c.title} — Collection`,
    cover: c.cover,
    radius: 1.4,
    isActive: c.tracks.some(s => s.id === currentSongId),
    onClick: () => navigate(`/collection/${c.slug}`),
  }))

  const maxPage = Math.max(0, Math.ceil(Math.max(row0.length, row1.length) / COLS) - 1)
  const hasPrev = page > 0
  const hasNext = page < maxPage

  const visibleRow0 = row0.slice(page * COLS, (page + 1) * COLS)
  const visibleRow1 = row1.slice(page * COLS, (page + 1) * COLS)

  return (
    <div className="bubble-world" role="region" aria-label="Music library">

      {/* ── Accessible navigation ─────────────────────────────────────────── */}
      {/* Visually hidden; keyboard/screen-reader users navigate here.        */}
      <nav aria-label="Browse music" className="sr-only">
        {row0.length > 0 && (
          <section aria-labelledby="bw-releases-heading">
            <h2 id="bw-releases-heading">Releases</h2>
            <ul>
              {row0.map(item => (
                <li key={item.id}>
                  <button onClick={item.onClick}>{item.label}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {row1.length > 0 && (
          <section aria-labelledby="bw-collections-heading">
            <h2 id="bw-collections-heading">Collections</h2>
            <ul>
              {row1.map(item => (
                <li key={item.id}>
                  <button onClick={item.onClick}>{item.label}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </nav>

      {/* ── 3-D scene (visual only) ───────────────────────────────────────── */}
      <div className="bubble-world__canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0.75, 22], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          {/* Sky gradient — big plane behind the scene, matches the 2D CSS gradient */}
          <mesh position={[0, 0, -30]} scale={[80, 55, 1]}>
            <planeGeometry />
            <meshBasicMaterial toneMapped={false}>
              <GradientTexture
                stops={[0, 0.25, 0.6, 1]}
                colors={['#1a5c8a', '#2e8ab5', '#5ab8d4', '#8dd4e8']}
              />
            </meshBasicMaterial>
          </mesh>

          <ambientLight intensity={0.7} color="#ddeeff" />
          <directionalLight position={[5, 10, 3]} intensity={1.2} color="#fff8e0" />
          <hemisphereLight color="#87ceeb" groundColor="#6a9e5a" intensity={0.5} />

          {/* Row 0 — releases */}
          {visibleRow0.map((item, i) => (
            <ReleaseBubble
              key={item.id}
              position={[colX(i), ROW_Y[0], 0]}
              radius={item.radius}
              cover={item.cover}
              name={item.name}
              isActive={item.isActive}
              phaseOffset={i * 0.7}
              onClick={item.onClick}
            />
          ))}

          {/* Row 1 — collections */}
          {visibleRow1.map((item, i) => (
            <ReleaseBubble
              key={item.id}
              position={[colX(i), ROW_Y[1], 0]}
              radius={item.radius}
              cover={item.cover}
              name={item.name}
              isActive={item.isActive}
              phaseOffset={i * 0.7 + 1.5}
              onClick={item.onClick}
            />
          ))}

          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} />
        </Canvas>
      </div>

      {/* ── Page navigation ───────────────────────────────────────────────── */}
      {maxPage > 0 && (
        <nav className="bubble-nav" aria-label="Music pages">
          <button
            className="bubble-nav__arrow"
            onClick={() => setPage(p => p - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
          >
            ◄
          </button>
          <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
            <span className="sr-only">Page </span>
            {page + 1} / {maxPage + 1}
          </span>
          <button
            className="bubble-nav__arrow"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            aria-label="Next page"
          >
            ►
          </button>
        </nav>
      )}
    </div>
  )
}
