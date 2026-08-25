use delve_core::{
    calculate_trajectory, tangent_continue, tangent_to_tvd, AzimuthReference, HoleCalcInput,
    MeasuredStation, StationClass, StationSource, SurveyConvention, TieIn, Trajectory, UnitSystem,
    ValidationIssue,
};
use delve_storage::{new_id, HoleRecord, ProjectRecord, StationRecord, Store, TargetRecord};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub store: Mutex<Option<Store>>,
    pub path: Mutex<Option<PathBuf>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalcRequest {
    pub unit_system: UnitSystem,
    pub convention: SurveyConvention,
    pub azimuth_reference: AzimuthReference,
    pub vsp_deg: f64,
    pub tie_in: TieIn,
    pub stations: Vec<MeasuredStation>,
}

#[tauri::command]
fn calculate(req: CalcRequest) -> Result<Trajectory, String> {
    calculate_trajectory(&HoleCalcInput {
        unit_system: req.unit_system,
        convention: req.convention,
        azimuth_reference: req.azimuth_reference,
        vsp_deg: req.vsp_deg,
        tie_in: req.tie_in,
        stations: req.stations,
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn validate_survey(req: CalcRequest) -> Vec<ValidationIssue> {
    delve_core::validate_stations(req.convention, &req.stations)
}

#[tauri::command]
fn project_tangent_md(req: CalcRequest, added_md: f64) -> Result<Trajectory, String> {
    tangent_continue(
        &HoleCalcInput {
            unit_system: req.unit_system,
            convention: req.convention,
            azimuth_reference: req.azimuth_reference,
            vsp_deg: req.vsp_deg,
            tie_in: req.tie_in,
            stations: req.stations,
        },
        added_md,
        StationClass::Projected,
        "PROJECTED — Straight Line continuation (hold I/A)",
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn project_tangent_tvd(req: CalcRequest, target_tvd: f64) -> Result<Trajectory, String> {
    tangent_to_tvd(
        &HoleCalcInput {
            unit_system: req.unit_system,
            convention: req.convention,
            azimuth_reference: req.azimuth_reference,
            vsp_deg: req.vsp_deg,
            tie_in: req.tie_in,
            stations: req.stations,
        },
        target_tvd,
        StationClass::Projected,
        "PROJECTED — Straight Line to TVD (hold I/A)",
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn project_tangent_bit(req: CalcRequest, bit_to_sensor: f64) -> Result<Trajectory, String> {
    tangent_continue(
        &HoleCalcInput {
            unit_system: req.unit_system,
            convention: req.convention,
            azimuth_reference: req.azimuth_reference,
            vsp_deg: req.vsp_deg,
            tie_in: req.tie_in,
            stations: req.stations,
        },
        bit_to_sensor,
        StationClass::Projected,
        "PROJECTED — Straight Line bit projection (hold I/A; not WinSERVE BHL trend)",
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project(
    state: State<AppState>,
    path: String,
    name: String,
    client: String,
) -> Result<ProjectRecord, String> {
    let store = Store::open(PathBuf::from(&path).as_path()).map_err(|e| e.to_string())?;
    let rec = ProjectRecord {
        id: new_id(),
        name,
        client,
        notes: String::new(),
    };
    store.upsert_project(&rec).map_err(|e| e.to_string())?;
    *state.store.lock().unwrap() = Some(store);
    *state.path.lock().unwrap() = Some(PathBuf::from(path));
    Ok(rec)
}

#[tauri::command]
fn open_project(state: State<AppState>, path: String) -> Result<ProjectRecord, String> {
    let store = Store::open(PathBuf::from(&path).as_path()).map_err(|e| e.to_string())?;
    let rec = store
        .get_project_any()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No project in file".to_string())?;
    *state.store.lock().unwrap() = Some(store);
    *state.path.lock().unwrap() = Some(PathBuf::from(path));
    Ok(rec)
}

#[tauri::command]
fn save_hole(state: State<AppState>, hole: HoleRecord) -> Result<(), String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.upsert_hole(&hole).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_stations(
    state: State<AppState>,
    hole_id: String,
    stations: Vec<StationRecord>,
) -> Result<(), String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store
        .replace_stations(&hole_id, &stations)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_stations(state: State<AppState>, hole_id: String) -> Result<Vec<StationRecord>, String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.list_stations(&hole_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_target(state: State<AppState>, target: TargetRecord) -> Result<(), String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.upsert_target(&target).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_targets(state: State<AppState>, hole_id: String) -> Result<Vec<TargetRecord>, String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.list_targets(&hole_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_hole(state: State<AppState>, hole_id: String) -> Result<Option<HoleRecord>, String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.get_hole(&hole_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_holes(state: State<AppState>, project_id: String) -> Result<Vec<HoleRecord>, String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.list_holes(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_target(state: State<AppState>, target_id: String) -> Result<(), String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.delete_target(&target_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_hole(state: State<AppState>, hole_id: String) -> Result<(), String> {
    let guard = state.store.lock().unwrap();
    let store = guard.as_ref().ok_or("No project open")?;
    store.delete_hole(&hole_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn new_uuid() -> String {
    new_id()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            store: Mutex::new(None),
            path: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            calculate,
            validate_survey,
            project_tangent_md,
            project_tangent_tvd,
            project_tangent_bit,
            create_project,
            open_project,
            save_hole,
            save_stations,
            load_stations,
            save_target,
            load_targets,
            load_hole,
            list_holes,
            delete_target,
            delete_hole,
            new_uuid
        ])
        .run(tauri::generate_context!())
        .expect("error while running DelvePath");
}

// silence unused import in this module
#[allow(dead_code)]
fn _src() {
    let _ = StationSource::Manual;
}
