#!/bin/bash
# Install Rust and Tauri dependencies for Task Pool Desktop

echo "Installing Rust (this may take a few minutes)..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Source Rust environment
source "$HOME/.cargo/env"

echo "Installing Tauri CLI..."
cargo install tauri-cli

echo ""
echo "✅ Installation complete!"
echo ""
echo "To run the desktop app in development:"
echo "  cd task-pool-desktop"
echo "  npm run tauri dev"
echo ""
echo "To build a standalone .app file:"
echo "  npm run tauri build"
echo ""
echo "The built app will be in: src-tauri/target/release/bundle/macos/"
