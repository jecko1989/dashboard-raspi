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

# Esegue un comando locale, oppure lo stampa soltanto in dry-run. Limitato nel
# tempo (LOCAL_CMD_TIMEOUT, default 600s): su Windows/git-bash npm/vite/esbuild
# possono lasciare un processo figlio orfano che tiene aperta la pipe di
# output anche a build completata, bloccando lo script a tempo indeterminato.
run_local() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "local: $*"
    return 0
  fi
  with_timeout "${LOCAL_CMD_TIMEOUT:-600}" "$@"
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

# 'timeout' (coreutils) non e' garantito ovunque (es. macOS senza coreutils):
# se assente esegue senza limite invece di far fallire lo script.
TIMEOUT_BIN=""
command -v timeout >/dev/null 2>&1 && TIMEOUT_BIN="timeout"

# Esegue un comando con un limite di tempo massimo (best-effort). ConnectTimeout
# di ssh protegge solo la connessione TCP iniziale: se la connessione cade in
# silenzio dopo (VPN/NAT che rinegozia il percorso), ssh puo' restare bloccato
# indefinitamente senza questo limite esterno.
with_timeout() {
  local secs="$1"; shift
  if [[ -n "$TIMEOUT_BIN" ]]; then
    "$TIMEOUT_BIN" "$secs" "$@"
  else
    "$@"
  fi
}

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
  # ServerAlive* rileva connessioni cadute in silenzio (VPN/NAT) durante fasi
  # lunghe senza traffico (pip/npm install, build): senza, ssh puo' restare
  # bloccato a tempo indeterminato invece di fallire con un errore chiaro.
  SSH_OPTS=( -p "${DEPLOY_PORT:-22}" -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o TCPKeepAlive=yes )
  SCP_OPTS=( -P "${DEPLOY_PORT:-22}" -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o TCPKeepAlive=yes )
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

# Ogni ssh_exec/ssh_probe apre una NUOVA connessione (nessun ControlMaster):
# la finestra tra "TCP connesso" e "sessione autenticata" (banner/KEX/auth) non
# e' coperta ne' da ConnectTimeout ne' da ServerAliveInterval (che vale solo a
# sessione stabilita). Senza un timeout esterno, una connessione che si blocca
# in quella finestra (es. VPN che rinegozia il percorso) appende lo script a
# tempo indeterminato.
#
# Due livelli: la maggior parte dei comandi remoti (mkdir, chmod, systemctl,
# ln, i probe di sola lettura) sono quasi istantanei, quindi un timeout breve
# li fa fallire in fretta con un errore chiaro. Il timeout lungo va passato
# esplicitamente solo ai comandi che richiedono legittimamente minuti (es.
# creazione venv + pip install) - usare 900s ovunque farebbe restare "appeso"
# fino a 15 minuti anche un semplice controllo che si blocca.
REMOTE_CMD_TIMEOUT="${REMOTE_CMD_TIMEOUT:-60}"
REMOTE_PROBE_TIMEOUT="${REMOTE_PROBE_TIMEOUT:-30}"
# Trasferimenti file (tar+ssh, scp, rsync): piu' margine dei comandi istantanei,
# ma senza arrivare ai 900s riservati esplicitamente al venv+pip install.
REMOTE_TRANSFER_TIMEOUT="${REMOTE_TRANSFER_TIMEOUT:-180}"

# Ritenta automaticamente solo sui fallimenti di TRASPORTO: exit 255 (ssh non
# riesce a stabilire/mantenere la connessione) o 124 (ucciso dal nostro
# with_timeout). Non ritenta un vero fallimento applicativo del comando remoto
# (il suo exit code passa attraverso invariato) per non nascondere errori reali.
SSH_RETRY_COUNT="${SSH_RETRY_COUNT:-2}"
SSH_RETRY_DELAY="${SSH_RETRY_DELAY:-3}"

ssh_run_with_retry() {
  local attempt=1 code
  while true; do
    # "&& code=0 || code=$?" (invece di "$@"; code=$?) e' necessario sotto
    # 'set -e': un comando fallito come statement diretto nel corpo di un
    # ciclo termina subito lo script, senza lasciarci leggere il suo exit code.
    "$@" && code=0 || code=$?
    if [[ "$code" -eq 0 || ( "$code" -ne 255 && "$code" -ne 124 ) ]]; then
      return "$code"
    fi
    if [[ "$attempt" -gt "$SSH_RETRY_COUNT" ]]; then
      return "$code"
    fi
    log_warn "Connessione SSH interrotta (exit $code): nuovo tentativo tra ${SSH_RETRY_DELAY}s ($attempt/${SSH_RETRY_COUNT})..."
    sleep "$SSH_RETRY_DELAY"
    attempt=$((attempt + 1))
  done
}

# Esegue un comando remoto (stringa). In dry-run lo stampa soltanto.
# Secondo argomento opzionale: timeout in secondi (default REMOTE_CMD_TIMEOUT)
# per i pochi comandi legittimamente lunghi (es. venv+pip install).
ssh_exec() {
  local cmd="$1"
  local timeout_secs="${2:-$REMOTE_CMD_TIMEOUT}"
  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "ssh $(ssh_target): $cmd"
    return 0
  fi
  ssh_run_with_retry with_timeout "$timeout_secs" "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" "$cmd"
}

# Come ssh_exec ma esegue sempre (anche in dry-run): per sole letture/verifiche
# rapide, quindi timeout breve (REMOTE_PROBE_TIMEOUT) non sovrascrivibile.
ssh_probe() {
  ssh_run_with_retry with_timeout "$REMOTE_PROBE_TIMEOUT" "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" "$1"
}

# Verifica la raggiungibilita' SSH.
check_ssh() {
  log_info "Verifica connessione SSH a $(ssh_target) (porta ${DEPLOY_PORT:-22})..."
  if with_timeout 20 "$SSH_BIN" "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$(ssh_target)" "true" 2>/dev/null; then
    log_ok "Connessione SSH riuscita."
  else
    die "SSH non raggiungibile entro 20s. Verifica host/porta/chiave, che l'host sia in known_hosts e lo stato della VPN/Tailscale (vedi docs/DEPLOYMENT.md)."
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
  # Il retry deve rilanciare tar+ssh insieme: se si ritenta solo la meta' ssh
  # della pipe, tar e' gia' terminato e non c'e' piu' nulla da leggere.
  _tar_pipe_to_remote() {
    tar -czf - "${TAR_EXCLUDES[@]}" -C "$src" . | \
      with_timeout "$REMOTE_TRANSFER_TIMEOUT" "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" "tar -xzf - -C '$dest'"
  }
  ssh_run_with_retry _tar_pipe_to_remote
}

copy_file_to_remote() {
  local src="$1" dest="$2"

  [[ -f "$src" ]] || die "File sorgente non trovato: '$src'."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "scp $src -> $(ssh_target):$dest"
    return 0
  fi

  ssh_exec "mkdir -p '$(dirname "$dest")'"
  ssh_run_with_retry with_timeout "$REMOTE_TRANSFER_TIMEOUT" "$SCP_BIN" "${SCP_OPTS[@]}" "$src" "$(ssh_target):$dest"
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
  ssh_run_with_retry with_timeout "$REMOTE_TRANSFER_TIMEOUT" rsync -az --human-readable -e "$ssh_cmd" "${RSYNC_EXCLUDES[@]}" "${extra[@]}" \
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
