#!/usr/bin/env bash
# =============================================================================
# RPi Dashboard - Deploy in modalita' nativa (senza Docker, systemd)
# =============================================================================
# Builda gli artefatti, trasferisce solo il necessario in una directory di
# release, prepara il virtualenv del backend e (ri)avvia un servizio systemd.
# Strategia di rollback: releases/ + symlink "current" con ripristino se
# l'health check fallisce. Da usare tramite scripts/deploy.sh.
#
# NON installa dipendenze di sistema automaticamente: se mancano, interrompe e
# indica cosa installare. Richiede sudo (idealmente NOPASSWD ristretto) sul Pi
# per gestire systemd e installare la unit (vedi docs/DEPLOYMENT.md).
# =============================================================================

deploy_native() {
  require_vars SERVICE_NAME SERVICE_USER BACKEND_PORT FRONTEND_PORT
  local template="${REPO_ROOT}/deploy/systemd/rpi-dashboard.service.template"
  [[ -f "$template" ]] || die "Template systemd mancante: $template"

  # --- Verifica prerequisiti remoti (senza installarli) ----------------------
  log_info "Verifica prerequisiti sul Raspberry (python3, venv, systemctl, sudo)..."
  if [[ "$DRY_RUN" != "true" ]]; then
    local missing=()
    ssh_probe "command -v python3 >/dev/null 2>&1" || missing+=("python3")
    ssh_probe "python3 -m venv --help >/dev/null 2>&1" || missing+=("python3-venv")
    ssh_probe "command -v systemctl >/dev/null 2>&1" || missing+=("systemd")
    ssh_probe "command -v sudo >/dev/null 2>&1" || missing+=("sudo")
    if (( ${#missing[@]} > 0 )); then
      log_error "Dipendenze di sistema mancanti sul Raspberry: ${missing[*]}"
      log_error "Installale manualmente, es.: sudo apt-get install -y python3 python3-venv"
      die "Deploy interrotto: prerequisiti mancanti."
    fi
    ssh_probe "sudo -n /usr/bin/install --version >/dev/null 2>&1 && sudo -n /usr/bin/systemctl --version >/dev/null 2>&1" \
      || die "La modalita' native richiede sudo non interattivo sul Raspberry per install/systemctl. Configura NOPASSWD mirato per l'utente di deploy oppure usa un utente gia' abilitato."
    log_ok "Prerequisiti presenti."
  else
    log_dry "ssh $(ssh_target): verifica python3 / venv / systemctl / sudo"
  fi

  # --- Build frontend (locale) -----------------------------------------------
  if [[ "$SKIP_BUILD" == "true" ]]; then
    log_warn "Build saltata (--skip-build): uso ${REPO_ROOT}/frontend/dist esistente."
  else
    require_cmd node
    require_cmd npm
    log_info "Build del frontend..."
    run_local bash -c "cd '${REPO_ROOT}/frontend' && npm install && npm run build"
  fi
  if [[ "$DRY_RUN" != "true" && ! -d "${REPO_ROOT}/frontend/dist" ]]; then
    die "Manca ${REPO_ROOT}/frontend/dist: esegui senza --skip-build."
  fi

  # --- Directory di release ---------------------------------------------------
  local stamp release
  stamp="$(date +%Y%m%d%H%M%S)"
  release="${DEPLOY_PATH}/releases/${stamp}"
  ssh_exec "mkdir -p '${release}/backend' '${release}/frontend' '${DEPLOY_PATH}/releases'"

  # Ricorda la release corrente (per il rollback).
  local previous=""
  if [[ "$DRY_RUN" != "true" ]]; then
    previous="$(ssh_probe "readlink -f '${DEPLOY_PATH}/current' 2>/dev/null || true")"
  fi

  # --- Trasferimento artefatti -----------------------------------------------
  log_info "Trasferimento backend e frontend (solo artefatti necessari)..."
  rsync_to_remote "${REPO_ROOT}/backend/" "${release}/backend/"
  rsync_to_remote "${REPO_ROOT}/frontend/dist/" "${release}/frontend/"
  ssh_exec "chmod -R a+rX '${release}/frontend'"

  # --- Virtualenv + dipendenze backend ---------------------------------------
  log_info "Creazione virtualenv e installazione dipendenze backend..."
  ssh_exec "cd '${release}/backend' && python3 -m venv .venv && ./.venv/bin/pip install --upgrade pip >/dev/null && ./.venv/bin/pip install -r requirements.txt"

  # --- Rendering e installazione della unit systemd --------------------------
  log_info "Preparazione unit systemd '${SERVICE_NAME}'..."
  local rendered
  rendered="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${rendered}'" RETURN
  sed \
    -e "s#__SERVICE_USER__#${SERVICE_USER}#g" \
    -e "s#__DEPLOY_PATH__#${DEPLOY_PATH}#g" \
    -e "s#__BACKEND_PORT__#${BACKEND_PORT}#g" \
    "$template" > "$rendered"

  copy_file_to_remote "$rendered" "${release}/${SERVICE_NAME}.service"
  ssh_exec "sudo install -m 0644 '${release}/${SERVICE_NAME}.service' '/etc/systemd/system/${SERVICE_NAME}.service'"
  ssh_exec "sudo systemctl daemon-reload"
  ssh_exec "sudo systemctl enable '${SERVICE_NAME}' >/dev/null 2>&1 || true"

  # --- Attiva la nuova release (symlink atomico) -----------------------------
  log_info "Attivazione release ${stamp}..."
  ssh_exec "ln -sfn '${release}' '${DEPLOY_PATH}/current'"
  ssh_exec "sudo systemctl restart '${SERVICE_NAME}'"

  # --- Health check + rollback -----------------------------------------------
  if [[ "$SKIP_HEALTHCHECK" == "true" ]]; then
    log_warn "Health check saltato su richiesta (--skip-healthcheck)."
  elif ! remote_healthcheck; then
    log_error "Health check fallito: avvio rollback."
    if [[ -n "$previous" && "$previous" != "$release" ]]; then
      ssh_exec "ln -sfn '${previous}' '${DEPLOY_PATH}/current'"
      ssh_exec "sudo systemctl restart '${SERVICE_NAME}'"
      log_warn "Rollback eseguito alla release precedente: ${previous}"
    else
      log_warn "Nessuna release precedente disponibile per il rollback."
    fi
    log_error "Controlla i log: 'sudo journalctl -u ${SERVICE_NAME} -n 100 --no-pager'."
    return 1
  fi

  # --- Stato servizio ---------------------------------------------------------
  if [[ "$DRY_RUN" != "true" ]]; then
    log_info "Stato del servizio:"
    ssh_probe "systemctl --no-pager --full status '${SERVICE_NAME}' | head -n 10" || true
  fi

  # --- Pulizia release vecchie (mantiene KEEP_RELEASES) ----------------------
  local keep="${KEEP_RELEASES:-5}"
  if [[ "$keep" =~ ^[0-9]+$ && "$keep" -ge 1 ]]; then
    log_info "Pulizia release oltre le ultime ${keep}..."
    # Elenca per nome (timestamp) e rimuove le eccedenti; mai la 'current'.
    ssh_exec "cd '${DEPLOY_PATH}/releases' && ls -1dt */ 2>/dev/null | tail -n +$((keep+1)) | xargs -r -I{} rm -rf -- '{}'"
  fi

  # --- Nginx config (aggiornamento automatico se NGINX_CONF_PATH e' impostato) ---
  if [[ -n "${NGINX_CONF_PATH:-}" ]]; then
    log_info "Aggiornamento config nginx: ${NGINX_CONF_PATH}..."
    local nginx_src rendered_nginx
    nginx_src="${REPO_ROOT}/deploy/nginx/dashboard-raspi.conf"
    rendered_nginx="$(mktemp)"
    # shellcheck disable=SC2064
    trap "rm -f '${rendered_nginx}'" RETURN
    sed \
      -e "s#__DEPLOY_PATH__#${DEPLOY_PATH}#g" \
      -e "s#__BACKEND_PORT__#${BACKEND_PORT}#g" \
      -e "s#__FRONTEND_PORT__#${FRONTEND_PORT}#g" \
      "$nginx_src" > "$rendered_nginx"
    # Usa stdin-piping + sudo tee: evita scp diretto verso /etc/ (Permission denied)
    # e non dipende dal path lookup di sudo install.
    # Richiede in sudoers NOPASSWD: /usr/bin/tee
    "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" \
      "sudo /usr/bin/tee '${NGINX_CONF_PATH}' >/dev/null" < "$rendered_nginx"
    # Se il config e' in sites-available, crea il symlink in sites-enabled.
    # Richiede in sudoers NOPASSWD: /usr/bin/ln
    if [[ "$NGINX_CONF_PATH" == */sites-available/* ]]; then
      local conf_name
      conf_name="$(basename "$NGINX_CONF_PATH")"
      ssh_exec "sudo /usr/bin/ln -sfn '${NGINX_CONF_PATH}' '/etc/nginx/sites-enabled/${conf_name}'"
    fi
    ssh_exec "sudo /usr/sbin/nginx -t && sudo /usr/bin/systemctl reload nginx"
    log_ok "Nginx aggiornato e ricaricato."
  else
    log_warn "NGINX_CONF_PATH non impostato: copia manualmente deploy/nginx/dashboard-raspi.conf sul Raspberry e ricarica nginx."
    log_info "Frontend statico in ${DEPLOY_PATH}/current/frontend."
  fi
}
