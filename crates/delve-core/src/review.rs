//! Station review state. Existing rows migrate to `unreviewed`.
//!
//! Flight Deck anchors and forecast scoring require `accepted`.
//! Survey reconstruction may still display `unreviewed` rows.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ReviewState {
    #[default]
    Unreviewed,
    Accepted,
    Excluded,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct StationReview {
    pub state: ReviewState,
    #[serde(default)]
    pub reviewer: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub reviewed_at: Option<String>,
    #[serde(default)]
    pub exclusion_reason: String,
}

impl StationReview {
    pub fn unreviewed() -> Self {
        Self::default()
    }

    pub fn accepted(
        reviewer: impl Into<String>,
        source: impl Into<String>,
        at: impl Into<String>,
    ) -> Self {
        Self {
            state: ReviewState::Accepted,
            reviewer: reviewer.into(),
            source: source.into(),
            reviewed_at: Some(at.into()),
            exclusion_reason: String::new(),
        }
    }

    pub fn excluded(
        reviewer: impl Into<String>,
        source: impl Into<String>,
        at: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            state: ReviewState::Excluded,
            reviewer: reviewer.into(),
            source: source.into(),
            reviewed_at: Some(at.into()),
            exclusion_reason: reason.into(),
        }
    }

    pub fn is_accepted(&self) -> bool {
        self.state == ReviewState::Accepted
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_unreviewed() {
        let r = StationReview::default();
        assert_eq!(r.state, ReviewState::Unreviewed);
        assert!(!r.is_accepted());
    }
}
