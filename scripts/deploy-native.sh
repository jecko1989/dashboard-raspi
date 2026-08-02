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
    # Tutte le verifiche in un'unica connessione SSH per ridurre l'overhead di latenza.
    local prereq_result
    prereq_result="$(ssh_probe '
      missing=""
      command -v python3 >/dev/null 2>&1 || missing="$missing python3"
      python3 -m venv --help >/dev/null 2>&1 || missing="$missing python3-venv"
      command -v systemctl >/dev/null 2>&1 || missing="$missing systemd"
      command -v sudo >/dev/null 2>&1 || missing="$missing sudo"
      if [ -n "$missing" ]; then printf "MISSING:%s\n" "$missing"; exit 1; fi
      sudo -n /usr/bin/install --version >/dev/null 2>&1 && sudo -n /usr/bin/systemctl --version >/dev/null 2>&1 || { printf "NOSUDO\n"; exit 2; }
    ')" || {
      local exit_code=$?
      if [[ "$prereq_result" == NOSUDO* ]]; then
        die "La modalita' native richiede sudo non interattivo sul Raspberry per install/systemctl. Configura NOPASSWD mirato per l'utente di deploy oppure usa un utente gia' abilitato."
      elif [[ "$prereq_result" == MISSING:* ]]; then
        local missing_list="${prereq_result#MISSING:}"
        log_error "Dipendenze di sistema mancanti sul Raspberry:${missing_list}"
        log_error "Installale manualmente, es.: sudo apt-get install -y python3 python3-venv"
        die "Deploy interrotto: prerequisiti mancanti."
      else
        die "Verifica prerequisiti fallita (exit $exit_code)."
      fi
    }
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

  # --- Virtualenv + dipendenze backend ---------------------------------------
  log_info "Creazione virtualenv e installazione dipendenze backend..."
  # chmod frontend + venv/pip accorpati in una sola connessione SSH (meno
  # round-trip = meno occasioni di incappare in uno stallo di rete). Timeout
  # esplicito piu' lungo: unico comando che puo' legittimamente richiedere
  # diversi minuti (creazione venv + download/installazione pacchetti).
  ssh_exec "chmod -R a+rX '${release}/frontend' && cd '${release}/backend' && python3 -m venv .venv && ./.venv/bin/pip install --upgrade pip >/dev/null && ./.venv/bin/pip install -r requirements.txt" "${REMOTE_BUILD_TIMEOUT:-900}"

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

  # --- Installa la unit, ricarica systemd, abilita, attiva il symlink e
  # riavvia: tutto in una sola connessione SSH (meno round-trip = meno
  # occasioni di incappare in uno stallo di rete). L'enable resta non-fatale
  # come prima (puo' fallire innocuamente se gia' abilitato).
  log_info "Attivazione release ${stamp}..."
  ssh_exec "sudo install -m 0644 '${release}/${SERVICE_NAME}.service' '/etc/systemd/system/${SERVICE_NAME}.service' && sudo systemctl daemon-reload && { sudo systemctl enable '${SERVICE_NAME}' >/dev/null 2>&1 || true; } && ln -sfn '${release}' '${DEPLOY_PATH}/current' && sudo systemctl restart '${SERVICE_NAME}'"

  # --- Health check + rollback -----------------------------------------------
  if [[ "$SKIP_HEALTHCHECK" == "true" ]]; then
    log_warn "Health check saltato su richiesta (--skip-healthcheck)."
  elif ! remote_healthcheck; then
    log_error "Health check fallito: avvio rollback."
    if [[ -n "$previous" && "$previous" != "$release" ]]; then
      ssh_exec "ln -sfn '${previous}' '${DEPLOY_PATH}/current' && sudo systemctl restart '${SERVICE_NAME}'"
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
    # Richiede in sudoers NOPASSWD: /usr/bin/tee, /usr/bin/ln (se sites-available).
    # Tee + symlink opzionale + test/reload accorpati in una sola connessione SSH.
    local nginx_remote_cmd="sudo /usr/bin/tee '${NGINX_CONF_PATH}' >/dev/null"
    if [[ "$NGINX_CONF_PATH" == */sites-available/* ]]; then
      local conf_name
      conf_name="$(basename "$NGINX_CONF_PATH")"
      nginx_remote_cmd="${nginx_remote_cmd} && sudo /usr/bin/ln -sfn '${NGINX_CONF_PATH}' '/etc/nginx/sites-enabled/${conf_name}'"
    fi
    nginx_remote_cmd="${nginx_remote_cmd} && sudo /usr/sbin/nginx -t && sudo /usr/bin/systemctl reload nginx"
    if [[ "$DRY_RUN" == "true" ]]; then
      log_dry "ssh $(ssh_target): $nginx_remote_cmd (config da $rendered_nginx)"
    else
      ssh_run_with_retry with_timeout "$REMOTE_TRANSFER_TIMEOUT" "$SSH_BIN" "${SSH_OPTS[@]}" "$(ssh_target)" \
        "$nginx_remote_cmd" < "$rendered_nginx"
      log_ok "Nginx aggiornato e ricaricato."
    fi
  else
    log_warn "NGINX_CONF_PATH non impostato: copia manualmente deploy/nginx/dashboard-raspi.conf sul Raspberry e ricarica nginx."
    log_info "Frontend statico in ${DEPLOY_PATH}/current/frontend."
  fi
}
