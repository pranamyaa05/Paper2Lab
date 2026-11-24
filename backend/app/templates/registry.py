import math
from typing import Dict, Any, List, Optional
from app.schemas.diagram import (
    SimulationSpec,
    Discipline,
    SimVariable,
    TelemetryMetric,
    InteractiveControl,
    ControlWidgetType,
    ThreeJsEntity,
    TelemetryComputeResponse,
)


def get_dc_motor_template() -> SimulationSpec:
    return SimulationSpec(
        template_id="dc_motor_3d",
        title="Direct Current (DC) Electric Motor Laboratory",
        summary="Interactive 3D electro-mechanical simulation of a commutator DC motor demonstrating Lorentz force, magnetic torque, and back-EMF.",
        discipline=Discipline.PHYSICS,
        variables=[
            SimVariable(
                key="voltage",
                label="Armature Voltage",
                symbol="V",
                unit="V",
                min_value=0.0,
                max_value=24.0,
                step=0.5,
                default_value=12.0,
                current_value=12.0,
                description="DC voltage supplied across the carbon brushes."
            ),
            SimVariable(
                key="magnetic_field",
                label="Magnetic Field Strength",
                symbol="B",
                unit="T",
                min_value=0.1,
                max_value=2.0,
                step=0.05,
                default_value=0.5,
                current_value=0.5,
                description="Flux density between the permanent stator poles."
            ),
            SimVariable(
                key="coil_turns",
                label="Armature Coil Turns",
                symbol="N",
                unit="turns",
                min_value=10.0,
                max_value=200.0,
                step=10.0,
                default_value=50.0,
                current_value=50.0,
                description="Number of wire loops in the rotating armature coil."
            ),
            SimVariable(
                key="load_torque",
                label="Mechanical Load Torque",
                symbol="τ_load",
                unit="N·m",
                min_value=0.0,
                max_value=0.5,
                step=0.02,
                default_value=0.05,
                current_value=0.05,
                description="Resistive torque applied by an external mechanical load."
            ),
            SimVariable(
                key="armature_resistance",
                label="Armature Resistance",
                symbol="R",
                unit="Ω",
                min_value=0.5,
                max_value=5.0,
                step=0.1,
                default_value=1.2,
                current_value=1.2,
                description="Internal electrical resistance of the copper winding."
            )
        ],
        telemetry=[
            TelemetryMetric(key="current_amp", label="Armature Current", unit="A", formula_hint="I = (V - E_b) / R"),
            TelemetryMetric(key="torque_nm", label="Electromagnetic Torque", unit="N·m", formula_hint="τ = k_t * B * I"),
            TelemetryMetric(key="rpm", label="Rotational Speed", unit="RPM", formula_hint="ω = 2π * RPM / 60"),
            TelemetryMetric(key="back_emf", label="Back-EMF (Counter EMF)", unit="V", formula_hint="E_b = k_e * B * ω"),
            TelemetryMetric(key="mechanical_power", label="Mechanical Power Output", unit="W", formula_hint="P = τ * ω"),
            TelemetryMetric(key="efficiency", label="Electrical-to-Mechanical Efficiency", unit="%", formula_hint="η = (P_out / P_in) * 100")
        ],
        controls=[
            InteractiveControl(control_id="c_v", variable_key="voltage", widget_type=ControlWidgetType.SLIDER, label="Voltage (V)"),
            InteractiveControl(control_id="c_b", variable_key="magnetic_field", widget_type=ControlWidgetType.SLIDER, label="Magnetic Field (T)"),
            InteractiveControl(control_id="c_n", variable_key="coil_turns", widget_type=ControlWidgetType.SLIDER, label="Coil Turns (N)"),
            InteractiveControl(control_id="c_load", variable_key="load_torque", widget_type=ControlWidgetType.SLIDER, label="Mechanical Load (N·m)"),
            InteractiveControl(control_id="c_r", variable_key="armature_resistance", widget_type=ControlWidgetType.SLIDER, label="Winding Resistance (Ω)")
        ],
        entities_3d=[
            ThreeJsEntity(id="magnet_north", component_id="north_pole", geometry="box", position=[-2.5, 0.0, 0.0], scale=[1.0, 2.0, 3.0], color="#dc2626", material="metal"),
            ThreeJsEntity(id="magnet_south", component_id="south_pole", geometry="box", position=[2.5, 0.0, 0.0], scale=[1.0, 2.0, 3.0], color="#2563eb", material="metal"),
            ThreeJsEntity(id="armature_coil", component_id="rotor_coil", geometry="torus_rectangular", position=[0.0, 0.0, 0.0], scale=[1.6, 2.2, 0.1], color="#d97706", material="copper", animation_behavior="rotate_z_proportional_to_rpm"),
            ThreeJsEntity(id="commutator_split_ring", component_id="commutator", geometry="cylinder_split", position=[0.0, 0.0, 1.8], scale=[0.5, 0.5, 0.4], color="#eab308", material="brass", animation_behavior="rotate_z_proportional_to_rpm"),
            ThreeJsEntity(id="carbon_brush_pos", component_id="brush_pos", geometry="box", position=[-0.6, 0.0, 1.8], scale=[0.2, 0.2, 0.3], color="#374151", material="matte"),
            ThreeJsEntity(id="carbon_brush_neg", component_id="brush_neg", geometry="box", position=[0.6, 0.0, 1.8], scale=[0.2, 0.2, 0.3], color="#374151", material="matte"),
            ThreeJsEntity(id="shaft", component_id="central_shaft", geometry="cylinder", position=[0.0, 0.0, 0.0], rotation=[1.5708, 0.0, 0.0], scale=[0.15, 4.2, 0.15], color="#9ca3af", material="chrome", animation_behavior="rotate_z_proportional_to_rpm")
        ]
    )


def compute_dc_motor_telemetry(variables: Dict[str, float]) -> TelemetryComputeResponse:
    V = max(0.0, variables.get("voltage", 12.0))
    B = max(0.05, variables.get("magnetic_field", 0.5))
    N = max(1.0, variables.get("coil_turns", 50.0))
    tau_load = max(0.0, variables.get("load_torque", 0.05))
    R = max(0.1, variables.get("armature_resistance", 1.2))
    
    # Motor constants based on physical dimensions (Coil area ~ 0.005 m^2)
    k_motor = 0.005 * N * 2.0  # geometric constant
    k_t = k_motor * B          # Torque constant (N·m/A)
    k_e = k_t                  # Back-EMF constant (V·s/rad) in SI units
    friction_viscous = 0.0003  # N·m·s/rad
    friction_coulomb = 0.01    # N·m
    
    # Equilibrium equation: tau_motor = tau_load + friction_coulomb + friction_viscous * omega
    # tau_motor = k_t * I = k_t * (V - k_e * omega) / R
    # (k_t * V / R) - (k_t * k_e / R) * omega = tau_load + friction_coulomb + friction_viscous * omega
    # omega * ( (k_t * k_e / R) + friction_viscous ) = (k_t * V / R) - (tau_load + friction_coulomb)
    
    stall_torque = (k_t * V) / R
    load_demand = tau_load + friction_coulomb
    
    warnings = []
    if stall_torque <= load_demand:
        # Motor is stalled
        omega = 0.0
        rpm = 0.0
        back_emf = 0.0
        I = V / R
        torque = stall_torque
        warnings.append("Motor is STALLED: Load torque exceeds electromagnetic starting torque.")
    else:
        denom = (k_t * k_e / R) + friction_viscous
        omega = (stall_torque - load_demand) / denom
        rpm = (omega * 60.0) / (2.0 * math.pi)
        back_emf = k_e * omega
        I = (V - back_emf) / R
        torque = k_t * I

    mech_power = max(0.0, (torque - friction_coulomb) * omega)
    elec_power = V * I
    efficiency = (mech_power / elec_power * 100.0) if elec_power > 0.001 else 0.0
    
    state_desc = f"Motor spinning at {rpm:.1f} RPM with back-EMF of {back_emf:.2f} V. Armature draws {I:.2f} A delivering {torque:.3f} N·m torque."
    
    return TelemetryComputeResponse(
        telemetry_values={
            "current_amp": round(I, 3),
            "torque_nm": round(torque, 4),
            "rpm": round(rpm, 1),
            "back_emf": round(back_emf, 2),
            "mechanical_power": round(mech_power, 2),
            "efficiency": round(efficiency, 1)
        },
        state_description=state_desc,
        warnings=warnings
    )


def get_electrolysis_template() -> SimulationSpec:
    return SimulationSpec(
        template_id="electrolysis_cell_3d",
        title="Electrochemical Water Splitting (Electrolysis) Lab",
        summary="3D interactive Hofmann voltameter / electrolytic cell showing redox reactions, Faraday's electrolysis law, and stoichiometric 2:1 H2 to O2 gas generation.",
        discipline=Discipline.CHEMISTRY,
        variables=[
            SimVariable(
                key="cell_voltage",
                label="Applied Voltage",
                symbol="V",
                unit="V",
                min_value=0.0,
                max_value=12.0,
                step=0.2,
                default_value=6.0,
                current_value=6.0,
                description="DC voltage supplied across anode and cathode electrodes."
            ),
            SimVariable(
                key="electrolyte_concentration",
                label="Sulfuric Acid (H2SO4) Concentration",
                symbol="C",
                unit="M",
                min_value=0.01,
                max_value=2.0,
                step=0.05,
                default_value=0.5,
                current_value=0.5,
                description="Electrolyte concentration providing conductive hydronium (H3O+) and sulfate (SO4 2-) ions."
            ),
            SimVariable(
                key="temperature_c",
                label="Electrolyte Temperature",
                symbol="T",
                unit="°C",
                min_value=10.0,
                max_value=90.0,
                step=1.0,
                default_value=25.0,
                current_value=25.0,
                description="Operating solution temperature influencing ion mobility and reaction overpotential."
            ),
            SimVariable(
                key="electrode_surface_area",
                label="Electrode Surface Area",
                symbol="A",
                unit="cm²",
                min_value=1.0,
                max_value=20.0,
                step=0.5,
                default_value=5.0,
                current_value=5.0,
                description="Effective submerged surface area of Platinum electrodes."
            )
        ],
        telemetry=[
            TelemetryMetric(key="cell_current", label="Electrolysis Current", unit="A", formula_hint="I = (V - E_rev - η) / R_sol"),
            TelemetryMetric(key="h2_rate_ml_min", label="Hydrogen (H₂) Evolution Rate", unit="mL/min", formula_hint="Cathode: 2H⁺ + 2e⁻ → H₂"),
            TelemetryMetric(key="o2_rate_ml_min", label="Oxygen (O₂) Evolution Rate", unit="mL/min", formula_hint="Anode: 2H₂O → O₂ + 4H⁺ + 4e⁻"),
            TelemetryMetric(key="gas_volume_ratio", label="Volume Ratio (H₂ : O₂)", unit="ratio", formula_hint="Stoichiometric 2.0 : 1.0"),
            TelemetryMetric(key="faradaic_efficiency", label="Faradaic Efficiency", unit="%", formula_hint="η_F = (m_meas / m_theo) * 100")
        ],
        controls=[
            InteractiveControl(control_id="c_volt", variable_key="cell_voltage", widget_type=ControlWidgetType.SLIDER, label="Applied Voltage (V)"),
            InteractiveControl(control_id="c_conc", variable_key="electrolyte_concentration", widget_type=ControlWidgetType.SLIDER, label="Electrolyte Conc (M)"),
            InteractiveControl(control_id="c_temp", variable_key="temperature_c", widget_type=ControlWidgetType.SLIDER, label="Temperature (°C)"),
            InteractiveControl(control_id="c_area", variable_key="electrode_surface_area", widget_type=ControlWidgetType.SLIDER, label="Electrode Area (cm²)")
        ],
        entities_3d=[
            ThreeJsEntity(id="cell_container", component_id="beaker", geometry="cylinder_open", position=[0.0, -0.5, 0.0], scale=[2.2, 3.0, 2.2], color="#93c5fd", material="glass"),
            ThreeJsEntity(id="electrolyte_liquid", component_id="acid_solution", geometry="cylinder", position=[0.0, -0.8, 0.0], scale=[2.1, 2.4, 2.1], color="#38bdf8", material="transparent_liquid"),
            ThreeJsEntity(id="cathode_rod", component_id="cathode", geometry="cylinder", position=[-0.8, -0.4, 0.0], scale=[0.12, 2.2, 0.12], color="#475569", material="platinum", animation_behavior="emit_dense_bubbles_h2"),
            ThreeJsEntity(id="anode_rod", component_id="anode", geometry="cylinder", position=[0.8, -0.4, 0.0], scale=[0.12, 2.2, 0.12], color="#64748b", material="platinum", animation_behavior="emit_sparse_bubbles_o2"),
            ThreeJsEntity(id="h2_gas_column", component_id="cathode_gas_trap", geometry="cylinder", position=[-0.8, 1.2, 0.0], scale=[0.4, 1.8, 0.4], color="#e0f2fe", material="glass_h2"),
            ThreeJsEntity(id="o2_gas_column", component_id="anode_gas_trap", geometry="cylinder", position=[0.8, 1.2, 0.0], scale=[0.4, 1.8, 0.4], color="#fef08a", material="glass_o2")
        ]
    )


def compute_electrolysis_telemetry(variables: Dict[str, float]) -> TelemetryComputeResponse:
    V = variables.get("cell_voltage", 6.0)
    C = max(0.001, variables.get("electrolyte_concentration", 0.5))
    T = variables.get("temperature_c", 25.0)
    A = max(0.5, variables.get("electrode_surface_area", 5.0))
    
    # Thermodynamic reversible potential of water electrolysis = 1.23 V at 25C
    E_rev = 1.229 - 0.00085 * (T - 25.0)
    # Overpotentials (activation on Pt ~ 0.1V for H2, 0.3V for O2)
    overpotential = 0.35 + 0.05 * math.log10(max(1.0, A))
    threshold_v = E_rev + overpotential
    
    warnings = []
    if V <= threshold_v:
        warnings.append(f"Applied voltage ({V:.2f}V) is below reaction threshold ({threshold_v:.2f}V). No electrolysis occurs.")
        return TelemetryComputeResponse(
            telemetry_values={
                "cell_current": 0.0,
                "h2_rate_ml_min": 0.0,
                "o2_rate_ml_min": 0.0,
                "gas_volume_ratio": 2.0,
                "faradaic_efficiency": 0.0
            },
            state_description=f"Reaction inactive. Voltage must exceed {threshold_v:.2f} V to overcome thermodynamic and overpotential barriers.",
            warnings=warnings
        )
    
    # Specific conductivity of H2SO4 ~ proportional to C with temperature coefficient
    conductivity = (0.05 + 0.35 * C) * (1.0 + 0.02 * (T - 25.0))  # S/cm
    # Resistance of cell solution
    cell_gap_cm = 3.0
    R_sol = cell_gap_cm / (conductivity * A)
    
    current = (V - threshold_v) / R_sol
    
    # Faraday constant F = 96485 C/mol
    # Moles of H2 produced per second: n_H2 = I / (2 * F)
    # Moles of O2 produced per second: n_O2 = I / (4 * F)
    # Molar volume of gas at T (Kelvin): V_m = R_gas * (T + 273.15) / 101325 * 1e6 mL/mol
    T_K = T + 273.15
    V_m_mL = (8.314 * T_K / 101325.0) * 1e6  # ~ 24465 mL/mol at 25C
    
    mol_h2_per_sec = current / (2.0 * 96485.0)
    mol_o2_per_sec = current / (4.0 * 96485.0)
    
    h2_ml_min = mol_h2_per_sec * V_m_mL * 60.0
    o2_ml_min = mol_o2_per_sec * V_m_mL * 60.0
    
    state_desc = f"Active electrolysis at {current:.2f} A. Generating {h2_ml_min:.2f} mL/min of H₂ at cathode and {o2_ml_min:.2f} mL/min of O₂ at anode."
    
    return TelemetryComputeResponse(
        telemetry_values={
            "cell_current": round(current, 3),
            "h2_rate_ml_min": round(h2_ml_min, 2),
            "o2_rate_ml_min": round(o2_ml_min, 2),
            "gas_volume_ratio": 2.0,
            "faradaic_efficiency": 98.5
        },
        state_description=state_desc,
        warnings=warnings
    )


def get_animal_cell_template() -> SimulationSpec:
    return SimulationSpec(
        template_id="animal_cell_3d",
        title="Interactive 3D Eukaryotic Animal Cell Explorer",
        summary="Explorable 3D cellular biology lab featuring organelles, membrane transport, ATP synthesis in mitochondria, and cellular respiration kinetics.",
        discipline=Discipline.BIOLOGY,
        variables=[
            SimVariable(
                key="atp_demand",
                label="Cellular Energy Demand",
                symbol="Demand",
                unit="%",
                min_value=10.0,
                max_value=100.0,
                step=5.0,
                default_value=50.0,
                current_value=50.0,
                description="Metabolic workload of the cell (resting vs active muscle state)."
            ),
            SimVariable(
                key="extracellular_tonicity",
                label="Extracellular Tonicity (Osmolarity)",
                symbol="mOsm/L",
                unit="mOsm/L",
                min_value=150.0,
                max_value=450.0,
                step=10.0,
                default_value=300.0,
                current_value=300.0,
                description="Osmotic balance (Isotonic ~ 300 mOsm/L, Hypotonic < 300, Hypertonic > 300)."
            ),
            SimVariable(
                key="oxygen_availability",
                label="Dissolved Oxygen (pO₂)",
                symbol="pO₂",
                unit="mmHg",
                min_value=0.0,
                max_value=100.0,
                step=5.0,
                default_value=40.0,
                current_value=40.0,
                description="Oxygen partial pressure driving oxidative phosphorylation in the inner mitochondrial cristae."
            )
        ],
        telemetry=[
            TelemetryMetric(key="atp_production_rate", label="ATP Production Rate", unit="mmol/s", formula_hint="Oxidative phosphorylation + Glycolysis"),
            TelemetryMetric(key="cellular_volume_pct", label="Cellular Hydration / Volume", unit="%", formula_hint="Normal = 100% (Osmotic flux)"),
            TelemetryMetric(key="mitochondrial_activity", label="Mitochondrial Membrane Potential (ΔΨm)", unit="mV", formula_hint="Proton gradient driven"),
            TelemetryMetric(key="lactic_acid_flux", label="Anaerobic Lactate Production", unit="μmol/min", formula_hint="Triggered when pO2 < 15 mmHg")
        ],
        controls=[
            InteractiveControl(control_id="c_atp", variable_key="atp_demand", widget_type=ControlWidgetType.SLIDER, label="ATP Demand (%)"),
            InteractiveControl(control_id="c_tonic", variable_key="extracellular_tonicity", widget_type=ControlWidgetType.SLIDER, label="Extracellular Tonicity (mOsm/L)"),
            InteractiveControl(control_id="c_o2", variable_key="oxygen_availability", widget_type=ControlWidgetType.SLIDER, label="Oxygen Level pO₂ (mmHg)")
        ],
        entities_3d=[
            ThreeJsEntity(id="cell_membrane", component_id="plasma_membrane", geometry="sphere_semi_transparent", position=[0.0, 0.0, 0.0], scale=[3.5, 3.5, 3.5], color="#a7f3d0", material="translucent_membrane"),
            ThreeJsEntity(id="nucleus", component_id="nucleus_core", geometry="sphere", position=[0.0, 0.0, 0.0], scale=[1.4, 1.4, 1.4], color="#818cf8", material="nucleus_pores"),
            ThreeJsEntity(id="nucleolus", component_id="nucleolus", geometry="sphere", position=[0.2, 0.2, 0.1], scale=[0.5, 0.5, 0.5], color="#4338ca", material="matte"),
            ThreeJsEntity(id="mitochondria_1", component_id="mitochondria", geometry="capsule", position=[1.5, 1.0, 0.8], rotation=[0.5, 0.7, 0.0], scale=[0.6, 1.2, 0.6], color="#f97316", material="cristae_pattern"),
            ThreeJsEntity(id="mitochondria_2", component_id="mitochondria", geometry="capsule", position=[-1.6, -0.9, -0.5], rotation=[-0.3, 0.4, 0.9], scale=[0.6, 1.2, 0.6], color="#f97316", material="cristae_pattern"),
            ThreeJsEntity(id="golgi_apparatus", component_id="golgi", geometry="curved_discs", position=[-1.2, 1.3, -0.6], scale=[1.1, 0.8, 0.9], color="#fbbf24", material="folded_lamellae"),
            ThreeJsEntity(id="endoplasmic_reticulum", component_id="rough_er", geometry="folded_sheets", position=[0.8, -1.2, 0.5], scale=[1.5, 1.0, 1.2], color="#ec4899", material="rough_ribosomes")
        ]
    )


def compute_animal_cell_telemetry(variables: Dict[str, float]) -> TelemetryComputeResponse:
    demand = variables.get("atp_demand", 50.0)
    tonicity = variables.get("extracellular_tonicity", 300.0)
    o2 = variables.get("oxygen_availability", 40.0)
    
    # Normal osmolarity = 300 mOsm/L
    # If tonicity < 300 (hypotonic), water enters -> cell swells
    # If tonicity > 300 (hypertonic), water leaves -> cell crenates
    volume_pct = 100.0 * (300.0 / max(100.0, tonicity))
    volume_pct = max(60.0, min(145.0, volume_pct))
    
    warnings = []
    if volume_pct > 135.0:
        warnings.append("HYPOTONIC LYSIS WARNING: Severe osmotic water influx may rupture the fragile animal cell membrane!")
    elif volume_pct < 75.0:
        warnings.append("HYPERTONIC CRENATION: Excessive water efflux has shriveled the cytoplasm and organelles.")
    
    # ATP production
    aerobic_fraction = min(1.0, max(0.0, o2 / 30.0))
    base_atp = (demand / 100.0) * 120.0
    atp_rate = base_atp * (0.15 + 0.85 * aerobic_fraction)
    delta_psi_m = -140.0 - 40.0 * aerobic_fraction
    
    lactate = 0.0
    if o2 < 20.0:
        lactate = (20.0 - o2) * 4.5 * (demand / 50.0)
        warnings.append(f"HYPOXIA DETECTED: Low pO₂ ({o2:.0f} mmHg) triggers anaerobic glycolysis and lactic acid accumulation.")

    state_desc = f"Cell volume is {volume_pct:.1f}% in {'isotonic' if 285 <= tonicity <= 315 else 'hypotonic' if tonicity < 285 else 'hypertonic'} medium. Mitochondria producing {atp_rate:.1f} mmol/s ATP."
    
    return TelemetryComputeResponse(
        telemetry_values={
            "atp_production_rate": round(atp_rate, 1),
            "cellular_volume_pct": round(volume_pct, 1),
            "mitochondrial_activity": round(delta_psi_m, 1),
            "lactic_acid_flux": round(lactate, 1)
        },
        state_description=state_desc,
        warnings=warnings
    )


TEMPLATE_REGISTRY: Dict[str, SimulationSpec] = {
    "dc_motor_3d": get_dc_motor_template(),
    "electrolysis_cell_3d": get_electrolysis_template(),
    "animal_cell_3d": get_animal_cell_template(),
}


def find_matching_template(keywords: List[str], discipline: Optional[Discipline] = None) -> Optional[SimulationSpec]:
    k_lower = [k.lower() for k in keywords]
    joined = " ".join(k_lower)
    
    if any(term in joined for term in ["motor", "lorentz", "commutator", "rotor", "armature", "stator"]):
        return get_dc_motor_template()
    if any(term in joined for term in ["electrolysis", "water splitting", "hofmann", "electrode", "anode", "cathode", "h2", "o2"]):
        return get_electrolysis_template()
    if any(term in joined for term in ["cell", "mitochondria", "organelle", "nucleus", "membrane", "osmosis", "eukaryotic", "ribosome"]):
        return get_animal_cell_template()
    
    return None
