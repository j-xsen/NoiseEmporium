import { memo, useRef, useState, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard, useTexture } from '@react-three/drei'
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

const ACTIVE_COLOR = new THREE.Color('#5ab5e0')

function ArtPlane({ url, artSize }: { url: string; artSize: number }) {
  const texture = useTexture(url)
  return (
    <mesh renderOrder={0}>
      <planeGeometry args={[artSize, artSize]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  )
}

function FallbackPlane({ artSize }: { artSize: number }) {
  return (
    <mesh renderOrder={0}>
      <planeGeometry args={[artSize, artSize]} />
      <meshBasicMaterial color="#1c3d6e" side={THREE.DoubleSide} />
    </mesh>
  )
}

function ReleaseBubble({
  position, radius, cover, name, isActive, phaseOffset, onClick,
}: ReleaseBubbleProps) {
  // posGroupRef: bobs + hover scale, never rotates — art plane lives here
  const posGroupRef = useRef<THREE.Group>(null)
  // rotGroupRef: only the glass sphere shell spins
  const rotGroupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

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
  const artSize = radius * 1.1

  return (
    <group
      ref={posGroupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Art plane — in the non-rotating group so it always faces the camera */}
      {cover ? (
        <Suspense fallback={<FallbackPlane artSize={artSize} />}>
          <ArtPlane url={cover} artSize={artSize} />
        </Suspense>
      ) : (
        <FallbackPlane artSize={artSize} />
      )}

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
            opacity={hovered ? 0.28 : 0.18}
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
        <Suspense fallback={null}>
          <Text
            font="/fonts/dm-sans-400.ttf"
            position={[0, -(radius + 0.35), 0]}
            fontSize={0.45}
            color={hovered ? '#ffffff' : '#f0e6c0'}
            anchorX="center"
            anchorY="top"
            maxWidth={radius * 3.5}
            textAlign="center"
            outlineWidth={0.03}
            outlineColor="#0a1e35"
            outlineOpacity={0.9}
            renderOrder={2}
          >
            {name}
          </Text>
        </Suspense>
      </Billboard>
    </group>
  )
}

export default memo(ReleaseBubble)
