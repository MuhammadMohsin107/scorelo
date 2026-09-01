import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// SCORELO ANALYTICS INTELLIGENCE SCENE
//
// Visual concept: "Your store's performance, seen from above."
// A central glowing core (the store) sits inside concentric orbit rings
// representing different audit pillars (SEO, CRO, Speed, Content, AI).
// Connected data nodes pulse with energy flowing through curved data streams
// back to the core. A gentle particle field fills the space with depth.
//
// Motion: slow, deliberate, intelligent — not playful or random.
// Colors: deep indigo → violet → electric blue — Scorelo brand.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Central performance core ─────────────────────────────────────────────────
// An icosphere with a subtle inner glow, representing the Shopify store
// being analyzed. It pulses slowly like a heartbeat.

function PerformanceCore() {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const outerGeo = useMemo(() => new THREE.IcosahedronGeometry(0.72, 2), []);
  const innerGeo = useMemo(() => new THREE.SphereGeometry(0.46, 24, 24), []);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1.05, 0.018, 12, 80), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Slow, organic rotation — like a spinning orrery
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.08;
      outerRef.current.rotation.x = Math.sin(t * 0.05) * 0.2;
    }
    if (innerRef.current) {
      // Pulsing scale — the "heartbeat" of the store
      const pulse = 1 + Math.sin(t * 1.4) * 0.04;
      innerRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.06;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.03) * 0.05;
    }
  });

  return (
    <group>
      {/* Outer wireframe icosphere */}
      <mesh ref={outerRef} geometry={outerGeo}>
        <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.18} />
      </mesh>

      {/* Inner glowing core sphere */}
      <mesh ref={innerRef} geometry={innerGeo}>
        <meshStandardMaterial
          color="#6366f1"
          emissive="#4f46e5"
          emissiveIntensity={1.2}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Equatorial ring */}
      <mesh ref={ringRef} geometry={ringGeo}>
        <meshBasicMaterial color="#a5b4fc" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ─── Pillar orbit ring with data nodes ─────────────────────────────────────────
// Each orbit ring represents a Scorelo audit pillar (SEO, CRO, Speed, Content, AI).
// Nodes pulse and have a glow effect. A thin wireframe ring traces the orbit path.

function PillarOrbitRing({
  radius,
  nodeCount,
  speed,
  tilt,
  orbitTilt,
  color,
  nodeSize = 0.045,
  ringOpacity = 0.1,
}: {
  radius: number;
  nodeCount: number;
  speed: number;
  tilt: number;
  orbitTilt: number;
  color: string;
  nodeSize?: number;
  ringOpacity?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(radius, 0.008, 8, 128), [radius]);
  const nodeGeo = useMemo(() => new THREE.SphereGeometry(nodeSize, 10, 10), [nodeSize]);

  const nodes = useMemo(() => {
    return Array.from({ length: nodeCount }, (_, i) => {
      const angle = (i / nodeCount) * Math.PI * 2;
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        phase: (i / nodeCount) * Math.PI * 2,
        // Vary sizes slightly for organic feel
        scale: 0.7 + Math.random() * 0.6,
      };
    });
  }, [nodeCount, radius]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * speed;
  });

  return (
    <group rotation={[tilt, 0, orbitTilt]}>
      {/* Orbit path ring */}
      <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={color} transparent opacity={ringOpacity} />
      </mesh>

      {/* Orbiting nodes */}
      <group ref={groupRef}>
        {nodes.map((node, i) => (
          <PulsingNode
            key={i}
            geometry={nodeGeo}
            position={node.position}
            color={color}
            phase={node.phase}
            scale={node.scale}
          />
        ))}
      </group>
    </group>
  );
}

// ─── Individual pulsing data node ─────────────────────────────────────────────

function PulsingNode({
  geometry,
  position,
  color,
  phase,
  scale,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  color: string;
  phase: number;
  scale: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Each node pulses independently, offset by phase
    const pulse = 1 + Math.sin(t * 1.8 + phase) * 0.25;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.5 + Math.sin(t * 1.8 + phase) * 0.8;
    meshRef.current.scale.setScalar(scale * pulse);
  });

  return (
    <mesh ref={meshRef} position={position} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        roughness={0.1}
        metalness={0.3}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── Data stream lines ─────────────────────────────────────────────────────────
// Curved lines from orbit nodes flowing energy toward the core — visualizing
// data being collected and analyzed.

function DataStreams() {
  const pointsRef = useRef<THREE.Points>(null);

  // `phases` is built inside the memo (one random offset per stream) but the animation drives
  // every stream off a single clock, so nothing reads it back out here.
  const { positions, colors } = useMemo(() => {
    const streamCount = 32;
    const streamLength = 24;
    const pos = new Float32Array(streamCount * streamLength * 3);
    const col = new Float32Array(streamCount * streamLength * 3);
    const ph = new Float32Array(streamCount);

    const streamColors = ['#818cf8', '#6366f1', '#a5b4fc', '#7c3aed', '#0ea5e9'];

    for (let s = 0; s < streamCount; s++) {
      const angle = (s / streamCount) * Math.PI * 2;
      const startRadius = 1.8 + Math.random() * 1.8;
      const startX = Math.cos(angle) * startRadius;
      const startY = (Math.random() - 0.5) * 2.5;
      const startZ = Math.sin(angle) * startRadius;
      ph[s] = Math.random() * Math.PI * 2;

      const colorHex = streamColors[s % streamColors.length];
      const color = new THREE.Color(colorHex);

      for (let p = 0; p < streamLength; p++) {
        const t = p / (streamLength - 1);
        // Bezier-like curve toward core
        const x = startX * (1 - t * t);
        const y = startY * (1 - t) + Math.sin(angle + t * Math.PI) * 0.3 * t;
        const z = startZ * (1 - t * t);

        const idx = (s * streamLength + p) * 3;
        pos[idx] = x;
        pos[idx + 1] = y;
        pos[idx + 2] = z;

        // Fade color from stream color → core color (bright indigo) toward end
        const alpha = Math.sin(t * Math.PI) * 0.85;
        col[idx] = color.r;
        col[idx + 1] = color.g;
        col[idx + 2] = color.b * alpha + 0.3;
      }
    }

    return { positions: pos, colors: col, phases: ph };
  }, []);

  // Animate by shifting which segments are "alive"
  const bufferRef = useRef<THREE.BufferAttribute | null>(null);
  const alphaRef = useRef<THREE.BufferAttribute | null>(null);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    pointsRef.current.rotation.y = t * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute ref={bufferRef} attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute ref={alphaRef} attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── Ambient star field ─────────────────────────────────────────────────────
// Very subtle ambient particles for spatial depth.

function StarField() {
  const meshRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 180;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere shell — not a box — for more natural feel
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    // Imperceptibly slow drift
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.008;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.004;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        color="#c7d2fe"
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Subtle grid floor ──────────────────────────────────────────────────────
// A perspective grid suggesting a data platform. Fades toward the edges.

function GridFloor() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(12, 12, 20, 20), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    // Very slight wobble to keep it alive
    meshRef.current.position.y = -2.0 + Math.sin(state.clock.elapsedTime * 0.2) * 0.04;
  });

  return (
    <mesh ref={meshRef} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.0, 0]}>
      <meshBasicMaterial color="#4f46e5" wireframe transparent opacity={0.06} />
    </mesh>
  );
}

// ─── Pointer-reactive camera rig ────────────────────────────────────────────

function CameraRig() {
  const { camera } = useThree();
  const pointerRef = useRef({ x: 0, y: 0 });
  const basePos = useMemo(() => new THREE.Vector3(0, 0.4, 6.5), []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  useFrame(() => {
    // Gently offset camera based on pointer — max ±0.3 units, very slow lag
    const targetX = basePos.x + pointerRef.current.x * 0.3;
    const targetY = basePos.y + pointerRef.current.y * 0.2;
    camera.position.x += (targetX - camera.position.x) * 0.018;
    camera.position.y += (targetY - camera.position.y) * 0.018;
    camera.lookAt(0, 0.2, 0);
  });

  return null;
}

// ─── Main scene ─────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      {/* Lighting — three-point for dimensional depth */}
      <ambientLight intensity={0.2} />
      {/* Key light — cool blue-white from upper right */}
      <directionalLight position={[4, 6, 4]} intensity={0.9} color="#e0e7ff" />
      {/* Fill light — violet from lower left for richness */}
      <directionalLight position={[-5, -3, -3]} intensity={0.5} color="#7c3aed" />
      {/* Core point light — warm indigo glow from center */}
      <pointLight position={[0, 0, 2]} intensity={4} color="#6366f1" distance={8} decay={2} />
      {/* Rim light — electric blue from behind for halo effect */}
      <pointLight position={[0, 0, -4]} intensity={1.2} color="#0ea5e9" distance={12} decay={2} />

      {/* Grid floor for spatial depth */}
      <GridFloor />

      {/* The analyzed Shopify store — center hero */}
      <PerformanceCore />

      {/* Five audit pillars as independent orbit rings */}
      {/* SEO — tight inner ring, fast */}
      <PillarOrbitRing
        radius={1.6}
        nodeCount={6}
        speed={0.22}
        tilt={0.15}
        orbitTilt={0.1}
        color="#818cf8"
        nodeSize={0.042}
        ringOpacity={0.12}
      />
      {/* CRO — medium ring, reverse */}
      <PillarOrbitRing
        radius={2.2}
        nodeCount={8}
        speed={-0.14}
        tilt={-0.25}
        orbitTilt={0.05}
        color="#a5b4fc"
        nodeSize={0.038}
        ringOpacity={0.1}
      />
      {/* Speed — wide ring, slow, tilted */}
      <PillarOrbitRing
        radius={2.9}
        nodeCount={10}
        speed={0.09}
        tilt={0.3}
        orbitTilt={-0.1}
        color="#6366f1"
        nodeSize={0.035}
        ringOpacity={0.08}
      />
      {/* Content — very wide, near-equatorial */}
      <PillarOrbitRing
        radius={3.5}
        nodeCount={12}
        speed={-0.06}
        tilt={0.05}
        orbitTilt={0.15}
        color="#c7d2fe"
        nodeSize={0.03}
        ringOpacity={0.06}
      />

      {/* Data streams — energy flowing from nodes to core */}
      <DataStreams />

      {/* Ambient depth */}
      <StarField />

      {/* Subtle parallax */}
      <CameraRig />
    </>
  );
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * Scorelo "Performance Intelligence" 3D scene.
 *
 * Visual concept: A pulsing store-core surrounded by five orbit rings (audit
 * pillars), with data nodes feeding energy streams back to the center — the
 * visual metaphor for Scorelo analyzing and improving store performance.
 *
 * PERFORMANCE:
 *  · Canvas only mounts on lg+ (AuthLayout hides the brand panel below lg).
 *  · DPR capped at 1.5 to limit GPU pressure.
 *  · No post-processing passes (bloom etc.) — glow is achieved via emissive
 *    intensity + additive blending, which costs nothing extra.
 *  · All geometries memoized and shared across instances.
 *  · `prefers-reduced-motion` freezes animation at the first frame.
 *
 * ACCESSIBILITY: The canvas is aria-hidden — purely decorative.
 */
export default function AuthScene({ className = '' }: { className?: string }) {
  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return (
    <div className={`h-full w-full ${className}`} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 6.5], fov: 42 }}
        frameloop={reducedMotion ? 'demand' : 'always'}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.35,
        }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
