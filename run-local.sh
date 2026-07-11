#!/usr/bin/env bash
# =============================================================================
# run-local.sh - Avvio in locale (senza Docker) di backend + frontend
# =============================================================================
# Uso:
#   ./run-local.sh                      # setup (se serve) e avvio backend + frontend
#   ./run-local.sh --skip-install       # salta pip/npm install (avvio piu' rapido)
#   ./run-local.sh --backend-port 8001 --frontend-port 5174
#   ./run-local.sh --install-python     # installa Python 3.12 se mancante
#   ./run-local.sh --install-node       # installa Node.js LTS via nvm se mancante
#
# Requisiti: Python 3.12 e Node.js 20 (vedi README, sezione "Esecuzione in locale").
# Lo script avvia backend e frontend in background nella stessa sessione terminale.
# Premi Ctrl+C per fermare entrambi i servizi.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python"

BACKEND_PORT=8000
FRONTEND_PORT=5173
SKIP_INSTALL=false
INSTALL_PYTHON=false
INSTALL_NODE=false

# --- Parsing argomenti -------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-install)    SKIP_INSTALL=true ;;
        --install-python)  INSTALL_PYTHON=true ;;
        --install-node)    INSTALL_NODE=true ;;
        --backend-port)    BACKEND_PORT="$2"; shift ;;
        --frontend-port)   FRONTEND_PORT="$2"; shift ;;
        -h|--help)
            sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) echo "Argomento sconosciuto: $1" >&2; exit 1 ;;
    esac
    shift
done

step() { echo -e "\033[36m==> $*\033[0m"; }
ok()   { echo -e "\033[32m$*\033[0m"; }
warn() { echo -e "\033[33m$*\033[0m"; }
err()  { echo -e "\033[31mERRORE: $*\033[0m" >&2; }

# =============================================================================
# Python 3.12
# =============================================================================

resolve_py312() {
    for cmd in python3.12 python3 python; do
        if command -v "$cmd" &>/dev/null; then
            ver=$("$cmd" --version 2>&1 || true)
            if [[ "$ver" == *"3.12"* ]]; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

install_python312() {
    step "Installazione Python 3.12"
    if command -v apt-get &>/dev/null; then
        sudo apt-get update -qq
        sudo apt-get install -y software-properties-common
        sudo add-apt-repository -y ppa:deadsnakes/ppa
        sudo apt-get update -qq
        sudo apt-get install -y python3.12 python3.12-venv python3.12-dev
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y python3.12 python3.12-devel
    elif command -v brew &>/dev/null; then
        brew install python@3.12
        brew link --overwrite python@3.12
    else
        err "Gestore pacchetti non riconosciuto. Installa Python 3.12 manualmente: https://www.python.org/downloads/"
        exit 1
    fi
}

# =============================================================================
# Node.js via nvm
# =============================================================================

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

load_nvm() {
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
        # shellcheck source=/dev/null
        source "$NVM_DIR/nvm.sh"
        return 0
    fi
    return 1
}

install_nvm_and_node_lts() {
    step "Installazione nvm"
    # Versione minima stabile di nvm
    NVM_INSTALL_VERSION="0.40.3"
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_INSTALL_VERSION}/install.sh" | bash
    # Carica nvm senza riaprire il terminale
    load_nvm || {
        err "nvm non caricabile dopo l'installazione. Riapri il terminale e riesegui lo script."
        exit 1
    }
    step "Installazione Node.js LTS tramite nvm"
    nvm install --lts
    nvm use --lts
    nvm alias default lts/*
}

# =============================================================================
# Verifica / installa Node.js
# =============================================================================

# Carica nvm se disponibile (necessario quando node e' installato tramite nvm
# ma non presente nel PATH di default della shell non-interattiva)
load_nvm 2>/dev/null || true

if ! command -v node &>/dev/null; then
    if $INSTALL_NODE; then
        install_nvm_and_node_lts
    else
        warn ""
        warn "Node.js non trovato: e' obbligatorio per il frontend."
        warn ""
        warn "Come procedere:"
        warn "  - Installazione automatica (nvm):  ./run-local.sh --install-node"
        warn "  - Manuale (nvm):   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
        warn "  - Download:        https://nodejs.org/en/download"
        exit 1
    fi
fi

# =============================================================================
# Verifica / installa Python 3.12
# =============================================================================

PY=$(resolve_py312 || true)

if [[ -z "${PY:-}" ]]; then
    if $INSTALL_PYTHON; then
        install_python312
        PY=$(resolve_py312 || true)
    fi
    if [[ -z "${PY:-}" ]]; then
        warn ""
        warn "Python 3.12 non trovato: e' obbligatorio per il backend."
        warn ""
        warn "Come procedere:"
        warn "  - Installazione automatica:    ./run-local.sh --install-python"
        warn "  - Manuale (Ubuntu/Debian):     sudo add-apt-repository ppa:deadsnakes/ppa && sudo apt install python3.12 python3.12-venv"
        warn "  - Manuale (Fedora):            sudo dnf install python3.12"
        warn "  - Manuale (macOS con Homebrew): brew install python@3.12"
        warn "  - Download:                    https://www.python.org/downloads/"
        exit 1
    fi
fi

# =============================================================================
# Setup virtualenv backend
# =============================================================================

if [[ ! -f "$VENV_PY" ]]; then
    step "Creazione virtualenv Python 3.12 in backend/.venv"
    "$PY" -m venv "$VENV_DIR"
    if [[ ! -f "$VENV_PY" ]]; then
        err "Creazione del virtualenv fallita: '$VENV_PY' non trovato."
        exit 1
    fi
fi

if ! $SKIP_INSTALL; then
    step "Installazione dipendenze backend (pip)"
    "$VENV_PY" -m pip install --upgrade pip -q
    "$VENV_PY" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

# =============================================================================
# Setup frontend
# =============================================================================

if ! $SKIP_INSTALL || [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    step "Installazione dipendenze frontend (npm install)"
    (cd "$FRONTEND_DIR" && npm install)
fi

# =============================================================================
# Genera un JWT secret di sviluppo se non gia' impostato
# =============================================================================

JWT_SECRET="${JWT_SECRET_KEY:-$(python3 -c 'import uuid; print(uuid.uuid4().hex)' 2>/dev/null \
    || cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' \
    || LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 32)}"

# =============================================================================
# Avvio servizi
# =============================================================================

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    step "Arresto servizi..."
    [[ -n "${BACKEND_PID:-}"  ]] && kill "$BACKEND_PID"  2>/dev/null || true
    [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

step "Avvio backend su http://localhost:$BACKEND_PORT"
(
    cd "$BACKEND_DIR"
    export DATABASE_URL="sqlite:///./raspberry_dashboard.db"
    export DEVICES_CONFIG_PATH="../config/devices.yaml"
    export SSH_KEYS_DIR="../secrets/ssh"
    export CORS_ORIGINS="http://localhost:$FRONTEND_PORT"
    export JWT_SECRET_KEY="$JWT_SECRET"
    export ADMIN_USERNAME="admin"
    export ADMIN_PASSWORD="admin"
    "$VENV_PY" -m uvicorn app.main:app --reload --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

step "Avvio frontend su http://localhost:$FRONTEND_PORT"
(
    cd "$FRONTEND_DIR"
    export VITE_API_BASE_URL="http://localhost:$BACKEND_PORT"
    npm run dev -- --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

ok ""
ok "Pronto."
ok "  Backend : http://localhost:$BACKEND_PORT  (docs: /docs)"
ok "  Frontend: http://localhost:$FRONTEND_PORT"
warn "  Login (sviluppo): admin / admin"
echo "Premi Ctrl+C per fermare i servizi."

wait
