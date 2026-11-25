// SW-07 Visual 3D (opsional) — model kursi roda mengikuti pitch/roll IMU, warna sesuai status.
// Geometri disusun dari primitif mengikuti CAD tim (roda besar belakang, caster depan,
// sandaran + pegangan, armrest, footrest, bumper). Ganti dengan GLTF hasil ekspor CAD bila tersedia.
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { useDashboard } from '../../data/store';
import { useFreshness } from '../../hooks/useFreshness';
import Card from '../Card';

interface Live {
  ax: number; ay: number; az: number; rpmL: number; rpmR: number; color: string;
}

const C = {
  body: '#d7dde5',
  seat: '#3f6fa8',
  back: '#8a929e',
  arm: '#3f9a98',
  foot: '#5fbf9a',
  caster: '#d9a63a',
  bumper: '#d1612a',
  tire: '#1f2328',
  hub: '#5c6470',
};

function Wheel({ position, radius, width, spinRef }: {
  position: [number, number, number]; radius: number; width: number; spinRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group position={position}>
      <group ref={spinRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius, radius, width, 40]} />
          <meshStandardMaterial color={C.tire} roughness={0.9} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.72, radius * 0.72, width + 0.004, 32]} />
          <meshStandardMaterial color={C.hub} metalness={0.3} roughness={0.5} />
        </mesh>
        {/* jari-jari agar putaran terlihat */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[radius * 1.4, 0.012, width + 0.008]} />
          <meshStandardMaterial color="#9aa3ad" />
        </mesh>
      </group>
    </group>
  );
}

function Chair({ live }: { live: React.MutableRefObject<Live> }) {
  const root = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const wl = useRef<THREE.Group>(null);
  const wr = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const { ax, ay, az, rpmL, rpmR, color } = live.current;
    // orientasi dari vektor gravitasi (dibesarkan 2x agar terlihat)
    const roll = Math.atan2(ay, az) * 2;
    const pitch = Math.atan2(-ax, Math.hypot(ay, az)) * 2;
    if (root.current) {
      root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, roll, 0.15);
      root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, -pitch, 0.15);
    }
    const w = (rpm: number) => (rpm * 2 * Math.PI) / 60;
    if (wl.current) wl.current.rotation.z -= w(rpmL) * dt;
    if (wr.current) wr.current.rotation.z -= w(rpmR) * dt;
    bodyMat.current?.emissive.set(color);
    ring.current?.color.set(color);
  });

  // Sumbu: +x = depan, +y = atas, +z = kanan. Satuan ~ meter (prototipe 40 cm).
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[0.3, 0.33, 64]} />
        <meshBasicMaterial ref={ring} transparent opacity={0.7} />
      </mesh>
      <group ref={root} position={[0, 0, 0]}>
        {/* bodi */}
        <mesh position={[0.02, 0.15, 0]} castShadow>
          <boxGeometry args={[0.34, 0.14, 0.26]} />
          <meshStandardMaterial ref={bodyMat} color={C.body} emissiveIntensity={0.18} roughness={0.6} />
        </mesh>
        {/* dudukan */}
        <mesh position={[0.02, 0.232, 0]} castShadow>
          <boxGeometry args={[0.36, 0.025, 0.27]} />
          <meshStandardMaterial color={C.seat} roughness={0.7} />
        </mesh>
        {/* sandaran miring */}
        <mesh position={[-0.165, 0.33, 0]} rotation={[0, 0, -0.18]} castShadow>
          <boxGeometry args={[0.025, 0.2, 0.25]} />
          <meshStandardMaterial color={C.back} roughness={0.6} />
        </mesh>
        {/* pegangan dorong */}
        {[-0.115, 0.115].map((z) => (
          <mesh key={z} position={[-0.2, 0.44, z]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.06, 0.018, 0.022]} />
            <meshStandardMaterial color={C.back} />
          </mesh>
        ))}
        {/* armrest */}
        {[-0.14, 0.14].map((z) => (
          <group key={z} position={[0.03, 0, z]}>
            <mesh position={[0, 0.315, 0]}>
              <boxGeometry args={[0.22, 0.018, 0.022]} />
              <meshStandardMaterial color={C.arm} />
            </mesh>
            {[-0.07, 0.06].map((x) => (
              <mesh key={x} position={[x, 0.24, 0]}>
                <boxGeometry args={[0.025, 0.15, 0.012]} />
                <meshStandardMaterial color={C.arm} />
              </mesh>
            ))}
          </group>
        ))}
        {/* footrest */}
        <mesh position={[0.21, 0.11, 0]}>
          <boxGeometry args={[0.07, 0.02, 0.22]} />
          <meshStandardMaterial color={C.foot} />
        </mesh>
        <mesh position={[0.185, 0.14, 0]}>
          <boxGeometry args={[0.02, 0.07, 0.22]} />
          <meshStandardMaterial color={C.foot} />
        </mesh>
        {/* bumper belakang */}
        <mesh position={[-0.2, 0.075, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.2]} />
          <meshStandardMaterial color={C.bumper} />
        </mesh>
        {/* sensor ToF di depan */}
        <mesh position={[0.2, 0.08, 0]}>
          <boxGeometry args={[0.015, 0.02, 0.04]} />
          <meshStandardMaterial color="#111827" emissive="#38bdf8" emissiveIntensity={0.6} />
        </mesh>
        {/* roda besar belakang (penggerak) */}
        <Wheel position={[-0.09, 0.065, -0.155]} radius={0.065} width={0.028} spinRef={wl} />
        <Wheel position={[-0.09, 0.065, 0.155]} radius={0.065} width={0.028} spinRef={wr} />
        {/* caster depan */}
        {[-0.09, 0.09].map((z) => (
          <group key={z} position={[0.13, 0, z]}>
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[0.04, 0.03, 0.04]} />
              <meshStandardMaterial color={C.caster} />
            </mesh>
            <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.018, 24]} />
              <meshStandardMaterial color={C.tire} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function Wheelchair3D() {
  const t = useDashboard((s) => s.telemetry);
  const c = useDashboard((s) => s.control);
  const { dataStale } = useFreshness();
  const color = dataStale ? '#94a3b8' : c?.mode === 'E_STOP' ? '#ef4444' : c?.mode === 'PROTEKSI' ? '#f59e0b' : '#22c55e';

  const live = useRef<Live>({ ax: 0, ay: 0, az: 9.81, rpmL: 0, rpmR: 0, color });
  live.current = {
    ax: t?.imu.ax ?? 0, ay: t?.imu.ay ?? 0, az: t?.imu.az ?? 9.81,
    rpmL: dataStale ? 0 : t?.rpm_left ?? 0, rpmR: dataStale ? 0 : t?.rpm_right ?? 0, color,
  };
  const roll = t ? (Math.atan2(t.imu.ay, t.imu.az) * 180) / Math.PI : 0;
  const pitch = t ? (Math.atan2(-t.imu.ax, Math.hypot(t.imu.ay, t.imu.az)) * 180) / Math.PI : 0;

  return (
    <Card
      title="Visual 3D Kursi Roda"
      subtitle="Orientasi dari IMU · seret untuk memutar"
      stale={t != null && dataStale}
      right={<span className="pill" style={{ color, borderColor: color }}><span className="dot" />{c?.mode?.replace('_', '-') ?? '—'}</span>}
    >
      <div style={{ height: 260, borderRadius: 10, overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #273246, #141a24)' }}>
        <Canvas shadows camera={{ position: [0.55, 0.42, 0.62], fov: 40 }} dpr={[1, 2]}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.55} />
            <directionalLight position={[1, 2, 1]} intensity={1.2} castShadow />
            <directionalLight position={[-1, 1, -1]} intensity={0.35} />
            <gridHelper args={[1.4, 28, '#3b475c', '#263042']} />
            <Chair live={live} />
            <OrbitControls target={[0, 0.17, 0]} enablePan={false} minDistance={0.4} maxDistance={1.8} />
          </Suspense>
        </Canvas>
      </div>
      <div className="stat-row">
        <div className="stat"><div className="label">Pitch</div><div className="value mono">{pitch.toFixed(1)}°</div></div>
        <div className="stat"><div className="label">Roll</div><div className="value mono">{roll.toFixed(1)}°</div></div>
      </div>
    </Card>
  );
}
