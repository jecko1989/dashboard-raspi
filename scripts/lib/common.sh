#!/usr/bin/env bash
# =============================================================================
# RPi Dashboard - Libreria condivisa per gli script di deploy
# =============================================================================
# Fornisce: logging, controlli preliminari, opzioni SSH sicure, esecuzione
# remota, health check e helper per il dry-run. Da "source" negli script.
# =============================================================================

# --- Logging -----------------------------------------------------------------
# Colori solo se stdout e' un terminale.
if [[ -t 1 ]]; then
  _C_RESET=$'\033[0m'; _C_BLUE=$'\033[34m'; _C_YELLOW=$'\033[33m'
  _C_RED=$'\033[31m'; _C_GREEN=$'\033[32m'; _C_DIM=$'\033[2m'
else
  _C_RESET=""; _C_BLUE=""; _C_YELLOW=""; _C_RED=""; _C_GREEN=""; _C_DIM=""
fi

log_info()  { printf '%s[info]%s  %s\n' "$_C_BLUE" "$_C_RESET" "$*"; }
log_ok()    { printf '%s[ ok ]%s  %s\n' "$_C_GREEN" "$_C_RESET" "$*"; }
log_warn()  { printf '%s[warn]%s  %s\n' "$_C_YELLOW" "$_C_RESET" "$*" >&2; }
log_error() { printf '%s[err ]%s  %s\n' "$_C_RED" "$_C_RESET" "$*" >&2; }
log_dry()   { printf '%s[dry ]%s  %s\n' "$_C_DIM" "$_C_RESET" "$*"; }
die()       { log_error "$*"; exit 1; }

# --- Dry-run -----------------------------------------------------------------
DRY_RUN="${DRY_RUN:-false}"

# Esegue un comando locale, oppure lo stampa soltanto in dry-run.
run_local() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "local: $*"
    return 0
  fi
  "$@"
}

# --- Controlli preliminari ---------------------------------------------------
# Verifica che un comando locale sia disponibile.
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Comando locale mancante: '$1'. Installalo e riprova."
}

# Verifica che le variabili elencate siano valorizzate.
require_vars() {
  local missing=()
  local name
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    die "Variabili obbligatorie mancanti: ${missing[*]} (controlla il file --env-file)."
  fi
}

# Carica un env-file in modo sicuro (senza eseguire codice arbitrario diverso
# da assegnazioni) ed esporta le variabili.
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || die "File di configurazione non trovato: $file"
  # Consenti solo righe VAR=... (o commenti/vuote): evita esecuzione di comandi.
  local bad
  bad="$(grep -vE '^[[:space:]]*(#.*)?$|^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$file" || true)"
  if [[ -n "$bad" ]]; then
    die "Il file $file contiene righe non valide (ammesse solo assegnazioni VAR=...)."
  fi
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

# Valida che DEPLOY_PATH sia un percorso assoluto sensato (non vuoto, non "/").
validate_deploy_path() {
  local p="${DEPLOY_PATH:-}"
  [[ -n "$p" ]] || die "DEPLOY_PATH non impostato."
  [[ "$p" == /* ]] || die "DEPLOY_PATH deve essere un percorso assoluto: '$p'."
  case "$p" in
    "/"|"/root"|"/home"|"/etc"|"/usr"|"/bin"|"/boot"|"/var"|"/opt")
      die "DEPLOY_PATH troppo pericoloso: '$p'." ;;
  esac
}

# --- SSH sicuro --------------------------------------------------------------
# Costruisce l'array SSH_OPTS. Non disabilita MAI la verifica dell'host key.
SSH_BIN="ssh"
SCP_BIN="scp"
SSH_OPTS=()
SCP_OPTS=()

is_windows_shell() {
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

select_ssh_binaries() {
  SSH_BIN="ssh"
  SCP_BIN="scp"

  if is_windows_shell; then
    local win_ssh="/c/Windows/System32/OpenSSH/ssh.exe"
    local win_scp="/c/Windows/System32/OpenSSH/scp.exe"
    [[ -x "$win_ssh" ]] && SSH_BIN="$win_ssh"
    [[ -x "$win_scp" ]] && SCP_BIN="$win_scp"
  fi
}

build_ssh_opts() {
  select_ssh_binaries
  SSH_OPTS=( -p "${DEPLOY_PORT:-22}" -o BatchMode=yes -o ConnectTimeout=10 )
  SCP_OPTS=( -P "${DEPLOY_PORT:-22}" -o BatchMode=yes -o ConnectTimeout=10 )
  if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then
    [[ -f "$SSH_IDENTITY_FILE" ]] || die "SSH_IDENTITY_FILE non trovato: $SSH_IDENTITY_FILE"
    SSH_OPTS+=( -i "$SSH_IDENTITY_FILE" )
    SCP_OPTS+=( -i "$SSH_IDENTITY_FILE" )
  fi
  if [[ -n "${SSH_KNOWN_HOSTS_FILE:-}" ]]; then
    SSH_OPTS+=( -o "UserKnownHostsFile=${SSH_KNOWN_HOSTS_FILE}" -o "StrictHostKeyChecking=yes" )
    SCP_OPTS+=( -o "UserKnownHostsFile=${SSH_KNOWN_HOSTS_FILE}" -o "StrictHostKeyChecking=yes" )
  fi
}

# Target user@host.
ssh_target() { printf '%s@%s' "${DEPLOY_USER}" "${DEPLOY_HOST}"; }

# Esegue un comando remoto (stringa). In dry-run lo stampa soltanto.
ssh_exec() {
  local cmd="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "ssh $(ssh_target): $cmd"
    return 0
  fi
  "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" "$cmd"
}

# Come ssh_exec ma esegue sempre (anche in dry-run): per sole letture/verifiche.
ssh_probe() {
  "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" "$1"
}

# Verifica la raggiungibilita' SSH.
check_ssh() {
  log_info "Verifica connessione SSH a $(ssh_target) (porta ${DEPLOY_PORT:-22})..."
  if "$SSH_BIN" "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$(ssh_target)" "true" 2>/dev/null; then
    log_ok "Connessione SSH riuscita."
  else
    die "SSH non raggiungibile. Verifica host/porta/chiave e che l'host sia in known_hosts (vedi docs/DEPLOYMENT.md)."
  fi
}

# --- Trasferimento file ------------------------------------------------------
# Esclusioni comuni: mai trasferire git, dipendenze ricostruibili, segreti,
# config personale, artefatti e file dell'IDE.
TRANSFER_EXCLUDE_PATTERNS=(
  ".git"
  ".gitignore"
  ".github"
  "node_modules"
  "dist"
  "build"
  "__pycache__"
  "*.py[cod]"
  ".venv"
  "venv"
  ".pytest_cache"
  ".mypy_cache"
  "*.db"
  "*.sqlite"
  "*.sqlite3"
  ".env"
  "*.env"
  "secrets"
  "config/devices.yaml"
  "*.pem"
  "*.key"
  "id_*"
  "*.ovpn"
  ".vscode"
  ".idea"
  ".DS_Store"
  "*.log"
  "tsconfig.tsbuildinfo"
)
RSYNC_EXCLUDES=()
TAR_EXCLUDES=()
for _pattern in "${TRANSFER_EXCLUDE_PATTERNS[@]}"; do
  RSYNC_EXCLUDES+=( --exclude "${_pattern}" )
  TAR_EXCLUDES+=( "--exclude=${_pattern}" )
done
unset _pattern

tar_dir_to_remote() {
  local src="$1" dest="$2"

  [[ -d "$src" ]] || die "Il fallback tar+ssh richiede una directory sorgente: '$src'."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "tar+ssh $src -> $(ssh_target):$dest"
    return 0
  fi

  ssh_exec "mkdir -p '$dest'"
  tar -czf - "${TAR_EXCLUDES[@]}" -C "$src" . | \
    "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" "tar -xzf - -C '$dest'"
}

copy_file_to_remote() {
  local src="$1" dest="$2"

  [[ -f "$src" ]] || die "File sorgente non trovato: '$src'."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "scp $src -> $(ssh_target):$dest"
    return 0
  fi

  ssh_exec "mkdir -p '$(dirname "$dest")'"
  "$SCP_BIN" "${SCP_OPTS[@]}" "$src" "$(ssh_target):$dest"
}

# Sincronizza una sorgente locale verso una destinazione remota.
# NON usa --delete: preserva i file presenti solo sul server (es. .env, secrets).
rsync_to_remote() {
  local src="$1" dest="$2"
  shift 2
  local extra=( "$@" )

  if is_windows_shell; then
    log_info "Shell Windows rilevata: uso fallback tar+ssh per '$src'."
    tar_dir_to_remote "$src" "$dest"
    return 0
  fi

  local ssh_cmd="${SSH_BIN} ${SSH_OPTS[*]}"
  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "rsync $src -> $(ssh_target):$dest"
    rsync -azn --human-readable -e "$ssh_cmd" "${RSYNC_EXCLUDES[@]}" "${extra[@]}" \
      "$src" "$(ssh_target):$dest" || true
    return 0
  fi
  rsync -az --human-readable -e "$ssh_cmd" "${RSYNC_EXCLUDES[@]}" "${extra[@]}" \
    "$src" "$(ssh_target):$dest"
}

# --- Health check ------------------------------------------------------------
# Interroga HEALTHCHECK_URL SUL Raspberry (via SSH) con piu' tentativi.
remote_healthcheck() {
  local url="${HEALTHCHECK_URL:?HEALTHCHECK_URL non impostato}"
  local retries="${HEALTHCHECK_RETRIES:-15}"
  local delay="${HEALTHCHECK_DELAY:-4}"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "health check: curl $url (x$retries)"
    return 0
  fi

  log_info "Health check su $url (max $retries tentativi)..."
  local i
  for (( i=1; i<=retries; i++ )); do
    if ssh_probe "curl -fsS --max-time 5 '$url' >/dev/null 2>&1"; then
      log_ok "Servizio sano dopo $i tentativi."
      return 0
    fi
    sleep "$delay"
  done
  log_error "Health check fallito dopo $retries tentativi."
  return 1
}
