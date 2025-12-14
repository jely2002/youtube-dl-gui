use std::collections::HashMap;

#[derive(Default)]
pub struct NumberingManager {
  next_autonumber: u64,
  per_group: HashMap<String, u64>,
}

impl NumberingManager {
  pub fn new() -> Self {
    Self {
      next_autonumber: 1,
      per_group: HashMap::new(),
    }
  }

  pub fn assign_for(&mut self, group_key: Option<&String>) -> (u64, Option<u64>) {
    let autonumber = self.next_autonumber;
    self.next_autonumber += 1;

    let group_autonumber = group_key.map(|key| {
      let counter = self.per_group.entry(key.to_string()).or_insert(0);
      *counter += 1;
      *counter
    });

    (autonumber, group_autonumber)
  }
}
