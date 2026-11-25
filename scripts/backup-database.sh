#!/usr/bin/env bash
# Run on a dedicated, ephemeral Linux runner. Persist ciphertext only.
set -euo pipefail
umask 077
: "${BACKUP_DATABASE_URL:?Missing database connection secret}"
: "${BACKUP_PUBLIC_KEY:?Missing OpenPGP public key}"
: "${BACKUP_KEY_FINGERPRINT:?Missing recipient fingerprint}"
: "${RUNNER_TEMP:?Missing temporary directory}"
[[ -d /dev/shm && -w /dev/shm ]] || { echo 'A memory-backed scratch directory is required.' >&2; exit 1; }
work="$(mktemp -d /dev/shm/loopkit-export.XXXXXXXX)"
out="$RUNNER_TEMP/loopkit-backup"
mkdir -m 700 "$out"
completed=false
cleanup() {
  rm -rf -- "$work"
  if [[ "$completed" != true ]]; then rm -rf -- "$out"; fi
}
trap cleanup EXIT
export GNUPGHOME="$work/keyring"
mkdir -m 700 "$GNUPGHOME"
[[ "$BACKUP_KEY_FINGERPRINT" =~ ^([A-Fa-f0-9]{40}|[A-Fa-f0-9]{64})$ ]] || { echo 'Invalid recipient fingerprint.' >&2; exit 1; }
[[ "$BACKUP_PUBLIC_KEY" == *'BEGIN PGP PUBLIC KEY BLOCK'* && "$BACKUP_PUBLIC_KEY" != *'PRIVATE KEY BLOCK'* ]] || {
  echo 'Use an armored public certificate.' >&2; exit 1;
}
printf '%s\n' "$BACKUP_PUBLIC_KEY" | gpg --batch --quiet --import >/dev/null
gpg --batch --list-keys "${BACKUP_KEY_FINGERPRINT^^}" >/dev/null
export_dump() {
  local label=$1
  shift
  # The CLI writes connection diagnostics to stderr. Never publish those or SQL data.
  if ! supabase db dump --remote="$BACKUP_DATABASE_URL" "$@" -f "$work/$label.sql" 2>"$work/diagnostic" >/dev/null; then
    echo "Database export failed during $label. Check connection, CLI and runner scratch space." >&2
    exit 1
  fi
  test -s "$work/$label.sql"
  gzip -c "$work/$label.sql" | gpg --batch --yes --trust-model always --recipient "$BACKUP_KEY_FINGERPRINT" --encrypt --output "$out/$label.sql.gz.gpg"
  rm -f -- "$work/$label.sql" "$work/diagnostic"
}
export_dump roles --role-only
export_dump schema
export_dump data --data-only --use-copy -x storage.buckets_vectors -x storage.vector_indexes
(cd "$out" && sha256sum -- *.gpg > SHA256SUMS)
completed=true
