import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PulleyScene } from "@/components/three/PulleyModel";
import { PartRegistry, type PartObjects } from "@/components/three/Highlight";
import { SceneLights } from "@/components/three/SceneLights";
import type { Segmentation } from "@/lib/analyze/segment";
import type { LabSpec, ParamValues, TemplateId } from "@/labs/types";
import { CellModel } from "./CellModel";
import { ChemModel } from "./ChemModel";
import { ElectrolysisModel } from "./ElectrolysisModel";
import { GenericModel } from "./GenericModel";
import { MotorModel } from "./MotorModel";
import { NeuronModel } from "./NeuronModel";
import { POPUP_WIDTH, PopupModel } from "./PopupModel";

type View = { pos: [number, number, number]; target: [number, number, number] };

const VIEWS: Record<TemplateId | "popup", View> = {
  "pulley-incline": { pos: [2.4, 2.4, 8.4], target: [0, 0.4, 0] },
  "dc-motor": { pos: [3.4, 2.9, 6.4], target: [0, -0.3, 0.4] },
  neuron: { pos: [0.6, 1.6, 8.6], target: [0, 0, 0] },
  "animal-cell": { pos: [2.8, 2.8, 6.6], target: [0, 0, 0] },
  phenolphthalein: { pos: [0, 2, 8.6], target: [0, 1, 0] },
  electrolysis: { pos: [2.6, 1.9, 7.4], target: [0, -0.3, 0.3] },
  generic: { pos: [4, 3.4, 7.4], target: [0, 0, 0] },
  popup: { pos: [0, 4.6, 5.4], target: [0, 0, 0.2] },
};

const MATERIALIZE_S = 1.9;
const SWAP_S = 0.8;
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export type CameraCommand = { kind: "focus"; part: string; nonce: number } | { kind: "rotate"; nonce: number } | { kind: "reset"; nonce: number };

export interface LabTicks {
  [action: string]: number;
}

export interface LabCanvasProps {
  spec: LabSpec;
  values: ParamValues;
  ticks: LabTicks;
  highlight: string | null;
  onSelect: (id: string) => void;
  /** The uploaded diagram, raised into 3D before the simulation appears. */
  popup?: { seg: Segmentation; aspect: number; imageUrl: string } | undefined;
  /** Changes whenever a new diagram is loaded, replaying the materialize animation. */
  runKey: string;
  onPhase?: (phase: "materialize" | "lab") => void;
  /** A camera instruction from the tutor; `nonce` changes each time so repeats still fire. */
  camera?: CameraCommand | null;
  /** Display names for parts, so renamed pop-up regions show their new names. */
  partNames?: Record<string, string> | undefined;
}

function CameraDirector({
  view,
  controls,
  command,
  registry,
}: {
  view: View;
  controls: MutableRefObject<OrbitControlsImpl | null>;
  command: CameraCommand | null | undefined;
  registry: PartObjects;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const t = useRef(0);
  const goal = useRef<View>(view);
  const spinUntil = useRef(0);
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    goal.current = view;
    t.current = 0;
  }, [view]);

  // Tutor camera actions: fly to a part, turn the model around, or go back to the overview.
  useEffect(() => {
    if (!command) return;
    if (command.kind === "rotate") {
      spinUntil.current = performance.now() + 6000;
      return;
    }
    if (command.kind === "reset") {
      spinUntil.current = 0;
      goal.current = view;
      t.current = 0;
      return;
    }
    const objs = [...(registry.get(command.part) ?? [])];
    if (!objs.length) return;
    const box = new THREE.Box3();
    objs.forEach((o) => box.expandByObject(o));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const dir = camera.position.clone().sub(controls.current?.target ?? new THREE.Vector3()).normalize();
    const dist = Math.min(9, Math.max(2.4, radius * 3.2 + 1));
    goal.current = { target: center.toArray() as View["target"], pos: center.clone().addScaledVector(dir, dist).toArray() as View["pos"] };
    t.current = 0;
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const c = controls.current;
    if (c) {
      c.autoRotate = performance.now() < spinUntil.current;
      c.autoRotateSpeed = 5;
    }
    if (t.current > 1.4) return;
    t.current += Math.min(delta, 0.05);
    goalTarget.set(...goal.current.target);
    goalPos.set(...goal.current.pos);
    // Pull back on portrait screens so the whole model fits.
    const aspect = size.width / size.height;
    if (aspect < 1.1) goalPos.sub(goalTarget).multiplyScalar(1 + (1.1 - aspect) * 0.9).add(goalTarget);
    const k = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    camera.position.lerp(goalPos, k);
    if (c) {
      c.target.lerp(goalTarget, k);
      c.update();
    } else camera.lookAt(goalTarget);
  });
  return null;
}

function TemplateModel({ spec, values, ticks, highlight, onSelect }: Omit<LabCanvasProps, "popup" | "runKey" | "onPhase" | "partNames" | "camera">) {
  const v = (id: string, d: number) => values[id] ?? d;
  const pulleyParams = useMemo(() => ({ M: v("M", 2), m: v("m", 3), thetaDeg: v("theta", 30), mu: v("mu", 0.1) }), [values]); // eslint-disable-line react-hooks/exhaustive-deps
  switch (spec.template) {
    case "pulley-incline":
      return <PulleyScene params={pulleyParams} resetKey={ticks.restart ?? 0} highlight={highlight} onSelect={onSelect} />;
    case "dc-motor":
      return <MotorModel voltage={v("voltage", 6)} field={v("field", 0.5)} turns={v("turns", 20)} reversed={(ticks.reverse ?? 0) % 2 === 1} highlight={highlight} onSelect={onSelect} />;
    case "neuron":
      return <NeuronModel myelinated={v("myelin", 1) >= 0.5} stimulusMv={v("stimulus", 20)} fireKey={ticks.stimulate ?? 0} highlight={highlight} onSelect={onSelect} />;
    case "animal-cell":
      return <CellModel cutaway={v("cutaway", 60)} energy={v("energy", 40)} secretion={v("secretion", 50)} outside={v("outside", 300)} highlight={highlight} onSelect={onSelect} />;
    case "phenolphthalein":
      return <ChemModel pH={v("pH", 9)} dropKey={ticks.drop ?? 0} highlight={highlight} onSelect={onSelect} />;
    case "electrolysis":
      return <ElectrolysisModel voltage={v("voltage", 6)} conc={v("conc", 0.5)} resetKey={ticks.reset ?? 0} highlight={highlight} onSelect={onSelect} />;
    case "generic":
      return spec.scene?.length ? <GenericModel scene={spec.scene} parts={spec.parts} values={values} highlight={highlight} onSelect={onSelect} /> : null;
  }
}

/** Raises the diagram off the page, then swaps it for the live simulation. */
function Stage(props: LabCanvasProps & { controls: MutableRefObject<OrbitControlsImpl | null>; registry: PartObjects }) {
  const { spec, popup, runKey, onPhase, values, highlight, onSelect } = props;
  // A demo lab with no AI scene *is* the pop-up: it stays as the interactive model.
  const popupIsLab = spec.template === "generic" && !spec.scene?.length;
  const clock = useRef(0);
  const progress = useRef(0);
  const [phase, setPhase] = useState<"materialize" | "lab">(popup ? "materialize" : "lab");
  const popupGroup = useRef<THREE.Group>(null);
  const modelGroup = useRef<THREE.Group>(null);

  useEffect(() => {
    clock.current = 0;
    progress.current = 0;
    setPhase(popup ? "materialize" : "lab");
  }, [runKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onPhase?.(phase), [phase, onPhase]);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05);
    const t = clock.current;
    progress.current = Math.min(1, t / MATERIALIZE_S);
    if (popupIsLab || !popup) {
      if (phase !== "lab" && t > MATERIALIZE_S * 0.8) setPhase("lab");
      if (modelGroup.current) modelGroup.current.scale.setScalar(1);
      return;
    }
    const swap = smooth((t - MATERIALIZE_S) / SWAP_S);
    if (phase === "materialize" && t > MATERIALIZE_S) setPhase("lab");
    if (popupGroup.current) {
      popupGroup.current.visible = swap < 0.999;
      popupGroup.current.position.y = -2.5 * swap;
      popupGroup.current.scale.setScalar(1 - 0.5 * swap);
    }
    if (modelGroup.current) {
      modelGroup.current.visible = swap > 0.001;
      modelGroup.current.scale.setScalar(0.15 + 0.85 * swap);
      modelGroup.current.position.y = 2.2 * (1 - swap);
      modelGroup.current.rotation.y = (1 - swap) * -1.2;
    }
  });

  const popupScale = popup ? Math.min(1, 5.6 / POPUP_WIDTH) : 1;
  const view = phase === "materialize" || popupIsLab ? VIEWS.popup : VIEWS[spec.template];

  return (
    <>
      <CameraDirector view={view} controls={props.controls} command={props.camera} registry={props.registry} />
      {popup && (
        <group ref={popupGroup} scale={popupScale}>
          <PopupModel
            seg={popup.seg}
            aspect={popup.aspect}
            imageUrl={popup.imageUrl}
            progress={progress}
            explode={popupIsLab ? (values.explode ?? 0.25) : 0.15}
            depth={popupIsLab ? (values.depth ?? 1) : 1}
            spin={popupIsLab && (values.spin ?? 0) >= 0.5}
            highlight={popupIsLab ? highlight : null}
            onSelect={popupIsLab ? onSelect : undefined}
            names={props.partNames}
          />
        </group>
      )}
      {!popupIsLab && (
        <group ref={modelGroup} visible={!popup}>
          <TemplateModel {...props} />
        </group>
      )}
    </>
  );
}

export default function LabCanvas(props: LabCanvasProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const registry = useMemo<PartObjects>(() => new Map(), []);
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 40, position: VIEWS.popup.pos, near: 0.1, far: 80 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}>
      <SceneLights />
      <PartRegistry.Provider value={registry}>
        <Stage {...props} controls={controls} registry={registry} />
      </PartRegistry.Provider>
      <ContactShadows position={[0, -2.05, 0]} opacity={0.25} scale={14} blur={2.6} far={4} />
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={3} maxDistance={18} enablePan={false} />
    </Canvas>
  );
}
