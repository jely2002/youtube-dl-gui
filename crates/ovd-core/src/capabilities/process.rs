use crate::capabilities::BoxFut;
use std::sync::Arc;

pub type Receiver<T> = tokio::sync::mpsc::UnboundedReceiver<T>;
pub type Sender<T> = tokio::sync::mpsc::UnboundedSender<T>;

#[derive(Clone, Debug)]
pub struct TerminatedPayload {
  pub code: Option<i32>,
}

#[derive(Clone, Debug)]
pub enum ProcessEvent {
  Stdout(Vec<u8>),
  Stderr(Vec<u8>),
  Terminated(TerminatedPayload),
  Error(String),
}

pub trait ChildHandle: Send + Sync + 'static {
  fn kill(&self) -> Result<(), String>;
}

pub type CommandChild = Box<dyn ChildHandle>;

#[derive(Clone)]
pub struct CommandCtx {
  pub runner: Arc<dyn ProcessRunner>,
  pub bin_dir: std::path::PathBuf,
}

#[derive(Debug, Clone)]
pub struct Output {
  pub status_code: i32,
  pub stdout: Vec<u8>,
  pub stderr: Vec<u8>,
}

pub trait ProcessRunner: Send + Sync + 'static {
  fn spawn(
    &self,
    program: &str,
    args: Vec<String>,
    env: Vec<(String, String)>,
  ) -> Result<(Receiver<ProcessEvent>, CommandChild), String>;

  fn output(
    &self,
    program: &str,
    args: Vec<String>,
    env: Vec<(String, String)>,
  ) -> BoxFut<Result<Output, String>>;
}
