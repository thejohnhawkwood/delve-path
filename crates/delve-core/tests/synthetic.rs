use delve_core::*;

fn st(md: f64, inc: f64, azi: f64) -> MeasuredStation {
    MeasuredStation {
        md,
        inc_deg: inc,
        azi_deg: azi,
        comment: String::new(),
        class: StationClass::Measured,
        source: StationSource::Manual,
    }
}

fn run(stations: Vec<MeasuredStation>, vsp: f64, tie: TieIn) -> Trajectory {
    calculate_trajectory(&HoleCalcInput {
        unit_system: UnitSystem::Metric,
        convention: SurveyConvention::OilfieldFromVertical,
        azimuth_reference: AzimuthReference::Unknown,
        vsp_deg: vsp,
        tie_in: tie,
        stations,
    })
    .expect("calc")
}

#[test]
fn l1_vertical() {
    let t = run(
        vec![
            st(0.0, 0.0, 123.0),
            st(100.0, 0.0, 123.0),
            st(250.0, 0.0, 40.0),
        ],
        0.0,
        TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
    );
    for s in &t.stations {
        assert!(s.north.abs() < 1e-12, "N {}", s.north);
        assert!(s.east.abs() < 1e-12, "E {}", s.east);
    }
    assert!((t.stations[1].tvd - 100.0).abs() < 1e-12);
    assert!((t.stations[2].tvd - 250.0).abs() < 1e-12);
}

#[test]
fn l1_due_north() {
    let t = run(
        vec![st(0.0, 30.0, 0.0), st(100.0, 30.0, 0.0)],
        0.0,
        TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
    );
    assert!(t.stations[1].east.abs() < 1e-12);
    assert!(t.stations[1].north > 0.0);
    assert!(t.stations[1].tvd > 0.0);
}

#[test]
fn l1_due_east() {
    let t = run(
        vec![st(0.0, 30.0, 90.0), st(100.0, 30.0, 90.0)],
        90.0,
        TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
    );
    assert!(t.stations[1].north.abs() < 1e-12);
    assert!(t.stations[1].east > 0.0);
}

#[test]
fn l1_azimuth_wrap() {
    let t = run(
        vec![st(0.0, 10.0, 359.0), st(30.0, 10.0, 1.0)],
        0.0,
        TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
    );
    // 2° azimuth change at 10° inc is a small dogleg, not ~358°.
    assert!(
        t.stations[1].dogleg_deg < 3.0,
        "dogleg {}",
        t.stations[1].dogleg_deg
    );
    assert!(t.stations[1].dogleg_deg > 0.1);
}

#[test]
fn l1_near_zero_dogleg() {
    let t = run(
        vec![st(0.0, 45.0, 90.0), st(50.0, 45.0, 90.0)],
        90.0,
        TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
    );
    assert!(t.stations[1].dls.abs() < 1e-9);
    assert!(t.stations[1].east.is_finite());
    assert!(t.stations[1].tvd.is_finite());
}

#[test]
fn l1_cross_horizontal() {
    let t = run(
        vec![st(0.0, 85.0, 0.0), st(30.0, 90.0, 0.0), st(60.0, 95.0, 0.0)],
        0.0,
        TieIn {
            tvd: 1000.0,
            north: 0.0,
            east: 0.0,
        },
    );
    let d1 = t.stations[1].tvd - t.stations[0].tvd;
    let d2 = t.stations[2].tvd - t.stations[1].tvd;
    assert!(d1 > 0.0);
    assert!(d2 < 0.0, "TVD should drop after crossing 90°, d2={d2}");
}

#[test]
fn l1_vsp_independence() {
    let stations = vec![st(0.0, 20.0, 45.0), st(100.0, 25.0, 50.0)];
    let tie = TieIn {
        tvd: 0.0,
        north: 0.0,
        east: 0.0,
    };
    let a = run(stations.clone(), 0.0, tie);
    let b = run(stations, 90.0, tie);
    assert!((a.stations[1].north - b.stations[1].north).abs() < 1e-12);
    assert!((a.stations[1].east - b.stations[1].east).abs() < 1e-12);
    assert!((a.stations[1].tvd - b.stations[1].tvd).abs() < 1e-12);
    assert!((a.stations[1].vs - b.stations[1].vs).abs() > 1.0);
}

#[test]
fn l1_unit_equivalence() {
    let metric = calculate_trajectory(&HoleCalcInput {
        unit_system: UnitSystem::Metric,
        convention: SurveyConvention::OilfieldFromVertical,
        azimuth_reference: AzimuthReference::Unknown,
        vsp_deg: 0.0,
        tie_in: TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
        stations: vec![st(0.0, 30.0, 0.0), st(30.48, 30.0, 0.0)],
    })
    .unwrap();
    let imperial = calculate_trajectory(&HoleCalcInput {
        unit_system: UnitSystem::Imperial,
        convention: SurveyConvention::OilfieldFromVertical,
        azimuth_reference: AzimuthReference::Unknown,
        vsp_deg: 0.0,
        tie_in: TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
        stations: vec![st(0.0, 30.0, 0.0), st(100.0, 30.0, 0.0)],
    })
    .unwrap();
    let n_m = ft_to_m(imperial.stations[1].north);
    let t_m = ft_to_m(imperial.stations[1].tvd);
    assert!((n_m - metric.stations[1].north).abs() < 1e-9);
    assert!((t_m - metric.stations[1].tvd).abs() < 1e-9);
}

#[test]
fn l1_tie_in() {
    let t = run(
        vec![st(1500.0, 2.0, 300.0), st(1600.0, 2.0, 300.0)],
        0.0,
        TieIn {
            tvd: 1499.7,
            north: 13.09,
            east: 22.67,
        },
    );
    assert!((t.stations[0].tvd - 1499.7).abs() < 1e-12);
    assert!(t.stations[1].tvd > 1499.7);
    assert!(t.stations[1].north != 13.09 || t.stations[1].east != 22.67);
}

#[test]
fn decreasing_md_is_error() {
    let err = calculate_trajectory(&HoleCalcInput {
        unit_system: UnitSystem::Metric,
        convention: SurveyConvention::OilfieldFromVertical,
        azimuth_reference: AzimuthReference::Unknown,
        vsp_deg: 0.0,
        tie_in: TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        },
        stations: vec![st(100.0, 0.0, 0.0), st(90.0, 0.0, 0.0)],
    });
    assert!(err.is_err());
}
