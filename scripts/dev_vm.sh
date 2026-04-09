#!/usr/bin/env bash
# Start the BitBox dev environment on a remote VM with SSH port forwarding.
# Skips anything already running. Run from your local machine.
#
# Setup: cp scripts/dev_vm.conf.example scripts/dev_vm.conf
#        Then edit dev_vm.conf with your VM details.
#
# Usage: ./scripts/dev_vm.sh          Start everything
#        ./scripts/dev_vm.sh stop     Stop everything
#        ./scripts/dev_vm.sh logs     Attach to tmux on VM (detach: Ctrl-b d)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONF="$SCRIPT_DIR/dev_vm.conf"

if [[ ! -f "$CONF" ]]; then
    echo "Missing config: $CONF"
    echo ""
    echo "Create it by copying the example:"
    echo "  cp scripts/dev_vm.conf.example scripts/dev_vm.conf"
    echo ""
    echo "Then edit scripts/dev_vm.conf with your VM details."
    exit 1
fi

source "$CONF"

: "${VM:?VM is not set in $CONF}"
: "${PROJECT_DIR:?PROJECT_DIR is not set in $CONF}"

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[dev]${NC} $*"; }
skip() { echo -e "${YELLOW}[dev]${NC} $* (already running)"; }

# --- Stop mode ---

if [[ "${1:-}" == "stop" ]]; then
    log "Stopping dev environment..."
    ssh "$VM" "tmux kill-session -t bbdev 2>/dev/null" && log "Stopped tmux session" || log "No tmux session found"
    pkill -f "ssh.*-L 8080:localhost:8080.*${VM}" 2>/dev/null && log "Stopped tunnel" || log "No tunnel found"
    log "Done."
    exit 0
fi

# --- Logs mode ---

if [[ "${1:-}" == "logs" ]]; then
    exec ssh -t "$VM" "tmux attach -t bbdev"
fi

# --- Start remote processes in tmux ---

if ssh "$VM" "tmux has-session -t bbdev 2>/dev/null"; then
    skip "tmux session (webdev + servewallet)"
else
    log "Starting tmux session with webdev and servewallet..."
    ssh "$VM" "cd $PROJECT_DIR && tmux new-session -d -s bbdev -n webdev"
    ssh "$VM" "tmux send-keys -t bbdev:webdev 'source ~/.zshrc && cd $PROJECT_DIR && make webdev' Enter"
    ssh "$VM" "tmux new-window -t bbdev -n servewallet"
    ssh "$VM" "tmux send-keys -t bbdev:servewallet 'source ~/.zshrc && cd $PROJECT_DIR && make servewallet' Enter"
fi

# --- SSH port forwarding ---

if pgrep -f "ssh.*-L 8080:localhost:8080.*${VM}" >/dev/null 2>&1; then
    skip "SSH tunnel (ports 8080, 8082)"
else
    log "Starting SSH tunnel (ports 8080, 8082)..."
    ssh -f -N -o ServerAliveInterval=60 \
        -o ExitOnForwardFailure=yes \
        -L 8080:localhost:8080 -L 8082:localhost:8082 \
        "$VM" || {
        echo -e "${RED}[dev]${NC} Tunnel failed — ports may already be in use."
        exit 1
    }
fi

log "Done. Frontend: http://localhost:8080"
log "Attach to logs:  ./scripts/dev_vm.sh logs"
log "Stop:            ./scripts/dev_vm.sh stop"
