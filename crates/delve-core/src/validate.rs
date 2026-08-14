use crate::types::{
    MeasuredStation, Severity, StationClass, SurveyConvention, ValidationIssue,
};

pub fn validate_stations(
    convention: SurveyConvention,
    stations: &[MeasuredStation],
) -> Vec<ValidationIssue> {
    let mut out = Vec::new();
    if !matches!(convention, SurveyConvention::OilfieldFromVertical) {
        out.push(ValidationIssue {
            severity: Severity::Error,
            index: None,
            code: "convention_unsupported".into(),
            message: "Only oilfield inclination-from-vertical is implemented. Mining conversion is blocked.".into(),
        });
    }
    if stations.is_empty() {
        out.push(ValidationIssue {
            severity: Severity::Error,
            index: None,
            code: "empty".into(),
            message: "No survey stations.".into(),
        });
        return out;
    }
    for (i, s) in stations.iter().enumerate() {
        if !s.md.is_finite() {
            out.push(err(i, "md_invalid", "MD is missing or not finite."));
        }
        if !s.inc_deg.is_finite() {
            out.push(err(i, "inc_invalid", "Inclination is missing or not finite."));
        } else if !(0.0..=180.0).contains(&s.inc_deg) {
            out.push(err(i, "inc_range", "Inclination must be 0–180° (oilfield, from vertical)."));
        }
        if !s.azi_deg.is_finite() {
            out.push(err(i, "azi_invalid", "Azimuth is missing or not finite."));
        } else if !(0.0..360.0).contains(&s.azi_deg) && s.azi_deg != 360.0 {
            out.push(err(i, "azi_range", "Azimuth must be 0–360°."));
        }
        if s.class == StationClass::Projected {
            out.push(ValidationIssue {
                severity: Severity::Info,
                index: Some(i),
                code: "projected".into(),
                message: "Station is PROJECTED, not a measured survey.".into(),
            });
        }
    }
    for i in 1..stations.len() {
        let a = &stations[i - 1];
        let b = &stations[i];
        if a.md.is_finite() && b.md.is_finite() {
            if (b.md - a.md).abs() < 1e-12 {
                out.push(err(i, "md_duplicate", "Duplicate MD."));
            } else if b.md < a.md {
                out.push(err(i, "md_decreasing", "MD decreases. List was not silently sorted."));
            }
        }
    }
    out
}

fn err(index: usize, code: &str, message: &str) -> ValidationIssue {
    ValidationIssue {
        severity: Severity::Error,
        index: Some(index),
        code: code.into(),
        message: message.into(),
    }
}

pub fn has_blocking_error(issues: &[ValidationIssue]) -> bool {
    issues.iter().any(|i| i.severity == Severity::Error)
}
