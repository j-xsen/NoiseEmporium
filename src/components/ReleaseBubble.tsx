import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

interface ReleaseBubbleProps {
  position: [number, number, number]
  radius: number
  cover?: string
  name: string
  isActive: boolean
  phaseOffset: number
  onClick: () => void
}

function useCoverTexture(url?: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!url) return
    let disposed = false
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(url, (t) => {
      if (!disposed) setTexture(t)
    })
    return () => { disposed = true }
  }, [url])

  useEffect(() => {
    return () => { texture?.dispose() }
  }, [texture])

  return texture
}

const ACTIVE_EMISSIVE = new THREE.Color('#5ab5e0')
const DARK = new THREE.Color(0, 0, 0)

export default function ReleaseBubble({
  position, radius, cover, name, isActive, phaseOffset, onClick,
}: ReleaseBubbleProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const texture = useCoverTexture(cover)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime
    groupRef.current.position.y = position[1] + Math.sin(t * 0.5 + phaseOffset) * 0.18
    groupRef.current.rotation.y = t * 0.12 + phaseOffset

    const target = hovered ? 1.15 : 1
    const s = groupRef.current.scale.x
    groupRef.current.scale.setScalar(s + (target - s) * 0.1)
  })

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Cover art sphere */}
      <mesh>
        <sphereGeometry args={[radius, 28, 28]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#1a3a6a'}
          metalness={0.15}
          roughness={0.35}
          emissive={isActive ? ACTIVE_EMISSIVE : DARK}
          emissiveIntensity={isActive ? 0.3 : 0}
        />
      </mesh>

      {/* Outer glass shell */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius * 1.07, 18, 18]} />
        <meshPhysicalMaterial
          color={hovered ? '#a8d8f0' : '#c8e6f0'}
          transparent
          opacity={hovered ? 0.16 : 0.07}
          roughness={0.0}
          metalness={0.5}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      <Text
        position={[0, -(radius + 0.45), 0]}
        fontSize={0.2}
        color={hovered ? '#ffffff' : '#9ab5a3'}
        anchorX="center"
        anchorY="top"
        maxWidth={3.5}
        textAlign="center"
        outlineWidth={0.015}
        outlineColor="#000000"
        outlineOpacity={0.55}
      >
        {name}
      </Text>
    </group>
  )
}
