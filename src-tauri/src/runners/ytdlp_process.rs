use std::io;
use std::process::Command;

#[cfg(unix)]
use std::os::unix::process::CommandExt;

#[cfg(windows)]
use core::ffi::c_void;

#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};

#[cfg(windows)]
use windows_sys::Win32::System::JobObjects::{
  AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
  SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
  JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

#[cfg(windows)]
use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;

#[derive(Debug)]
pub struct PlatformProcess {
  #[cfg(unix)]
  pub pgid: Option<i32>,
  #[cfg(windows)]
  pub job: Option<JobHandle>,
}

#[cfg(windows)]
#[derive(Debug)]
pub struct JobHandle {
  handle: isize,
}

#[cfg(windows)]
impl JobHandle {
  #[inline]
  fn as_handle(&self) -> HANDLE {
    self.handle as HANDLE
  }
}

#[cfg(windows)]
impl Drop for JobHandle {
  fn drop(&mut self) {
    if self.handle != 0 {
      unsafe { CloseHandle(self.as_handle()) };
    }
  }
}

pub fn configure_command(command: &mut Command) -> io::Result<()> {
  #[cfg(unix)]
  {
    unsafe {
      command.pre_exec(|| {
        let result = libc::setpgid(0, 0);
        if result == 0 {
          Ok(())
        } else {
          Err(io::Error::last_os_error())
        }
      });
    }
  }

  #[cfg(windows)]
  {
    command.creation_flags(CREATE_NO_WINDOW);
  }

  Ok(())
}

pub fn platform_process_from_child(child: &std::process::Child) -> Result<PlatformProcess, String> {
  #[cfg(unix)]
  {
    Ok(PlatformProcess {
      pgid: Some(child.id() as i32),
    })
  }

  #[cfg(windows)]
  {
    let job = create_job_for_child(child)
      .map(Some)
      .map_err(|e| format!("yt-dlp job object error: {e}"))?;
    Ok(PlatformProcess { job })
  }

  #[cfg(not(any(unix, windows)))]
  {
    let _ = child;
    Ok(PlatformProcess {})
  }
}

pub fn kill_platform_process(platform: &PlatformProcess) {
  #[cfg(unix)]
  {
    if let Some(pgid) = platform.pgid {
      unsafe {
        libc::killpg(pgid, libc::SIGTERM);
      }
    }
  }

  #[cfg(windows)]
  {
    if let Some(job) = &platform.job {
      unsafe { TerminateJobObject(job.as_handle(), 1) };
    }
  }
}

#[cfg(windows)]
fn create_job_for_child(child: &std::process::Child) -> io::Result<JobHandle> {
  let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null::<u16>()) };
  if handle.is_null() {
    return Err(io::Error::last_os_error());
  }

  let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
  info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

  let info_ptr = (&info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION) as *const c_void;
  let info_size = std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32;

  let set_ok = unsafe {
    SetInformationJobObject(
      handle,
      JobObjectExtendedLimitInformation,
      info_ptr,
      info_size,
    )
  };
  if set_ok == 0 {
    unsafe { CloseHandle(handle) };
    return Err(io::Error::last_os_error());
  }

  let process_handle = child.as_raw_handle() as HANDLE;
  let assign_ok = unsafe { AssignProcessToJobObject(handle, process_handle) };
  if assign_ok == 0 {
    unsafe { CloseHandle(handle) };
    return Err(io::Error::last_os_error());
  }

  Ok(JobHandle {
    handle: handle as isize,
  })
}
