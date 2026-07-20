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
  log_info "Verifica Docker e Docker Compose V2 sul Raspberry..."
  if [[ "$DRY_RUN" != "true" ]]; then
    ssh_probe "command -v docker >/dev/null 2>&1" \
      || die "Docker non installato sul Raspberry. Installalo (vedi docs/DEPLOYMENT.md) e riprova."
    ssh_probe "docker compose version >/dev/null 2>&1" \
      || die "Docker Compose V2 non disponibile ('docker compose'). Installa il plugin compose-v2."
    log_ok "Docker e Compose V2 presenti."
  else
    log_dry "ssh $(ssh_target): verifica 'docker' e 'docker compose version'"
  fi

  # --- Prepara la directory di destinazione ----------------------------------
  ssh_exec "mkdir -p '${DEPLOY_PATH}'"

  # Avvisa se mancano i file forniti dall'operatore (non trasferiti dal deploy).
  if [[ "$DRY_RUN" != "true" ]]; then
    ssh_probe "test -f '${DEPLOY_PATH}/.env'" \
      || log_warn "Manca ${DEPLOY_PATH}/.env sul Raspberry: crealo prima di avviare (vedi docs/DEPLOYMENT.md)."
    ssh_probe "test -f '${DEPLOY_PATH}/config/devices.yaml'" \
      || log_warn "Manca ${DEPLOY_PATH}/config/devices.yaml: crealo dal template devices.example.yaml."
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
  ssh_exec "cd '${DEPLOY_PATH}' && ${compose_env} docker compose up -d ${build_flag} --remove-orphans"

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
