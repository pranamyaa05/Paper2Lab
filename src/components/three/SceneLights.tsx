import { Environment, Lightformer } from "@react-three/drei";

/** Soft, bright studio lighting with local image-based light (no network HDR). */
export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 6]} intensity={1.3} color="#fff6e6" />
      <directionalLight position={[-6, 3, -2]} intensity={0.45} color="#cfe4ff" />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer intensity={1.2} color="#bfe0ff" position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        <Lightformer intensity={1.2} color="#ffd6e2" position={[6, 2, 1]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
        <Lightformer intensity={0.8} color="#ffe9b8" position={[0, 1, 8]} scale={[12, 3, 1]} />
      </Environment>
    </>
  );
}
