import { Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, Environment } from '@react-three/drei'
import ReleaseBubble from './ReleaseBubble'
import type { Release, Collection } from '../types'

const GOLDEN_ANGLE = 2.399963

function getBubblePositions(count: number): [number, number, number][] {
  const radii = [4, 5, 6, 7]
  return Array.from({ length: count }, (_, i) => {
    const angle = i * GOLDEN_ANGLE
    const r = radii[i % 4]
    const y = Math.sin(i * 1.618) * 1.5
    return [Math.cos(angle) * r, y, Math.sin(angle) * r]
  })
}

interface BubbleWorldProps {
  releases: Release[]
  collections: Collection[]
  currentSongId?: string
}

export default function BubbleWorld({ releases, collections, currentSongId }: BubbleWorldProps) {
  const navigate = useNavigate()

  const items = [
    ...releases.map(r => ({
      id: r.id,
      name: r.name,
      cover: r.cover,
      radius: r.releaseType === 'album' ? 1.1 : r.releaseType === 'ep' ? 0.85 : 0.65,
      isActive: r.songs.some(s => s.id === currentSongId),
      onClick: () => navigate(`/${r.releaseType}/${r.slug}`),
    })),
    ...collections.map(c => ({
      id: c.id,
      name: c.title,
      cover: c.cover,
      radius: 1.0,
      isActive: c.tracks.some(s => s.id === currentSongId),
      onClick: () => navigate(`/collection/${c.slug}`),
    })),
  ]

  const positions = getBubblePositions(items.length)

  return (
    <div className="bubble-world">
      <Canvas camera={{ position: [0, 1, 14], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={['#071220']} />
        <fog attach="fog" args={['#071220', 20, 35]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[6, 8, 4]} intensity={1.2} color="#ffe4b5" />
        <pointLight position={[-8, 4, -6]} intensity={0.8} color="#5ab5e0" />
        <pointLight position={[8, -4, 6]} intensity={0.5} color="#4090c0" />

        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
        <Stars radius={60} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

        {items.map((item, i) => (
          <ReleaseBubble
            key={item.id}
            position={positions[i]}
            radius={item.radius}
            cover={item.cover}
            name={item.name}
            isActive={item.isActive}
            phaseOffset={i * 0.7}
            onClick={item.onClick}
          />
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={5}
          maxDistance={22}
          autoRotate={0}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}
