#!/usr/bin/env bash
# setup.sh — one-shot dev environment bootstrap
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log()  { echo -e "\033[1;34m[setup]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ok]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
die()  { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

# ── 1. .env ───────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  log "Creating .env from .env.example"
  cp .env.example .env
  ok ".env created — edit it to customise endpoints"
else
  warn ".env already exists, skipping"
fi

# ── 2. Node dependencies (optional for frontend development) ──────────────────
if command -v node &>/dev/null && [[ -f package.json ]]; then
  NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  if [[ "$NODE_VER" -ge 20 ]]; then
    log "Installing Node dependencies"
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
    ok "Node dependencies installed"
  else
    warn "Node.js 20+ required for frontend development (found $NODE_VER)"
  fi
else
  ok "Skipping Node.js setup (not needed for Soroban contract development)"
fi

# ── 3. Rust / Soroban CLI (optional) ─────────────────────────────────────────
# Known-good SHA256 for rustup-init.sh — update this when rustup releases a new version.
# Obtain from: https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init.sha256
RUSTUP_SHA256="${RUSTUP_SHA256:-}"

install_rust() {
  [[ -n "$RUSTUP_SHA256" ]] || die "Set RUSTUP_SHA256 before running setup (see comment above)"
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN
  log "Downloading rustup installer"
  curl -fsSL --proto '=https' --tlsv1.2 https://sh.rustup.rs -o "$tmp"
  log "Verifying SHA256 checksum"
  echo "${RUSTUP_SHA256}  ${tmp}" | sha256sum --check --status \
    || die "rustup-init.sh checksum mismatch — aborting"
  bash "$tmp" -y --no-modify-path
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
  ok "Rust installed: $(rustc --version)"
}

if ! command -v cargo &>/dev/null; then
  install_rust
fi

if ! command -v stellar &>/dev/null; then
  log "Installing Soroban CLI (stellar-cli)"
  cargo install --locked stellar-cli --features opt
  ok "stellar-cli installed"
else
  ok "stellar-cli already installed: $(stellar --version 2>&1 | head -1)"
fi

# ── 4. Git hooks ──────────────────────────────────────────────────────────────
if [[ -d .git ]]; then
  log "Installing pre-commit lint hook"
  cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
npm run lint --silent || { echo "Lint failed — commit aborted"; exit 1; }
HOOK
  chmod +x .git/hooks/pre-commit
  ok "pre-commit hook installed"
fi

echo ""
ok "Setup complete! Next steps:"
echo "  stellar --version        — verify Soroban CLI installation"
echo "  cd contracts/escrow && cargo build  — build escrow contract"
echo "  cd contracts/token && cargo build   — build token contract"
echo "  ./scripts/local-net.sh start        — start local Stellar node"
echo "  ./scripts/deploy.sh testnet         — deploy contracts to testnet"
