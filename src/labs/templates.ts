import { conductionVelocity, firesActionPotential, RESTING_MV, THRESHOLD_MV } from "@/lib/sim/neuron";
import { cellCurrent, gasVolumes } from "@/lib/sim/electrolysis";
import { runningState, sideForce, stallCurrent, toRpm } from "@/lib/sim/motor";
import { osmosisState, respiration } from "@/lib/sim/cell";
import { phenolphthaleinColor } from "@/lib/sim/phenolphthalein";
import { solvePulley } from "@/lib/sim/pulley";
import { safeCompile } from "@/lib/expr";
import type { LabSpec, ParamSpec, ParamValues, PartSpec, Readout, Subject, TemplateId } from "./types";

export interface ActionSpec {
  id: string;
  label: string;
}

/** A small goal that gives students a reason to experiment. Checked live against the sliders. */
export interface Mission {
  id: string;
  goal: string;
  hint: string;
  done: (v: ParamValues) => boolean;
}

export interface TemplateDef {
  id: Exclude<TemplateId, "generic">;
  subject: Subject;
  title: string;
  concept: string;
  blurb: string;
  tint: "tint-sky" | "tint-ochre" | "tint-blush";
  intro: string;
  params: ParamSpec[];
  actions: ActionSpec[];
  parts: PartSpec[];
  equations: string[];
  /** Words that suggest an image or question is about this template. */
  keywords: string[];
  describe: (v: ParamValues) => Readout;
  /** Which class this usually appears in, and roughly how long the lab takes. */
  level: string;
  minutes: number;
  missions: Mission[];
}

const f = (n: number, d = 2) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(d));

export const TEMPLATES: Record<TemplateDef["id"], TemplateDef> = {
  "pulley-incline": {
    id: "pulley-incline",
    subject: "physics",
    title: "Pulley on an incline",
    concept: "Newton's second law · tension · friction",
    blurb: "Two blocks joined by a string over a pulley. Change the masses, angle and friction to see who wins.",
    tint: "tint-sky",
    intro: "This is a block on an inclined plane, tied over a pulley to a hanging mass. Change the masses, the angle and the friction, and watch which way the system moves.",
    params: [
      { id: "M", label: "Block M on slope", unit: "kg", min: 0.5, max: 8, step: 0.1, value: 2 },
      { id: "m", label: "Hanging mass m", unit: "kg", min: 0.5, max: 8, step: 0.1, value: 3 },
      { id: "theta", label: "Incline angle θ", unit: "°", min: 5, max: 60, step: 1, value: 30 },
      { id: "mu", label: "Friction μ", min: 0, max: 0.8, step: 0.01, value: 0.1 },
    ],
    actions: [{ id: "restart", label: "Restart" }],
    parts: [
      { id: "incline", name: "Inclined plane", short: "A slope at angle θ", narration: "This is the inclined plane, tilted at angle theta. Only part of block M's weight, M g sine theta, pulls it down the slope. The rest presses into the surface and creates friction." },
      { id: "blockM", name: "Block M", short: "Rests on the slope", narration: "Block M sits on the slope. Gravity tries to slide it down, while the string tension pulls it up toward the pulley." },
      { id: "rope", name: "String", short: "Same tension T everywhere", narration: "The light string carries the same tension T on both sides, so both blocks always move together with the same acceleration." },
      { id: "pulley", name: "Pulley", short: "Changes the force's direction", narration: "The pulley simply turns the direction of the string. Watch it spin as the blocks move: its rotation tells you which way the system is accelerating." },
      { id: "blockm", name: "Hanging mass m", short: "Pulled straight down by m g", narration: "The hanging mass m is pulled straight down by its full weight, m g. If m g beats M g sine theta plus friction, m falls and M climbs the slope." },
    ],
    equations: ["a = g(m − M sinθ − μM cosθ) / (M + m)", "T = m(g − a)"],
    level: "Class 9–11 · Forces",
    minutes: 5,
    missions: [
      { id: "still", goal: "Make everything stay perfectly still", hint: "Raise the friction, or balance m·g against M·g·sin θ.", done: (v) => solvePulley({ M: v.M ?? 2, m: v.m ?? 3, thetaDeg: v.theta ?? 30, mu: v.mu ?? 0 }).motion === "at-rest" },
      { id: "down", goal: "Make block M slide down the slope", hint: "Make the slope steeper or the hanging mass lighter.", done: (v) => solvePulley({ M: v.M ?? 2, m: v.m ?? 3, thetaDeg: v.theta ?? 30, mu: v.mu ?? 0 }).motion === "M-slides-down" },
      { id: "fast", goal: "Get the acceleration above 4 m/s²", hint: "A heavy hanging mass and a smooth, gentle slope help.", done: (v) => solvePulley({ M: v.M ?? 2, m: v.m ?? 3, thetaDeg: v.theta ?? 30, mu: v.mu ?? 0 }).acceleration > 4 },
    ],
    keywords: ["pulley", "incline", "inclined", "slope", "block", "tension", "string", "rope", "friction", "newton", "atwood", "mass"],
    describe: (v) => {
      const r = solvePulley({ M: v.M ?? 2, m: v.m ?? 3, thetaDeg: v.theta ?? 30, mu: v.mu ?? 0 });
      const headline =
        r.motion === "at-rest"
          ? "Friction holds everything still."
          : r.motion === "m-falls"
            ? "m falls and pulls M up the slope."
            : "M slides down the slope and lifts m.";
      return {
        headline,
        stats: [
          { label: "Acceleration", value: `${f(Math.abs(r.acceleration))} m/s²` },
          { label: "Tension T", value: `${f(r.tension, 1)} N` },
          { label: "Net pull", value: `${f(r.drivingForce, 1)} N` },
          { label: "Max friction", value: `${f(r.maxFriction, 1)} N` },
        ],
      };
    },
  },

  "dc-motor": {
    id: "dc-motor",
    subject: "physics",
    title: "DC electric motor",
    concept: "Force on a current · torque · back-EMF",
    blurb: "A current-carrying coil spins between two magnets. Watch the current drop as the motor speeds up and its back-EMF fights the battery.",
    tint: "tint-sky",
    intro: "This is a simple DC motor. A battery drives current through a coil sitting between two magnets. The field pushes one side of the coil up and the other side down, so the coil turns. As it spins, it also acts as a generator, making a back voltage that fights the battery.",
    params: [
      { id: "voltage", label: "Battery voltage", unit: "V", min: 0, max: 12, step: 0.1, value: 6 },
      { id: "field", label: "Magnetic field B", unit: "T", min: 0, max: 1, step: 0.01, value: 0.5 },
      { id: "turns", label: "Turns in coil N", min: 1, max: 50, step: 1, value: 20 },
    ],
    actions: [{ id: "reverse", label: "Reverse the battery" }],
    parts: [
      { id: "magnets", name: "Magnets (N and S)", short: "Make a steady field B", narration: "The north and south poles face each other and create a steady magnetic field running across the gap, from north to south." },
      { id: "coil", name: "Coil (armature)", short: "Carries the current", narration: "The coil is a loop of wire wound many times. Current flows along one side and back along the other, so the two sides feel forces in opposite directions." },
      { id: "forces", name: "Forces on the coil", short: "F = B I L on each side", narration: "Fleming's left hand rule gives the force on each side: one side is pushed up, the other down. Together they make a turning effect, the torque." },
      { id: "commutator", name: "Split-ring commutator", short: "Flips current every half turn", narration: "The split ring commutator reverses the current in the coil every half turn. That keeps the torque pointing the same way, so the coil keeps spinning instead of rocking back." },
      { id: "brushes", name: "Carbon brushes", short: "Slide on the commutator", narration: "The carbon brushes press on the spinning commutator and carry current from the battery into the coil without tangling the wires." },
      { id: "battery", name: "Battery", short: "Drives the current", narration: "The battery pushes current around the circuit. At start-up the only thing limiting the current is the coil's resistance, so it is large. Once the coil spins, its back-EMF cancels part of the battery voltage and the current falls." },
    ],
    equations: ["F = N·B·I·L (each side)", "e = k·ω (back-EMF), k = N·B·A", "I = (V − e) / R", "ω_steady = (2/π)·kV/R ÷ (b + k²/2R)"],
    level: "Class 10–12 · Magnetism",
    minutes: 6,
    missions: [
      { id: "fast", goal: "Spin the motor faster than 600 rpm", hint: "More voltage helps. Try a weaker field too: it lowers the back-EMF.", done: (v) => toRpm(runningState({ voltage: v.voltage ?? 6, field: v.field ?? 0.5, turns: v.turns ?? 20 }).omega) > 600 },
      { id: "lowcurrent", goal: "Keep the running current under 1 A", hint: "A stronger field or more turns makes more back-EMF, which cuts the current.", done: (v) => (v.voltage ?? 6) > 0 && (v.field ?? 0.5) > 0 && runningState({ voltage: v.voltage ?? 6, field: v.field ?? 0.5, turns: v.turns ?? 20 }).current < 1 },
      { id: "reverse", goal: "Make the coil spin the other way", hint: "Press “Reverse the battery”.", done: (v) => (v.reverse ?? 0) % 2 === 1 },
    ],
    keywords: ["motor", "dc", "coil", "armature", "commutator", "brush", "magnet", "magnetic", "fleming", "torque", "electromagnet", "emf"],
    describe: (v) => {
      const p = { voltage: v.voltage ?? 6, field: v.field ?? 0.5, turns: v.turns ?? 20 };
      const run = runningState(p);
      const moving = p.voltage > 0 && p.field > 0;
      return {
        headline: !moving ? "No voltage or no field: no force, so the coil stays still." : `Spins up to about ${f(toRpm(run.omega), 0)} rpm, where back-EMF and friction balance the battery.`,
        stats: [
          { label: "Start-up current", value: `${f(stallCurrent(p))} A` },
          { label: "Running current", value: moving ? `${f(run.current)} A` : "0 A" },
          { label: "Back-EMF", value: moving ? `${f(run.backEmf)} V` : "0 V" },
          { label: "Steady speed", value: moving ? `${f(toRpm(run.omega), 0)} rpm` : "0 rpm" },
          { label: "Force per side", value: `${f(sideForce(p))} N` },
          { label: "Direction", value: (v.reverse ?? 0) % 2 ? "Clockwise" : "Anticlockwise" },
        ],
      };
    },
  },

  neuron: {
    id: "neuron",
    subject: "biology",
    title: "Neuron & nerve impulse",
    concept: "Action potential · myelin · synapse",
    blurb: "Send a signal down a nerve cell. Toggle myelin to see why insulated axons fire so much faster.",
    tint: "tint-ochre",
    intro: "This is a neuron, a nerve cell. Signals come in through the dendrites, and if they are strong enough, an electrical impulse races down the axon to the next cell.",
    params: [
      { id: "stimulus", label: "Stimulus", unit: "mV", min: 0, max: 30, step: 1, value: 20 },
      { id: "myelin", label: "Myelin sheath", min: 0, max: 1, step: 1, value: 1, kind: "toggle" },
      { id: "diameter", label: "Axon diameter", unit: "µm", min: 1, max: 20, step: 1, value: 10 },
    ],
    actions: [{ id: "stimulate", label: "Stimulate" }],
    parts: [
      { id: "dendrite", name: "Dendrites", short: "Receive incoming signals", narration: "Dendrites are the branching antennae of the neuron. They collect chemical signals from other cells and pass them to the cell body." },
      { id: "soma", name: "Soma (cell body)", short: "Holds the nucleus", narration: "The soma, or cell body, contains the nucleus. It adds up all the incoming signals to decide whether the neuron should fire." },
      { id: "hillock", name: "Axon hillock", short: "The trigger zone", narration: "The axon hillock is the trigger zone. If the membrane here reaches minus fifty five millivolts, an all-or-none action potential begins." },
      { id: "axon", name: "Axon", short: "Carries the impulse", narration: "The axon is a long cable that carries the electrical impulse away from the cell body toward the terminals." },
      { id: "myelin", name: "Myelin sheath", short: "Insulation for speed", narration: "Myelin wraps the axon like insulation. The impulse jumps from gap to gap, called saltatory conduction, which makes it many times faster." },
      { id: "terminal", name: "Axon terminals", short: "Release neurotransmitters", narration: "At the axon terminals, the arriving impulse makes tiny vesicles release neurotransmitter molecules." },
      { id: "synapse", name: "Synapse", short: "The gap between cells", narration: "The synapse is the tiny gap between two cells. Neurotransmitters cross it and bind to receptors on the next cell, passing the message on." },
    ],
    equations: ["Fires if −70 mV + stimulus ≥ −55 mV", "v ≈ 6 m/s per µm (myelinated)", "v ≈ √d m/s (unmyelinated)"],
    level: "Class 10–12 · Control & coordination",
    minutes: 5,
    missions: [
      { id: "threshold", goal: "Find the weakest stimulus that still fires", hint: "The membrane must reach −55 mV from −70 mV.", done: (v) => (v.stimulus ?? 20) === 15 },
      { id: "speed", goal: "Send the signal faster than 100 m/s", hint: "Myelin and a thicker axon both speed it up.", done: (v) => conductionVelocity((v.myelin ?? 1) >= 0.5, v.diameter ?? 10) > 100 },
      { id: "slow", goal: "Make the signal crawl below 3 m/s", hint: "Take away the myelin sheath.", done: (v) => conductionVelocity((v.myelin ?? 1) >= 0.5, v.diameter ?? 10) < 3 },
    ],
    keywords: ["neuron", "nerve", "axon", "dendrite", "synapse", "myelin", "impulse", "soma", "brain", "action potential", "nervous"],
    describe: (v) => {
      const stim = v.stimulus ?? 20;
      const fires = firesActionPotential(stim);
      const vel = conductionVelocity((v.myelin ?? 1) >= 0.5, v.diameter ?? 10);
      return {
        headline: fires ? "Above threshold: the neuron fires an action potential." : "Below threshold: the membrane flickers but nothing fires.",
        stats: [
          { label: "Membrane reaches", value: `${RESTING_MV + stim} mV` },
          { label: "Threshold", value: `${THRESHOLD_MV} mV` },
          { label: "Conduction speed", value: `${f(vel, 1)} m/s` },
          { label: "Fires?", value: fires ? "Yes" : "No" },
        ],
      };
    },
  },

  "animal-cell": {
    id: "animal-cell",
    subject: "biology",
    title: "Animal cell",
    concept: "Organelles · osmosis · respiration",
    blurb: "Slice open an animal cell and explore its organelles. Put it in salty or pure water to see osmosis, and raise the energy demand to make the mitochondria work.",
    tint: "tint-ochre",
    intro: "This is an animal cell, cut open so you can see inside. Each organelle is a tiny machine with its own job. Tap any part to learn what it does.",
    params: [
      { id: "cutaway", label: "Cut-away", unit: "%", min: 0, max: 100, step: 1, value: 60 },
      { id: "energy", label: "Energy demand", unit: "%", min: 0, max: 100, step: 1, value: 40 },
      { id: "secretion", label: "Protein export", unit: "%", min: 0, max: 100, step: 1, value: 50 },
      { id: "outside", label: "Outside solution", unit: "mOsm/L", min: 100, max: 600, step: 10, value: 300 },
    ],
    actions: [],
    parts: [
      { id: "membrane", name: "Cell membrane", short: "Controls what enters and leaves", narration: "The cell membrane is a thin, flexible layer of lipids and proteins. It controls what enters and leaves the cell. Water crosses it by osmosis, so in pure water an animal cell swells and can burst, and in salty water it shrivels." },
      { id: "cytoplasm", name: "Cytoplasm", short: "Jelly where reactions happen", narration: "The cytoplasm is the jelly-like fluid that fills the cell. Many chemical reactions happen here, and the organelles float in it." },
      { id: "nucleus", name: "Nucleus", short: "Holds the DNA", narration: "The nucleus holds the cell's DNA, the instructions for making every protein. Its double membrane has pores that let messages out." },
      { id: "nucleolus", name: "Nucleolus", short: "Builds ribosomes", narration: "The nucleolus, inside the nucleus, is where ribosome parts are made." },
      { id: "mitochondria", name: "Mitochondria", short: "Release energy as ATP", narration: "Mitochondria are the sites of aerobic respiration. They break down glucose with oxygen and store the released energy as ATP. The more energy the cell needs, the harder they work." },
      { id: "er", name: "Rough endoplasmic reticulum", short: "Makes and carries proteins", narration: "The rough endoplasmic reticulum is a folded membrane studded with ribosomes. Proteins are built here and carried through its channels." },
      { id: "ribosomes", name: "Ribosomes", short: "Build proteins", narration: "Ribosomes are tiny protein factories. They read messenger RNA and join amino acids into proteins." },
      { id: "golgi", name: "Golgi apparatus", short: "Packages and ships proteins", narration: "The Golgi apparatus modifies and packages proteins into vesicles, then ships them to where they are needed, including out of the cell." },
      { id: "lysosome", name: "Lysosomes", short: "Digest waste", narration: "Lysosomes contain digestive enzymes. They break down worn-out parts and anything harmful the cell takes in." },
      { id: "centrosome", name: "Centrosome", short: "Organises cell division", narration: "The centrosome, with its pair of centrioles, organises the spindle fibres that pull chromosomes apart when the cell divides." },
    ],
    equations: ["Respiration: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ~30 ATP", "Osmosis: V/V₀ = b + (1 − b)·(c_in / c_out)"],
    level: "Class 8–11 · The cell",
    minutes: 5,
    missions: [
      { id: "burst", goal: "Make the cell burst", hint: "Put it in very dilute water: water rushes in by osmosis.", done: (v) => osmosisState(v.outside ?? 300).lysed },
      { id: "shrink", goal: "Shrink the cell below 90% of its size", hint: "Make the outside solution saltier than the cytoplasm.", done: (v) => osmosisState(v.outside ?? 300).ratio < 0.9 },
      { id: "atp", goal: "Make more than 60 million ATP a second", hint: "Raise the energy demand so the mitochondria work harder.", done: (v) => respiration(v.energy ?? 40).atpPerSec > 60e6 },
    ],
    keywords: ["cell", "osmosis", "tonicity", "nucleus", "mitochondria", "mitochondrion", "golgi", "ribosome", "organelle", "cytoplasm", "membrane", "lysosome", "reticulum", "animal cell"],
    describe: (v) => {
      const r = respiration(v.energy ?? 40);
      const o = osmosisState(v.outside ?? 300);
      const sci = (n: number) => `${(n / 1e6).toFixed(1)} million`;
      return {
        headline: o.lysed
          ? "The outside water is too dilute: water rushes in and the cell bursts."
          : o.tonicity !== "isotonic"
            ? `${o.tonicity === "hypotonic" ? "Hypotonic" : "Hypertonic"} solution: water moves ${o.water}, so the cell ${o.fate}.`
            : (v.energy ?? 40) > 70
              ? "High energy demand: mitochondria are respiring flat out."
              : "A healthy cell in an isotonic solution.",
        stats: [
          { label: "Cell volume", value: `${Math.round(o.ratio * 100)}% of normal` },
          { label: "Solution", value: o.tonicity },
          { label: "ATP made", value: `${sci(r.atpPerSec)} /s` },
          { label: "Glucose used", value: `${sci(r.glucosePerSec)} /s` },
        ],
      };
    },
  },

  phenolphthalein: {
    id: "phenolphthalein",
    subject: "chemistry",
    title: "Phenolphthalein indicator",
    concept: "Acids, bases & pH indicators",
    blurb: "Drip the indicator into solutions from pH 0 to 14 and watch the colour flip as the molecule changes shape.",
    tint: "tint-blush",
    intro: "This is a beaker with a few drops of phenolphthalein indicator. Slide the pH and watch how the colour of the solution changes.",
    params: [{ id: "pH", label: "Solution pH", min: 0, max: 14, step: 0.1, value: 9 }],
    actions: [{ id: "drop", label: "Add a drop" }],
    parts: [
      { id: "dropper", name: "Dropper", short: "Adds the indicator", narration: "The dropper adds a few drops of phenolphthalein. Only a tiny amount is needed because the colour change is very intense." },
      { id: "molecule", name: "Phenolphthalein molecule", short: "Changes shape with pH", narration: "This is the phenolphthalein molecule. In acid its rings are locked apart. In base it opens up and becomes charged, which lets it absorb green light and look pink." },
      { id: "beaker", name: "Beaker", short: "Holds the test solution", narration: "The beaker holds the solution we are testing. Its pH decides which form of the indicator wins." },
      { id: "solution", name: "Solution", short: "Its colour reveals the pH", narration: "Watch the solution: orange in very strong acid, colourless from about four to seven, pink from eight to ten, and colourless again in very strong base." },
    ],
    equations: ["HIn (colourless) ⇌ In²⁻ (pink) + 2H⁺", "Turns pink from about pH 8.2"],
    level: "Class 7–10 · Acids & bases",
    minutes: 3,
    missions: [
      { id: "pink", goal: "Turn the solution pink", hint: "Phenolphthalein turns pink in bases.", done: (v) => phenolphthaleinColor(v.pH ?? 9).label === "Pink" },
      { id: "clear", goal: "Make it colourless in a basic solution", hint: "Very strong bases fade it again.", done: (v) => (v.pH ?? 9) > 7 && phenolphthaleinColor(v.pH ?? 9).label === "Colorless" },
      { id: "orange", goal: "Find where it turns orange", hint: "Try very strong acid.", done: (v) => phenolphthaleinColor(v.pH ?? 9).label === "Orange" },
    ],
    keywords: ["phenolphthalein", "indicator", "ph", "acid", "base", "alkali", "beaker", "titration", "litmus", "dropper"],
    describe: (v) => {
      const s = phenolphthaleinColor(v.pH ?? 9);
      return {
        headline: `${s.label} (${s.range})`,
        stats: [
          { label: "pH", value: f(v.pH ?? 9, 1) },
          { label: "Colour", value: s.label },
          { label: "Solution is", value: (v.pH ?? 9) < 7 ? "Acidic" : (v.pH ?? 9) > 7 ? "Basic" : "Neutral" },
          { label: "Why", value: s.note },
        ],
      };
    },
  },

  electrolysis: {
    id: "electrolysis",
    subject: "chemistry",
    title: "Electrolysis of water",
    concept: "Redox at electrodes · Faraday's law",
    blurb: "Pass a current through water and collect hydrogen and oxygen. See why you always get twice as much hydrogen.",
    tint: "tint-blush",
    intro: "This is the electrolysis of water. A current splits water into hydrogen at the negative electrode and oxygen at the positive electrode, collected in the two tubes.",
    params: [
      { id: "voltage", label: "Battery voltage", unit: "V", min: 0, max: 12, step: 0.1, value: 6 },
      { id: "conc", label: "Electrolyte (dilute acid)", unit: "mol/L", min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
    actions: [{ id: "reset", label: "Empty the tubes" }],
    parts: [
      { id: "battery", name: "Battery (power supply)", short: "Pushes electrons around", narration: "The battery pushes electrons into the negative electrode and pulls them out of the positive one. Below about one point eight volts, nothing happens." },
      { id: "cathode", name: "Cathode (−)", short: "Hydrogen forms here", narration: "At the cathode, the negative electrode, water gains electrons and hydrogen gas bubbles off. This is reduction." },
      { id: "anode", name: "Anode (+)", short: "Oxygen forms here", narration: "At the anode, the positive electrode, water loses electrons and oxygen gas bubbles off. This is oxidation." },
      { id: "electrolyte", name: "Electrolyte", short: "Ions carry the current", narration: "Pure water barely conducts. A little dilute acid adds ions that carry the current through the liquid, so electrolysis can run quickly." },
      { id: "h2tube", name: "Hydrogen tube", short: "Collects H₂", narration: "This tube collects hydrogen. It fills twice as fast as the oxygen tube, because each water molecule has two hydrogen atoms for every oxygen atom." },
      { id: "o2tube", name: "Oxygen tube", short: "Collects O₂", narration: "This tube collects oxygen. Its volume is always about half the hydrogen volume." },
    ],
    equations: ["Cathode: 2H₂O + 2e⁻ → H₂ + 2OH⁻", "Anode: 2H₂O → O₂ + 4H⁺ + 4e⁻", "V(H₂) : V(O₂) = 2 : 1"],
    level: "Class 10–12 · Electrochemistry",
    minutes: 5,
    missions: [
      { id: "lowest", goal: "Find the lowest voltage that still makes gas", hint: "Below about 1.8 V nothing happens. Creep up from there.", done: (v) => cellCurrent(v.voltage ?? 6, v.conc ?? 0.5) > 0 && (v.voltage ?? 6) <= 2.2 },
      { id: "pure", goal: "Stop the gas without touching the voltage", hint: "Pure water has almost no ions to carry the current.", done: (v) => (v.voltage ?? 6) > 3 && cellCurrent(v.voltage ?? 6, v.conc ?? 0.5) < 0.05 },
      { id: "fast", goal: "Collect over 20 mL of hydrogen a minute", hint: "More voltage and more electrolyte both raise the current.", done: (v) => gasVolumes(cellCurrent(v.voltage ?? 6, v.conc ?? 0.5), 60).h2mL > 20 },
    ],
    keywords: ["electrolysis", "electrode", "cathode", "anode", "hydrogen", "oxygen", "electrolyte", "water", "voltameter", "hoffman", "faraday"],
    describe: (v) => {
      const I = cellCurrent(v.voltage ?? 6, v.conc ?? 0.5);
      const perMin = gasVolumes(I, 60);
      return {
        headline: I < 0.001 ? "Too little voltage or too few ions: no gas forms." : `Hydrogen collects twice as fast as oxygen.`,
        stats: [
          { label: "Current", value: `${f(I)} A` },
          { label: "H₂ per minute", value: `${f(perMin.h2mL, 1)} mL` },
          { label: "O₂ per minute", value: `${f(perMin.o2mL, 1)} mL` },
          { label: "Ratio H₂ : O₂", value: "2 : 1" },
        ],
      };
    },
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function templatesBySubject(subject: Subject) {
  return TEMPLATE_LIST.filter((t) => t.subject === subject);
}

/** A ready-to-run lab spec for a built-in template. */
export function specFromTemplate(id: TemplateDef["id"], source: LabSpec["source"] = "sample"): LabSpec {
  const t = TEMPLATES[id];
  return {
    template: t.id,
    subject: t.subject,
    title: t.title,
    concept: t.concept,
    summary: t.blurb,
    intro: t.intro,
    params: t.params.map((p) => ({ ...p })),
    parts: t.parts.map((p) => ({ ...p })),
    equations: [...t.equations],
    source,
  };
}

export function defaultValues(spec: LabSpec): ParamValues {
  return Object.fromEntries(spec.params.map((p) => [p.id, p.value]));
}

export function actionsFor(spec: LabSpec): ActionSpec[] {
  return spec.template === "generic" ? [] : TEMPLATES[spec.template].actions;
}

/** Live readout for any lab, including AI-generated generic ones. */
export function describeLab(spec: LabSpec, values: ParamValues): Readout {
  if (spec.template !== "generic") return TEMPLATES[spec.template].describe(values);
  const stats = (spec.readouts ?? []).map((r) => {
    const n = safeCompile(r.formula)({ ...values, t: 0 });
    return { label: r.label, value: `${f(n)}${r.unit ? ` ${r.unit}` : ""}` };
  });
  return { headline: spec.summary || spec.concept, stats };
}

/** Score how well some text (file name, AI label, question) matches each template. */
export function guessTemplate(text: string): { id: TemplateDef["id"]; score: number } | null {
  // Whole words only, so "photo" doesn't match "ph" and "cellphone" doesn't match "cell".
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const has = (k: string) => words.includes(` ${k} `) || words.includes(` ${k}s `);
  let best: { id: TemplateDef["id"]; score: number } | null = null;
  for (const t of TEMPLATE_LIST) {
    const score = t.keywords.reduce((s, k) => (has(k) ? s + (k.length > 5 ? 2 : 1) : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { id: t.id, score };
  }
  return best;
}
