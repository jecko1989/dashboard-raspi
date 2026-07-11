# Cartella chiavi SSH

Questa cartella deve contenere le **chiavi private SSH** usate dal backend per
connettersi ai Raspberry Pi. Viene montata in sola lettura nel container backend
su `/secrets/ssh` (vedi `docker-compose.yml`).

## Cosa fare

1. Genera o copia qui le chiavi private, una per device (o una condivisa), es:
   - `id_rpi_casa_mia`
   - `id_rpi_casa_suocero`
   - `id_rpi_casa_sorella`
   - `id_rpi_casa_madre`
2. Assicurati che i permessi siano restrittivi:
   ```bash
   chmod 600 secrets/ssh/id_rpi_*
   ```
3. I path corrispondenti sono referenziati in `config/devices.yaml` tramite
   `${SSH_KEYS_DIR}/<nome_chiave>`.

## IMPORTANTE

- Questa cartella è in `.gitignore`: **le chiavi non devono mai essere committate**.
- Non inserire qui password: si usa **solo autenticazione a chiave**.
- Le chiavi vengono usate dal backend per le connessioni SSH ai device
  (monitoraggio, comandi remoti e shell web): predisponi la struttura come sopra.
