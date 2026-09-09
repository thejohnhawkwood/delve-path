use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanStatus {
    Solved,
    Infeasible,
    Singular,
    Incomplete,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlanIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Error, Clone, PartialEq)]
pub enum PlanError {
    #[error("{0}")]
    Message(String),
    #[error("infeasible: {0}")]
    Infeasible(String),
    #[error("gravity toolface singular: {0}")]
    Singular(String),
}

impl PlanError {
    pub fn msg(s: impl Into<String>) -> Self {
        Self::Message(s.into())
    }

    pub fn infeasible(s: impl Into<String>) -> Self {
        Self::Infeasible(s.into())
    }

    pub fn singular(s: impl Into<String>) -> Self {
        Self::Singular(s.into())
    }
}

impl serde::Serialize for PlanError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub fn issue(severity: &str, code: &str, message: impl Into<String>) -> PlanIssue {
    PlanIssue {
        severity: severity.into(),
        code: code.into(),
        message: message.into(),
    }
}
