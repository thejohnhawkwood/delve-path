//! Golden-fixture tests. Engine output is not rounded before comparison.

use csv::ReaderBuilder;
use delve_core::*;
use std::path::PathBuf;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repo root")
}

#[derive(Debug)]
struct Row {
    md: f64,
    inc: f64,
    azi: f64,
    tvd: Option<f64>,
    ns: Option<f64>,
    ew: Option<f64>,
    vs: Option<f64>,
    dls: Option<f64>,
    #[allow(dead_code)]
    closure: Option<f64>,
    comment: String,
}

fn parse_opt(s: &str) -> Option<f64> {
    let t = s.trim();
    if t.is_empty() {
        None
    } else {
        t.parse().ok()
    }
}

fn load_expected(path: &std::path::Path) -> Vec<Row> {
    let mut rdr = ReaderBuilder::new()
        .flexible(true)
        .from_path(path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let headers: Vec<String> = rdr.headers().unwrap().iter().map(|s| s.to_string()).collect();
    let idx = |name: &str| headers.iter().position(|h| h == name);
    let mut rows = Vec::new();
    for rec in rdr.records() {
        let rec = rec.unwrap();
        let get = |names: &[&str]| {
            for n in names {
                if let Some(i) = idx(n) {
                    if let Some(v) = rec.get(i) {
                        if !v.trim().is_empty() {
                            return v;
                        }
                    }
                }
            }
            ""
        };
        rows.push(Row {
            md: get(&["md_ft", "md_usft"]).parse().unwrap(),
            inc: get(&["incl_deg"]).parse().unwrap(),
            azi: get(&["azi_deg"]).parse().unwrap(),
            tvd: parse_opt(get(&["tvd_ft", "tvd_usft"])),
            ns: parse_opt(get(&["ns_ft", "ns_usft"])),
            ew: parse_opt(get(&["ew_ft", "ew_usft"])),
            vs: parse_opt(get(&["vs_ft"])),
            dls: parse_opt(get(&["dls_deg_per_100ft"])),
            closure: parse_opt(get(&["closure_ft"])),
            comment: get(&["comment"]).to_string(),
        });
    }
    rows
}

struct Diffs {
    n: usize,
    tvd: f64,
    ns: f64,
    ew: f64,
    vs: f64,
    dls: f64,
}

fn compare(name: &str, traj: &Trajectory, expected: &[Row], skip_last_if: impl Fn(&Row) -> bool) -> Diffs {
    let mut d = Diffs {
        n: 0,
        tvd: 0.0,
        ns: 0.0,
        ew: 0.0,
        vs: 0.0,
        dls: 0.0,
    };
    let mut worst_ns_md = 0.0;
    for (calc, exp) in traj.stations.iter().zip(expected.iter()) {
        if skip_last_if(exp) {
            continue;
        }
        d.n += 1;
        if let Some(v) = exp.tvd {
            d.tvd = d.tvd.max((calc.tvd - v).abs());
        }
        if let Some(v) = exp.ns {
            let e = (calc.north - v).abs();
            if e >= d.ns {
                d.ns = e;
                worst_ns_md = calc.md;
            }
        }
        if let Some(v) = exp.ew {
            d.ew = d.ew.max((calc.east - v).abs());
        }
        if let Some(v) = exp.vs {
            d.vs = d.vs.max((calc.vs - v).abs());
        }
        if let Some(v) = exp.dls {
            if !exp.comment.contains("DLS OCR uncertain") {
                d.dls = d.dls.max((calc.dls - v).abs());
            }
        }
        if let (Some(n), Some(e), Some(t)) = (exp.ns, exp.ew, exp.tvd) {
            let dn = calc.north - n;
            let de = calc.east - e;
            let dt = calc.tvd - t;
            if dn.abs() > 0.02 || de.abs() > 0.02 || dt.abs() > 0.02 {
                println!(
                    "  MD {:>8.2}  ΔN {:+.4}  ΔE {:+.4}  ΔTVD {:+.4}  calc N/E/TVD {:.4}/{:.4}/{:.4}  printed {:.2}/{:.2}/{:.2}",
                    calc.md, dn, de, dt, calc.north, calc.east, calc.tvd, n, e, t
                );
            }
        }
    }
    println!(
        "\n{name}\nStations compared: {}\nTVD max difference:  {:.6}\nNorth max difference: {:.6} (at MD {worst_ns_md})\nEast max difference:  {:.6}\nVS max difference:    {:.6}\nDLS max difference:   {:.6}\n",
        d.n, d.tvd, d.ns, d.ew, d.vs, d.dls
    );
    d
}

fn input_from_rows(rows: &[Row], vsp: f64) -> HoleCalcInput {
    let first = &rows[0];
    HoleCalcInput {
        unit_system: UnitSystem::Imperial,
        convention: SurveyConvention::OilfieldFromVertical,
        azimuth_reference: AzimuthReference::Unknown,
        vsp_deg: vsp,
        tie_in: TieIn {
            tvd: first.tvd.unwrap_or(first.md),
            north: first.ns.unwrap_or(0.0),
            east: first.ew.unwrap_or(0.0),
        },
        stations: rows
            .iter()
            .map(|r| MeasuredStation {
                md: r.md,
                inc_deg: r.inc,
                azi_deg: r.azi,
                comment: r.comment.clone(),
                class: if r.comment.to_lowercase().contains("projection") {
                    StationClass::Projected
                } else {
                    StationClass::Measured
                },
                source: StationSource::Csv,
            })
            .collect(),
    }
}

#[test]
fn oregon_winserve_golden() {
    let root = repo_root();
    let path = root.join("research/golden/fixtures/winserve_oregon_24c-23-65_expected.csv");
    let rows = load_expected(&path);
    let input = input_from_rows(&rows, 165.30);
    let traj = calculate_trajectory(&input).expect("oregon calc");
    let body = compare("OREGON WINSERVE GOLDEN (through plug-back)", &traj, &rows, |r| {
        r.md > 1848.0
    });
    let tol_len = 0.02;
    let tol_dls = 0.02;
    assert!(body.tvd <= tol_len, "TVD {0} > {tol_len}", body.tvd);
    assert!(body.ns <= tol_len, "N {0} > {tol_len}", body.ns);
    assert!(body.ew <= tol_len, "E {0} > {tol_len}", body.ew);
    assert!(body.vs <= tol_len, "VS {0} > {tol_len}", body.vs);
    assert!(body.dls <= tol_dls, "DLS {0} > {tol_dls}", body.dls);

    // MD 2591 is 743 ft after the plug-back interpolated point. Engine unchanged;
    // see docs/CALCULATION_SPEC.md investigation note.
    let last = compare("OREGON LAST INTERVAL AFTER PLUG-BACK", &traj, &rows, |r| r.md <= 1848.0);
    assert!(last.tvd <= 0.02, "last TVD {}", last.tvd);
    assert!(last.ew <= 0.02, "last E {}", last.ew);
    assert!(last.dls <= 0.02, "last DLS {}", last.dls);
    assert!(last.ns <= 0.04, "last N {} (post plug-back long interval)", last.ns);
    assert!(last.vs <= 0.04, "last VS {} (post plug-back long interval)", last.vs);
}

#[test]
fn nm_9461_winserve_high_angle_golden() {
    let root = repo_root();
    let path = root.join(
        "research/golden/fixtures/winserve_nm_3003929461_jicarilla452-08-31_expected.csv",
    );
    let rows = load_expected(&path);
    let input = input_from_rows(&rows, 86.10);
    let traj = calculate_trajectory(&input).expect("nm9461 calc");
    let d = compare("NM 9461 WINSERVE HIGH-ANGLE GOLDEN", &traj, &rows, |r| {
        r.comment.to_lowercase().contains("projection")
    });
    let tol_len = 0.02;
    let tol_dls = 0.05; // slightly wider: high DLS intervals + printed 2 dp
    assert!(d.tvd <= tol_len, "TVD {0} > {tol_len}", d.tvd);
    assert!(d.ns <= tol_len, "N {0} > {tol_len}", d.ns);
    assert!(d.ew <= tol_len, "E {0} > {tol_len}", d.ew);
    assert!(d.vs <= 0.05, "VS {0} > 0.05", d.vs);
    assert!(d.dls <= tol_dls, "DLS {0} > {tol_dls}", d.dls);
}

#[test]
fn compass_plan_excerpt() {
    let root = repo_root();
    let path = root.join(
        "research/golden/fixtures/compass_nm_3001555969_waterbuffalo131h_plan_page12.csv",
    );
    let rows = load_expected(&path);
    let input = input_from_rows(&rows, 80.79);
    let traj = calculate_trajectory(&input).expect("compass calc");
    let d = compare("COMPASS 5000 PLAN EXCERPT", &traj, &rows, |_| false);
    // Plan, 1 dp usft, not a WinSERVE oracle. N at MD 5000 differs 0.23 usft because
    // the printed hold adds 276.1 / 1000 usft vs geometric 275.998. See CALCULATION_SPEC.
    assert!(d.tvd <= 0.15, "TVD {}", d.tvd);
    assert!(d.ew <= 0.15, "E {}", d.ew);
    assert!(d.ns <= 0.25, "N {} (1 dp hold-increment rounding)", d.ns);
}

#[test]
fn hawkeye_excerpt() {
    let root = repo_root();
    let path = root.join("research/golden/fixtures/hawkeye_idaho_fallon1-10_survey_page4.csv");
    let rows = load_expected(&path);
    // VSP not printed on the excerpt page; derive from first station VS vs N/E if possible.
    // First row: N=-1327.86 E=-564.53 VS=1442.65
    // We still reconstruct from the excerpt tie-in; VS compare only if we set VSP.
    // Use closure azimuth ~203° as a stand-in? Safer: compare N/E/TVD only.
    let input = input_from_rows(&rows, 203.03);
    let traj = calculate_trajectory(&input).expect("hawkeye calc");
    let d = compare("HAWKEYE FALLON 1-10 EXCERPT", &traj, &rows, |_| false);
    assert!(d.tvd <= 0.05, "TVD {}", d.tvd);
    assert!(d.ns <= 0.05, "N {}", d.ns);
    assert!(d.ew <= 0.05, "E {}", d.ew);
}
