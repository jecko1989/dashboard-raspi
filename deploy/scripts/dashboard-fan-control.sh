#!/bin/sh
set -eu

MODE="${1:-}"
PWM_VALUE="${2:-}"

PWM_CHIP_PATH="/sys/class/pwm/pwmchip0"
PWM_CHANNEL="0"
PWM_PERIOD_NS="40000"

# Override opzionale per schede madri con piu' ventole (es. desktop con Super
# I/O multi-canale), dove l'auto-detect non puo' sapere quale header e'
# collegato alla ventola CPU. Impostare in /etc/default/dashboard-fan-control:
#   PWM_CHIP_NAME=nct6797     # nome hwmon (cat /sys/class/hwmon/hwmon*/name)
#   PWM_CHANNEL_INDEX=2       # indice N di pwmN_enable/fanN_input
#   PWM_TEMP_SEL=2            # (opzionale) indice tempN da usare come sonda
#                             #   per la modalita' automatica (pwmN_temp_sel)
# Il nome chip e' usato invece del path hwmonN perche' l'indice hwmonN non e'
# stabile tra un boot e l'altro (dipende dall'ordine di caricamento driver).
[ -r /etc/default/dashboard-fan-control ] && . /etc/default/dashboard-fan-control

find_pwm_enable() {
  if [ -n "${PWM_CHIP_NAME:-}" ] && [ -n "${PWM_CHANNEL_INDEX:-}" ]; then
    for name_file in /sys/class/hwmon/hwmon*/name; do
      [ -r "$name_file" ] || continue
      [ "$(cat "$name_file")" = "$PWM_CHIP_NAME" ] || continue
      dir="${name_file%/name}"
      f="$dir/pwm${PWM_CHANNEL_INDEX}_enable"
      base="${f%_enable}"
      if [ -w "$f" ] && [ -w "$base" ]; then
        echo "$f"
        return 0
      fi
    done
    echo "PWM_CHIP_NAME=$PWM_CHIP_NAME canale $PWM_CHANNEL_INDEX non trovato o non scrivibile" >&2
    return 1
  fi

  # Auto-detect (nessun override configurato): preferisce un canale con una
  # ventola realmente collegata (RPM > 0 misurato ora, tipico dei desktop con
  # piu' header ma una sola ventola cablata), altrimenti il primo canale
  # scrivibile trovato (comportamento storico, corretto quando ne esiste uno
  # solo, come sui Raspberry).
  fallback=""
  for f in /sys/class/hwmon/hwmon*/pwm*_enable; do
    [ -w "$f" ] || continue
    base="${f%_enable}"
    [ -w "$base" ] || continue
    [ -z "$fallback" ] && fallback="$f"
    dir="${f%/*}"
    idx="${f##*/pwm}"
    idx="${idx%_enable}"
    fan_input="$dir/fan${idx}_input"
    if [ -r "$fan_input" ]; then
      rpm="$(cat "$fan_input" 2>/dev/null || echo 0)"
      if [ "${rpm:-0}" -gt 0 ] 2>/dev/null; then
        echo "$f"
        return 0
      fi
    fi
  done
  if [ -n "$fallback" ]; then
    echo "$fallback"
    return 0
  fi
  return 1
}

validate_pwm_value() {
  case "$1" in
    ''|*[!0-9]*)
      echo "Valore PWM non valido" >&2
      exit 1
      ;;
  esac
  if [ "$1" -lt 0 ] || [ "$1" -gt 255 ]; then
    echo "Valore PWM fuori range (0..255)" >&2
    exit 1
  fi
}

# Interfaccia hwmon (fan nativa Pi5, o dtoverlay=pwm-fan su Raspberry Pi OS):
# supporta sia modalita' automatica (termostatata dal kernel) sia fissa.
run_hwmon() {
  pwm_enable="$1"
  pwm_base="${pwm_enable%_enable}"
  case "$MODE" in
    pwm)
      # Se configurato, punta la curva automatica a una sonda di temperatura
      # sensata (es. CPUTIN) invece di quella di default del chip, spesso non
      # collegata a nulla di significativo sulle schede desktop multi-canale.
      if [ -n "${PWM_TEMP_SEL:-}" ]; then
        temp_sel_file="${pwm_base}_temp_sel"
        [ -w "$temp_sel_file" ] && echo "$PWM_TEMP_SEL" > "$temp_sel_file"
      fi
      echo 2 > "$pwm_enable"
      ;;
    fixed)
      validate_pwm_value "$PWM_VALUE"
      echo 1 > "$pwm_enable"
      echo "$PWM_VALUE" > "$pwm_base"
      ;;
    *)
      echo "Uso: dashboard-fan-control {pwm|fixed <0..255>}" >&2
      exit 2
      ;;
  esac
}

# Fallback su interfaccia PWM generica (es. Ubuntu su Pi4 via dtoverlay=pwm,
# dove manca l'overlay pwm-fan/hwmon dedicato). Nessuna modalita' automatica
# disponibile: manca il binding kernel verso la thermal zone, quindi non la
# si finge, si segnala esplicitamente.
run_pwmchip() {
  chan_path="$PWM_CHIP_PATH/pwm$PWM_CHANNEL"
  if [ ! -d "$chan_path" ]; then
    echo "$PWM_CHANNEL" > "$PWM_CHIP_PATH/export" 2>/dev/null || true
    i=0
    while [ ! -d "$chan_path" ] && [ "$i" -lt 10 ]; do
      sleep 0.1
      i=$((i + 1))
    done
  fi
  if [ ! -d "$chan_path" ]; then
    echo "Impossibile esportare il canale PWM" >&2
    exit 1
  fi

  case "$MODE" in
    fixed)
      validate_pwm_value "$PWM_VALUE"
      duty_ns=$((PWM_PERIOD_NS * PWM_VALUE / 255))
      echo 0 > "$chan_path/enable" 2>/dev/null || true
      echo "$PWM_PERIOD_NS" > "$chan_path/period"
      echo "$duty_ns" > "$chan_path/duty_cycle"
      echo 1 > "$chan_path/enable"
      ;;
    pwm)
      echo "Modalita' automatica non disponibile su questo device (nessun controller ventola hwmon): usa la modalita' fissa" >&2
      exit 1
      ;;
    *)
      echo "Uso: dashboard-fan-control {pwm|fixed <0..255>}" >&2
      exit 2
      ;;
  esac
}

PWM_ENABLE="$(find_pwm_enable || true)"
if [ -n "$PWM_ENABLE" ]; then
  run_hwmon "$PWM_ENABLE"
elif [ -d "$PWM_CHIP_PATH" ]; then
  run_pwmchip
else
  echo "Nessuna ventola PWM configurabile trovata" >&2
  exit 1
fi

exit 0
