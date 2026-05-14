import { memo, useRef, useState, Suspense, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'

// ── Soap-bubble shader ────────────────────────────────────────────────────────
// Fresnel transparency: nearly invisible at center, iridescent at edges —
// exactly what you see when you blow a bubble.
const BUBBLE_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`

const BUBBLE_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uOpacity;
  uniform sampler2D uArtTex;
  uniform float uHasArt;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float NdotV = max(dot(vNormal, vViewDir), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.8);

    // Thin-film iridescence at the rim
    float phase = NdotV * 4.2 + uTime * 0.07;
    vec3 irid = 0.5 + 0.5 * cos(phase + vec3(0.0, 2.094, 4.189));
    vec3 shellColor = mix(vec3(0.88, 0.95, 1.0), irid, fresnel * 0.90);

    // Blurred art dye — sphere normal as UV is a smooth spherical projection;
    // 5-tap box blur smears art colors like frosted glass.
    // The UV rotates with the bubble shell, so colours swirl as it spins.
    vec2 sphereUV = vNormal.xy * 0.5 + 0.5;
    float B = 0.10;
    vec3 dye  = texture2D(uArtTex, sphereUV).rgb;
    dye += texture2D(uArtTex, sphereUV + vec2( B, 0.0)).rgb;
    dye += texture2D(uArtTex, sphereUV + vec2(-B, 0.0)).rgb;
    dye += texture2D(uArtTex, sphereUV + vec2(0.0,  B)).rgb;
    dye += texture2D(uArtTex, sphereUV + vec2(0.0, -B)).rgb;
    dye /= 5.0;

    // Slight desaturation so vivid album colours don't swamp the iridescence
    float luma = dot(dye, vec3(0.299, 0.587, 0.114));
    dye = mix(dye, vec3(luma), 0.18);

    // Dye is strongest at the transparent centre, fades toward the iridescent rim
    float dyeStrength = uHasArt * (1.0 - fresnel * 0.55) * 0.68;
    vec3 col = mix(shellColor, dye, dyeStrength);

    // Raise the base alpha so the dye colour is visible even at the
    // near-transparent centre — without this the colour has nowhere to live.
    float alpha = fresnel * uOpacity + uHasArt * 0.13 + 0.008;
    gl_FragColor = vec4(col, alpha);
  }
`

// ── Glare texture (module singleton) ─────────────────────────────────────────
// Soft radial gradient from pure white core to transparent — simulates the
// bright specular highlight you see on a soap bubble in sunlight.
function makeGlareTexture(): THREE.CanvasTexture {
  const sz = 128
  const canvas = document.createElement('canvas')
  canvas.width = sz
  canvas.height = sz
  const ctx = canvas.getContext('2d')!
  const c = sz / 2
  const g = ctx.createRadialGradient(c * 0.65, c * 0.65, 0, c, c, c)
  g.addColorStop(0,    'rgba(255,255,255,1.0)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.82)')
  g.addColorStop(0.45, 'rgba(210,235,255,0.35)')
  g.addColorStop(0.75, 'rgba(190,220,255,0.08)')
  g.addColorStop(1,    'rgba(190,220,255,0.0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, sz, sz)
  return new THREE.CanvasTexture(canvas)
}

let _glareTex: THREE.CanvasTexture | null = null
function getGlareTex() {
  if (!_glareTex) _glareTex = makeGlareTexture()
  return _glareTex
}

// ── Seeded pseudo-RNG (sin-hash) ──────────────────────────────────────────────
function makeRng(seed: number) {
  let s = seed * 127.1 + 311.7
  return () => {
    s = Math.sin(s) * 43758.5453
    return s - Math.floor(s)
  }
}

// ── Bubble shell with custom shader ──────────────────────────────────────────
function BubbleShell({ radius, hovered, artTexture }: {
  radius: number
  hovered: boolean
  artTexture?: THREE.Texture
}) {
  const hoveredRef = useRef(hovered)
  useEffect(() => { hoveredRef.current = hovered }, [hovered])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uOpacity: { value: 0.58 },
      uArtTex:  { value: null },
      uHasArt:  { value: 0.0 },
    },
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  }), [])

  useEffect(() => {
    material.uniforms.uArtTex.value = artTexture ?? null
    material.uniforms.uHasArt.value = artTexture ? 1.0 : 0.0
  }, [artTexture, material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uOpacity.value = hoveredRef.current ? 0.82 : 0.58
  })

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[radius, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

// Suspense-aware wrapper: loads cover art and feeds it to BubbleShell.
// Drei's useTexture caches by URL — if ArtPlane already loaded this URL the
// texture is returned synchronously with no network round-trip.
function BubbleShellWithArt({ radius, hovered, coverUrl }: {
  radius: number
  hovered: boolean
  coverUrl: string
}) {
  const artTexture = useTexture(coverUrl)
  return <BubbleShell radius={radius} hovered={hovered} artTexture={artTexture} />
}

// ── Art plane helpers ─────────────────────────────────────────────────────────
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

// ── ReleaseBubble ─────────────────────────────────────────────────────────────
interface ReleaseBubbleProps {
  position: [number, number, number]
  radius: number
  cover?: string
  name: string
  isActive: boolean
  isFocused: boolean
  resetKey: number
  phaseOffset: number
  onClick: () => void
}

const ACTIVE_COLOR = new THREE.Color('#5ab5e0')

function ReleaseBubble({
  position, radius, cover, name, isActive, isFocused, resetKey, phaseOffset, onClick,
}: ReleaseBubbleProps) {
  const posGroupRef = useRef<THREE.Group>(null)
  const rotGroupRef = useRef<THREE.Group>(null)
  const microRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null])
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }, [resetKey])

  // Per-instance randomized animation params — stable across renders (seeded by phaseOffset)
  const { bobSpeed, bobAmp, rotSpeed, micro } = useMemo(() => {
    const r = makeRng(phaseOffset)
    return {
      bobSpeed: 0.30 + r() * 0.35,
      bobAmp:   0.10 + r() * 0.14,
      rotSpeed: 0.04 + r() * 0.08,
      micro: Array.from({ length: 4 }, () => ({
        phase:  r() * Math.PI * 2,
        orbitR: 0.90 + r() * 0.55,
        speed:  0.22 + r() * 0.35,
        size:   0.04 + r() * 0.05,
        yOff:  (r() - 0.5) * 0.55,
      })),
    }
  }, [phaseOffset])

  // Micro-bubble materials — each tiny bubble is also a soap bubble
  const microMats = useMemo(() => micro.map(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.1 } },
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  })), [micro])

  useEffect(() => () => microMats.forEach(m => m.dispose()), [microMats])

  const glareTex = getGlareTex()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (posGroupRef.current) {
      posGroupRef.current.position.y = position[1] + Math.sin(t * bobSpeed + phaseOffset) * bobAmp
      const target = isFocused ? (hovered ? 1.62 : 1.50) : hovered ? 1.18 : isActive ? 1.08 : 1
      const s = posGroupRef.current.scale.x
      posGroupRef.current.scale.setScalar(s + (target - s) * 0.08)
    }
    if (rotGroupRef.current) {
      rotGroupRef.current.rotation.y = t * rotSpeed + phaseOffset
    }
    microMats.forEach(m => { m.uniforms.uTime.value = t })
    microRefs.current.forEach((ref, i) => {
      if (!ref) return
      const mb = micro[i]
      const angle = t * mb.speed + mb.phase
      ref.position.x = Math.cos(angle) * mb.orbitR * radius
      ref.position.y = mb.yOff * radius + Math.sin(t * 0.35 + mb.phase) * mb.orbitR * radius * 0.5
      ref.position.z = Math.sin(angle) * mb.orbitR * radius * 0.55
    })
  })

  const artSize = radius * 1.1
  // Glare sprite covers ~40% of bubble diameter — soft, not sharp
  const glareScale = radius * 0.85

  return (
    <group
      ref={posGroupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Art plane */}
      {cover ? (
        <Suspense fallback={<FallbackPlane artSize={artSize} />}>
          <ArtPlane url={cover} artSize={artSize} />
        </Suspense>
      ) : (
        <FallbackPlane artSize={artSize} />
      )}

      {/* Active glow ring */}
      {isActive && (
        <mesh renderOrder={0} position={[0, 0, -0.01]}>
          <planeGeometry args={[artSize + 0.2, artSize + 0.2]} />
          <meshBasicMaterial color={ACTIVE_COLOR} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Rotating bubble shell */}
      <group ref={rotGroupRef}>
        {/* Backside inner rim — catches light on the inside edge */}
        <mesh renderOrder={1}>
          <sphereGeometry args={[radius, 20, 20]} />
          <meshBasicMaterial color="#a0ccf0" transparent opacity={0.05} side={THREE.BackSide} depthWrite={false} />
        </mesh>
        {/* Fresnel + iridescence shell; art-aware once texture resolves */}
        {cover ? (
          <Suspense fallback={<BubbleShell radius={radius} hovered={hovered} />}>
            <BubbleShellWithArt radius={radius} hovered={hovered} coverUrl={cover} />
          </Suspense>
        ) : (
          <BubbleShell radius={radius} hovered={hovered} />
        )}
      </group>

      {/* Glare sprite — Sprite auto-faces camera, so it stays at upper-left
          regardless of sphere rotation. This is the sun-on-soap-bubble highlight. */}
      <sprite
        position={[-radius * 0.32, radius * 0.40, radius * 0.68]}
        scale={[glareScale, glareScale, 1]}
        renderOrder={3}
      >
        <spriteMaterial map={glareTex} transparent depthWrite={false} />
      </sprite>

      {/* Micro-bubble satellite particles — also use the soap bubble shader */}
      {micro.map((mb, i) => (
        <mesh key={i} ref={el => { microRefs.current[i] = el }} renderOrder={3}>
          <sphereGeometry args={[mb.size * radius, 8, 8]} />
          <primitive object={microMats[i]} attach="material" />
        </mesh>
      ))}

      {/* Label */}
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
            renderOrder={4}
          >
            {name}
          </Text>
        </Suspense>
      </Billboard>
    </group>
  )
}

export default memo(ReleaseBubble)
