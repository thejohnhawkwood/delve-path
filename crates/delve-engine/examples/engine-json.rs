//! Offline JSON replay interface, also used to compare native and WASM results.
use std::io::{self, Read};
fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("read JSON request from stdin");
    match delve_engine::engine_call_json(&input) {
        Ok(result) => println!("{result}"),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
