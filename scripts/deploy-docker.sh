#!/usr/bin/env bash
# =============================================================================
# RPi Dashboard - Deploy in modalita' Docker (docker compose V2)
# =============================================================================
# Trasferisce il progetto sul Raspberry (senza segreti ne' config personale),
# builda le immagini e (ri)avvia i container preservando i volumi persistenti.
# Da usare tramite scripts/deploy.sh (definisce la funzione deploy_docker).
# =============================================================================

deploy_docker() {
  require_vars FRONTEND_PORT BACKEND_PORT

  # --- Verifica prerequisiti remoti ------------------------------------------
  # Le due verifiche (docker, compose v2) accorpate in un'unica connessione SSH.
  log_info "Verifica Docker e Docker Compose V2 sul Raspberry..."
  if [[ "$DRY_RUN" != "true" ]]; then
    local docker_check
    docker_check="$(ssh_probe '
      command -v docker >/dev/null 2>&1 || { echo NODOCKER; exit 1; }
      docker compose version >/dev/null 2>&1 || { echo NOCOMPOSE; exit 2; }
      echo OK
    ')" || {
      if [[ "$docker_check" == NODOCKER* ]]; then
        die "Docker non installato sul Raspberry. Installalo (vedi docs/DEPLOYMENT.md) e riprova."
      elif [[ "$docker_check" == NOCOMPOSE* ]]; then
        die "Docker Compose V2 non disponibile ('docker compose'). Installa il plugin compose-v2."
      else
        die "Verifica Docker/Compose fallita."
      fi
    }
    log_ok "Docker e Compose V2 presenti."
  else
    log_dry "ssh $(ssh_target): verifica 'docker' e 'docker compose version'"
  fi

  # --- Prepara la directory di destinazione ----------------------------------
  ssh_exec "mkdir -p '${DEPLOY_PATH}'"

  # Avvisa se mancano i file forniti dall'operatore (non trasferiti dal deploy).
  # Le due verifiche accorpate in un'unica connessione SSH.
  if [[ "$DRY_RUN" != "true" ]]; then
    local files_check
    files_check="$(ssh_probe "
      [ -f '${DEPLOY_PATH}/.env' ] && echo ENV_OK || echo ENV_MISSING
      [ -f '${DEPLOY_PATH}/config/devices.yaml' ] && echo CFG_OK || echo CFG_MISSING
    ")"
    [[ "$files_check" == *ENV_MISSING* ]] && log_warn "Manca ${DEPLOY_PATH}/.env sul Raspberry: crealo prima di avviare (vedi docs/DEPLOYMENT.md)."
    [[ "$files_check" == *CFG_MISSING* ]] && log_warn "Manca ${DEPLOY_PATH}/config/devices.yaml: crealo dal template devices.example.yaml."
  fi

  # --- Trasferimento del progetto --------------------------------------------
  log_info "Trasferimento del progetto (rsync, senza segreti)..."
  rsync_to_remote "${REPO_ROOT}/" "${DEPLOY_PATH}/"

  # --- Build e avvio ---------------------------------------------------------
  # VITE_API_BASE_URL non e' piu' necessario: il frontend usa URL relativi e nginx
  # del container fa proxy di /api verso il backend.
  local compose_env="FRONTEND_PORT='${FRONTEND_PORT}' BACKEND_PORT='${BACKEND_PORT}'"
  local build_flag="--build"
  [[ "$SKIP_BUILD" == "true" ]] && build_flag=""

  log_info "Avvio dei container con docker compose..."
  # --remove-orphans pulisce i servizi non piu' definiti; NIENTE -v (preserva i dati).
  # Timeout esplicito lungo: la build immagini puo' richiedere diversi minuti,
  # specie su Raspberry Pi meno recenti.
  ssh_exec "cd '${DEPLOY_PATH}' && ${compose_env} docker compose up -d ${build_flag} --remove-orphans" "${REMOTE_BUILD_TIMEOUT:-900}"

  # --- Stato finale ----------------------------------------------------------
  if [[ "$DRY_RUN" != "true" ]]; then
    log_info "Stato dei container:"
    ssh_probe "cd '${DEPLOY_PATH}' && docker compose ps" || true
  fi

  # --- Health check ----------------------------------------------------------
  if [[ "$SKIP_HEALTHCHECK" == "true" ]]; then
    log_warn "Health check saltato su richiesta (--skip-healthcheck)."
    return 0
  fi
  if ! remote_healthcheck; then
    log_error "Il servizio non risponde. Controlla i log: 'cd ${DEPLOY_PATH} && docker compose logs --tail=100'."
    return 1
  fi
}
