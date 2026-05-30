import { memo, useRef, useState, Suspense, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { contentfulImageUrl } from '../lib/contentful'

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
  uniform float uBaseAlpha;
  uniform float uDarkness;
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

    // Blurred art dye — only sample when a texture is actually bound.
    // Sampling a null/unbound sampler is undefined behaviour and causes flickering.
    vec3 dye = vec3(0.5);
    if (uHasArt > 0.5) {
      vec2 sphereUV = vNormal.xy * 0.5 + 0.5;
      float B = 0.10;
      dye  = texture2D(uArtTex, sphereUV).rgb;
      dye += texture2D(uArtTex, sphereUV + vec2( B, 0.0)).rgb;
      dye += texture2D(uArtTex, sphereUV + vec2(-B, 0.0)).rgb;
      dye += texture2D(uArtTex, sphereUV + vec2(0.0,  B)).rgb;
      dye += texture2D(uArtTex, sphereUV + vec2(0.0, -B)).rgb;
      dye /= 5.0;
      float luma = dot(dye, vec3(0.299, 0.587, 0.114));
      dye = mix(dye, vec3(luma), 0.18);
    }

    // Dye is strongest at the transparent centre, fades toward the iridescent rim
    float dyeStrength = uHasArt * (1.0 - fresnel * 0.38) * 0.82;
    vec3 col = mix(shellColor, dye, dyeStrength);

    // Raised base alpha so the dye has enough surface to read;
    // centre stays translucent enough to see the cover art plane behind it.
    float alpha = fresnel * uOpacity + uHasArt * 0.24 + uBaseAlpha;
    // Darken micro-bubbles that are behind the main bubble
    col   *= 1.0 - uDarkness * 0.72;
    alpha *= 1.0 - uDarkness * 0.88;
    gl_FragColor = vec4(col, alpha);
  }
`

// ── Seeded pseudo-RNG (sin-hash) ──────────────────────────────────────────────
function makeRng(seed: number) {
  let s = seed * 127.1 + 311.7
  return () => {
    s = Math.sin(s) * 43758.5453
    return s - Math.floor(s)
  }
}

// ── Seeded gradient texture for cover-less bubbles ───────────────────────────
// Produces a unique diagonal two-tone gradient seeded by the bubble's phaseOffset.
function makeGradientTexture(seed: number): THREE.CanvasTexture {
  const rng = makeRng(seed + 99.3)
  const hue1 = rng() * 360
  const hue2 = (hue1 + 100 + rng() * 80) % 360
  const sat   = (70 + rng() * 20) | 0
  const lit1  = (50 + rng() * 12) | 0
  const lit2  = (42 + rng() * 12) | 0
  const midH  = ((hue1 + hue2) / 2) | 0

  const sz = 128
  const canvas = document.createElement('canvas')
  canvas.width  = sz
  canvas.height = sz
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, sz, sz)
  g.addColorStop(0,   `hsl(${hue1 | 0}, ${sat}%, ${lit1}%)`)
  g.addColorStop(0.5, `hsl(${midH},     ${sat}%, ${(lit1 + lit2) >> 1}%)`)
  g.addColorStop(1,   `hsl(${hue2 | 0}, ${sat}%, ${lit2}%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, sz, sz)
  return new THREE.CanvasTexture(canvas)
}

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

// ── Bubble shell with custom shader ──────────────────────────────────────────
function BubbleShell({ radius, hovered, artTexture, isMobile }: {
  radius: number
  hovered: boolean
  artTexture?: THREE.Texture
  isMobile?: boolean
}) {
  const hoveredRef = useRef(hovered)
  useEffect(() => { hoveredRef.current = hovered }, [hovered])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uOpacity:   { value: 0.58 },
      uBaseAlpha: { value: 0.008 },
      uDarkness:  { value: 0.0 },
      uArtTex:    { value: null },
      uHasArt:    { value: 0.0 },
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

  const segs = isMobile ? 20 : 32

  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[radius, segs, segs]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

// Suspense-aware wrapper: loads cover art and feeds it to BubbleShell.
// Drei's useTexture caches by URL — if ArtPlane already loaded this URL the
// texture is returned synchronously with no network round-trip.
function BubbleShellWithArt({ radius, hovered, coverUrl, isMobile }: {
  radius: number
  hovered: boolean
  coverUrl: string
  isMobile?: boolean
}) {
  const artTexture = useTexture(coverUrl)
  if (artTexture.generateMipmaps) {
    artTexture.generateMipmaps = false
    artTexture.minFilter = THREE.LinearFilter
    artTexture.needsUpdate = true
  }
  return <BubbleShell radius={radius} hovered={hovered} artTexture={artTexture} isMobile={isMobile} />
}

// ── Art plane helpers ─────────────────────────────────────────────────────────
function ArtPlane({ url, artSize }: { url: string; artSize: number }) {
  const texture = useTexture(url)
  if (texture.generateMipmaps) {
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true
  }
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
  isMobile?: boolean
}

const ACTIVE_COLOR = new THREE.Color('#5ab5e0')

function ReleaseBubble({
  position, radius, cover, name, isActive, isFocused, resetKey, phaseOffset, onClick, isMobile,
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
      micro: Array.from({ length: isMobile ? 2 : 4 }, () => ({
        phase:  r() * Math.PI * 2,
        orbitR: 0.90 + r() * 0.55,
        speed:  0.22 + r() * 0.35,
        size:   0.04 + r() * 0.05,
        yOff:  (r() - 0.5) * 0.55,
      })),
    }
  }, [phaseOffset, isMobile])

  // Gradient texture for cover-less bubbles (collections with no image)
  const gradientTexture = useMemo(
    () => cover ? null : makeGradientTexture(phaseOffset),
    [cover, phaseOffset],
  )
  useEffect(() => () => { gradientTexture?.dispose() }, [gradientTexture])

  // Micro-bubble materials — each tiny bubble is also a soap bubble
  const microMats = useMemo(() => micro.map(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.1 }, uBaseAlpha: { value: 0.22 }, uDarkness: { value: 0.0 }, uArtTex: { value: null }, uHasArt: { value: 0.0 } },
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
      const ds = (target - s) * 0.08
      if (Math.abs(ds) > 0.0001) posGroupRef.current.scale.setScalar(s + ds)
    }
    if (rotGroupRef.current) {
      rotGroupRef.current.rotation.y = t * rotSpeed + phaseOffset
    }
    microRefs.current.forEach((ref, i) => {
      if (!ref) return
      const mb = micro[i]
      const angle = t * mb.speed + mb.phase
      ref.position.x = Math.cos(angle) * mb.orbitR * radius
      ref.position.y = mb.yOff * radius + Math.sin(t * 0.35 + mb.phase) * mb.orbitR * radius * 0.5
      ref.position.z = Math.sin(angle) * mb.orbitR * radius * 0.55
      // Darken when behind the bubble centre (z < 0); max depth = orbitR * radius * 0.55
      const maxDepth = mb.orbitR * radius * 0.55
      microMats[i].uniforms.uTime.value = t
      microMats[i].uniforms.uDarkness.value = Math.max(0, -ref.position.z / maxDepth)
    })
  })

  const coverTexUrl = contentfulImageUrl(cover, 300)
  const artSize = radius * 1.1
  // Glare sprite covers ~40% of bubble diameter — soft, not sharp
  const glareScale = radius * 0.85

  return (
    <group
      ref={posGroupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); document.body.style.cursor = 'auto'; onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Art plane — only when there's a real cover; gradient bubbles have no inner plane */}
      {coverTexUrl && (
        <Suspense fallback={<FallbackPlane artSize={artSize} />}>
          <ArtPlane url={coverTexUrl} artSize={artSize} />
        </Suspense>
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
          <sphereGeometry args={[radius, isMobile ? 12 : 20, isMobile ? 12 : 20]} />
          <meshBasicMaterial color="#a0ccf0" transparent opacity={0.05} side={THREE.BackSide} depthWrite={false} />
        </mesh>
        {/* Fresnel + iridescence shell; tinted by cover art or seeded gradient */}
        {coverTexUrl ? (
          <Suspense fallback={<BubbleShell radius={radius} hovered={hovered} isMobile={isMobile} />}>
            <BubbleShellWithArt radius={radius} hovered={hovered} coverUrl={coverTexUrl} isMobile={isMobile} />
          </Suspense>
        ) : (
          <BubbleShell radius={radius} hovered={hovered} artTexture={gradientTexture ?? undefined} isMobile={isMobile} />
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
