#!/usr/bin/env bash
# =============================================================================
# RPi Dashboard - Deploy generico su Raspberry Pi (Tailscale o LAN)
# =============================================================================
# Orchestratore: interpreta gli argomenti, carica la configurazione, esegue i
# controlli preliminari e delega alla modalita' scelta (docker | native).
#
# Esempi:
#   ./scripts/deploy.sh --mode docker
#   ./scripts/deploy.sh --mode native --env-file deploy/deploy.env
#   ./scripts/deploy.sh --mode docker --dry-run
#
# La configurazione va in deploy/deploy.env (copia da deploy/deploy.env.example).
# Guida completa: docs/DEPLOYMENT.md
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"

# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# Trap per messaggi d'errore leggibili (senza esporre segreti).
trap 'log_error "Deploy interrotto (riga $LINENO). Nessuna azione distruttiva eseguita automaticamente."' ERR

# --- Valori di default (sovrascrivibili da env-file / CLI) --------------------
ENV_FILE="${REPO_ROOT}/deploy/deploy.env"
MODE=""
DRY_RUN="false"
SKIP_BUILD="false"
SKIP_HEALTHCHECK="false"

usage() {
  cat <<'EOF'
RPi Dashboard - deploy.sh

USO:
  ./scripts/deploy.sh --mode <docker|native> [opzioni]

OPZIONI:
  --mode <docker|native>   Modalita' di deploy (obbligatoria se non in env-file).
  --env-file <path>        File di configurazione (default: deploy/deploy.env).
  --dry-run                Mostra le azioni senza eseguirle.
  --skip-build             Salta la build (usa artefatti/immagini esistenti).
  --skip-healthcheck       Non eseguire l'health check finale (sconsigliato).
  --help                   Mostra questo aiuto.

CONFIGURAZIONE:
  Copia deploy/deploy.env.example in deploy/deploy.env e personalizzalo.
  L'autenticazione SSH e' solo a chiave: aggiungi l'host a ~/.ssh/known_hosts
  prima del primo deploy (vedi docs/DEPLOYMENT.md).
EOF
}

# --- Parsing argomenti -------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)            MODE="${2:-}"; shift 2 ;;
    --mode=*)          MODE="${1#*=}"; shift ;;
    --env-file)        ENV_FILE="${2:-}"; shift 2 ;;
    --env-file=*)      ENV_FILE="${1#*=}"; shift ;;
    --dry-run)         DRY_RUN="true"; shift ;;
    --skip-build)      SKIP_BUILD="true"; shift ;;
    --skip-healthcheck) SKIP_HEALTHCHECK="true"; shift ;;
    -h|--help)         usage; exit 0 ;;
    *) die "Opzione sconosciuta: '$1' (usa --help)." ;;
  esac
done

export DRY_RUN SKIP_BUILD SKIP_HEALTHCHECK REPO_ROOT SCRIPT_DIR

# --- Caricamento configurazione ----------------------------------------------
log_info "Configurazione: $ENV_FILE"
load_env_file "$ENV_FILE"

# La modalita' CLI ha precedenza; altrimenti usa DEPLOY_MODE dall'env-file.
MODE="${MODE:-${DEPLOY_MODE:-}}"
[[ -n "$MODE" ]] || die "Modalita' non specificata: usa --mode docker|native oppure DEPLOY_MODE."

require_vars DEPLOY_HOST DEPLOY_USER DEPLOY_PATH
validate_deploy_path
build_ssh_opts

log_info "Modalita': $MODE | Host: $(ssh_target) | Path: $DEPLOY_PATH | dry-run: $DRY_RUN"

# --- Controlli preliminari comuni --------------------------------------------
require_cmd "$SSH_BIN"
require_cmd "$SCP_BIN"
if is_windows_shell; then
  require_cmd tar
else
  require_cmd rsync
fi
check_ssh

# --- Dispatch ----------------------------------------------------------------
case "$MODE" in
  docker)
    # shellcheck source=scripts/deploy-docker.sh
    source "${SCRIPT_DIR}/deploy-docker.sh"
    deploy_docker
    ;;
  native)
    # shellcheck source=scripts/deploy-native.sh
    source "${SCRIPT_DIR}/deploy-native.sh"
    deploy_native
    ;;
  *)
    die "Modalita' non valida: '$MODE' (ammesse: docker, native)."
    ;;
esac

log_ok "Deploy completato ($MODE)."
