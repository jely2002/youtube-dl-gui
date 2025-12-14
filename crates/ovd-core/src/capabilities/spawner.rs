use std::{future::Future, pin::Pin};

pub type BoxFut<T> = Pin<Box<dyn Future<Output = T> + Send + 'static>>;

pub trait Spawner: Send + Sync + 'static {
  fn spawn(&self, fut: BoxFut<()>);
}
