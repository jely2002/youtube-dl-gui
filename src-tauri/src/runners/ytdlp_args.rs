mod format_args;
mod location_args;
mod output_args;

pub use format_args::build_format_args;
pub use location_args::build_location_args;
pub use output_args::build_output_args;

#[cfg(test)]
mod tests;
