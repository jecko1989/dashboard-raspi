#!/bin/sh
set -eu

MODE="${1:-}"
PWM_VALUE="${2:-}"

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

PWM_ENABLE="$(find_pwm_enable || true)"
if [ -z "$PWM_ENABLE" ]; then
  echo "Nessuna ventola PWM configurabile trovata" >&2
  exit 1
fi
PWM_BASE="${PWM_ENABLE%_enable}"

case "$MODE" in
  pwm)
    echo 2 > "$PWM_ENABLE"
    ;;
  fixed)
    case "$PWM_VALUE" in
      ''|*[!0-9]*)
        echo "Valore PWM non valido" >&2
        exit 1
        ;;
    esac
    if [ "$PWM_VALUE" -lt 0 ] || [ "$PWM_VALUE" -gt 255 ]; then
      echo "Valore PWM fuori range (0..255)" >&2
      exit 1
    fi
    echo 1 > "$PWM_ENABLE"
    echo "$PWM_VALUE" > "$PWM_BASE"
    ;;
  *)
    echo "Uso: dashboard-fan-control {pwm|fixed <0..255>}" >&2
    exit 2
    ;;
esac

exit 0
