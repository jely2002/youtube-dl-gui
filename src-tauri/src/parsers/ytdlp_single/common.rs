pub(crate) fn i64_to_u64(v: Option<i64>) -> Option<u64> {
  v.and_then(|x| u64::try_from(x).ok())
}
