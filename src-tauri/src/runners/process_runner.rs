use ovd_core::capabilities::{
  BoxFut, ChildHandle, CommandChild, Output, ProcessEvent, ProcessRunner, Receiver,
  TerminatedPayload,
};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

#[derive(Clone)]
pub struct TauriProcessRunner {
  app: AppHandle,
}

impl TauriProcessRunner {
  pub fn new(app: AppHandle) -> Self {
    Self { app }
  }
}

struct TauriChild {
  inner: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

impl ChildHandle for TauriChild {
  fn kill(&self) -> Result<(), String> {
    let mut guard = self
      .inner
      .lock()
      .map_err(|_| "child mutex poisoned".to_string())?;

    let child = guard
      .take()
      .ok_or_else(|| "child already taken".to_string())?;

    child.kill().map_err(|e| format!("kill failed: {e}"))?;

    Ok(())
  }
}

impl ProcessRunner for TauriProcessRunner {
  fn spawn(
    &self,
    program: &str,
    args: Vec<String>,
    env: Vec<(String, String)>,
  ) -> Result<(Receiver<ProcessEvent>, CommandChild), String> {
    let mut cmd = self.app.shell().command(program).args(args);
    for (k, v) in env {
      cmd = cmd.env(k, v);
    }

    let (mut rx_shell, child) = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<ProcessEvent>();

    tauri::async_runtime::spawn(async move {
      while let Some(ev) = rx_shell.recv().await {
        match ev {
          CommandEvent::Stdout(b) => {
            let _ = tx.send(ProcessEvent::Stdout(b));
          }
          CommandEvent::Stderr(b) => {
            let _ = tx.send(ProcessEvent::Stderr(b));
          }
          CommandEvent::Terminated(t) => {
            let _ = tx.send(ProcessEvent::Terminated(TerminatedPayload { code: t.code }));
            break;
          }
          _ => {}
        }
      }
    });

    Ok((
      rx,
      Box::new(TauriChild {
        inner: Mutex::new(Some(child)),
      }),
    ))
  }

  fn output(
    &self,
    program: &str,
    args: Vec<String>,
    env: Vec<(String, String)>,
  ) -> BoxFut<Result<Output, String>> {
    let app = self.app.clone();
    let program = program.to_string();

    Box::pin(async move {
      let mut cmd = app.shell().command(program).args(args);
      for (k, v) in env {
        cmd = cmd.env(k, v);
      }

      let out = cmd
        .output()
        .await
        .map_err(|e| format!("output failed: {e}"))?;
      Ok(Output {
        status_code: out.status.code().unwrap_or(-1),
        stdout: out.stdout,
        stderr: out.stderr,
      })
    })
  }
}
