#!/bin/sh
set -eu

MODE="${1:-}"
PWM_VALUE="${2:-}"

PWM_CHIP_PATH="/sys/class/pwm/pwmchip0"
PWM_CHANNEL="0"
PWM_PERIOD_NS="40000"

find_pwm_enable() {
  for f in /sys/class/hwmon/hwmon*/pwm*_enable; do
    [ -w "$f" ] || continue
    base="${f%_enable}"
    [ -w "$base" ] || continue
    echo "$f"
    return 0
  done
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
