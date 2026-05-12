import { memo, useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
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

const ACTIVE_COLOR = new THREE.Color('#5ab5e0')

function ReleaseBubble({
  position, radius, cover, name, isActive, phaseOffset, onClick,
}: ReleaseBubbleProps) {
  // posGroupRef: bobs + hover scale, never rotates — art plane lives here
  const posGroupRef = useRef<THREE.Group>(null)
  // rotGroupRef: only the glass sphere shell spins
  const rotGroupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const texture = useCoverTexture(cover)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (posGroupRef.current) {
      posGroupRef.current.position.y = position[1] + Math.sin(t * 0.5 + phaseOffset) * 0.18
      const target = hovered ? 1.1 : 1
      const s = posGroupRef.current.scale.x
      posGroupRef.current.scale.setScalar(s + (target - s) * 0.08)
    }
    if (rotGroupRef.current) {
      rotGroupRef.current.rotation.y = t * 0.08 + phaseOffset
    }
  })

  // Plane sized to fill sphere interior; planeGeometry normal is +Z which faces the camera
  const artSize = radius * 1.35

  return (
    <group
      ref={posGroupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Art plane — in the non-rotating group so it always faces the camera */}
      <mesh renderOrder={0}>
        <planeGeometry args={[artSize, artSize]} />
        <meshBasicMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#1c3d6e'}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Active glow ring behind the art */}
      {isActive && (
        <mesh renderOrder={0} position={[0, 0, -0.01]}>
          <planeGeometry args={[artSize + 0.2, artSize + 0.2]} />
          <meshBasicMaterial color={ACTIVE_COLOR} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Glass bubble shell — spins around the stationary art */}
      <group ref={rotGroupRef}>
        <mesh renderOrder={1}>
          <sphereGeometry args={[radius, 20, 20]} />
          <meshPhysicalMaterial
            color="#d8eeff"
            iridescence={1}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[100, 400]}
            transparent
            opacity={hovered ? 0.22 : 0.1}
            roughness={0}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0}
            side={THREE.FrontSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Label — Billboard so it always faces the camera as the bubble bobs */}
      <Billboard>
        <Text
          position={[0, -(radius + 0.55), 0]}
          fontSize={0.24}
          color={hovered ? '#ffffff' : '#e8f4ff'}
          anchorX="center"
          anchorY="top"
          maxWidth={radius * 3}
          textAlign="center"
          outlineWidth={0.022}
          outlineColor="#000000"
          outlineOpacity={0.85}
        >
          {name}
        </Text>
      </Billboard>
    </group>
  )
}

export default memo(ReleaseBubble)
