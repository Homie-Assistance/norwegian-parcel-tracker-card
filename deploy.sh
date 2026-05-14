#!/usr/bin/env bash
# deploy.sh — deploy the Norwegian Parcel Tracker card to a local HA instance.
#
# Run this script on the machine (or inside the VM/container) that hosts
# Home Assistant, e.g. via the HA Terminal add-on or an SSH session.
#
# Usage:
#   ./deploy.sh              — auto-detect paths, confirm, then deploy
#   ./deploy.sh --dry-run    — show what would happen without copying
#   ./deploy.sh --default    — skip existing-install detection; deploy to default dir

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_FILE="$SCRIPT_DIR/dist/norwegian-parcel-tracker-card.js"
DRY_RUN=false
FORCE_DEFAULT=false
for arg in "$@"; do
    [[ "$arg" == "--dry-run" ]]  && DRY_RUN=true
    [[ "$arg" == "--default" ]]  && FORCE_DEFAULT=true
done

# ── colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[info]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
die()     { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── verify source exists ──────────────────────────────────────────────────────
[[ -f "$SRC_FILE" ]] || die "Source file not found: $SRC_FILE"

# ── detect HA install type and config base ────────────────────────────────────
detect_ha_base() {
    # HassOS / HA OS terminal add-on  →  /homeassistant
    # Docker (mapped volume)          →  /config
    # HA Core / venv                  →  ~/.homeassistant  or $HASS_CONFIG
    local candidates=(
        "/homeassistant"
        "/config"
        "${HOME}/.homeassistant"
        "${HASS_CONFIG:-/nonexistent}"
    )
    for dir in "${candidates[@]}"; do
        if [[ -d "$dir" && ( -f "$dir/configuration.yaml" || -d "$dir/custom_components" ) ]]; then
            echo "$dir"
            return
        fi
    done
    echo ""
}

# ── detect install type label ─────────────────────────────────────────────────
detect_install_type() {
    local base="$1"
    if command -v ha &>/dev/null 2>&1; then
        local ha_info
        ha_info=$(ha core info 2>/dev/null || true)
        if echo "$ha_info" | grep -qi "haos\|hassio"; then
            echo "HA OS (HassOS)"; return
        fi
        echo "HA Supervised"; return
    fi
    if [[ -f /etc/os-release ]] && grep -qi "hassio\|haos" /etc/os-release 2>/dev/null; then
        echo "HA OS (HassOS)"; return
    fi
    if [[ "$base" == "/config" ]]; then
        echo "Docker / Container"; return
    fi
    if [[ "$base" == "/homeassistant" ]]; then
        echo "HA OS (HassOS)"; return
    fi
    echo "HA Core / unknown"
}

# ── detect HA version ─────────────────────────────────────────────────────────
detect_ha_version() {
    local base="$1"
    # .HA_VERSION is written by HA on every startup
    local ver_file="$base/.HA_VERSION"
    if [[ -f "$ver_file" ]]; then
        cat "$ver_file"
    else
        echo "unknown"
    fi
}

# ── find an already-installed copy of the card file ──────────────────────────
find_existing_install() {
    local www="$1"
    local filename
    filename="$(basename "$SRC_FILE")"
    # Search two levels deep under www (covers community/<name>/ and flat www/)
    find "$www" -maxdepth 3 -name "$filename" 2>/dev/null | head -1
}

# ── default (canonical) destination directory ─────────────────────────────────
default_dest_dir() {
    local www="$1"
    if [[ -d "$www/community" ]]; then
        # HACS: www/community/<github-repo-name>/
        echo "$www/community/norwegian-parcel-tracker-card"
    else
        # Standalone: www/<repo-name>/
        echo "$www/norwegian-parcel-tracker-card"
    fi
}

# ── interactive destination picker ───────────────────────────────────────────
pick_destination() {
    local www="$1"
    local filename
    filename="$(basename "$SRC_FILE")"

    local existing_file default_dir existing_dir
    existing_file="$(find_existing_install "$www")"
    default_dir="$(default_dest_dir "$www")"

    if [[ -n "$existing_file" ]]; then
        existing_dir="$(dirname "$existing_file")"
    fi

    # If --default flag was passed, skip the menu entirely.
    if $FORCE_DEFAULT || [[ -z "$existing_file" ]]; then
        echo "$default_dir"
        return
    fi

    # Existing install is already in the default location — no choice needed.
    if [[ "$existing_dir" == "$default_dir" ]]; then
        echo "$default_dir"
        return
    fi

    # Existing install is at a different path — offer a choice.
    echo "" >&2
    warn "Existing install found at a non-default location." >&2
    echo "" >&2
    echo "  [1] Overwrite existing install  →  $existing_dir/$filename" >&2
    echo "  [2] Install to default dir      →  $default_dir/$filename" >&2
    echo "  [3] Enter custom path" >&2
    echo "" >&2
    echo -n "  Choice [1/2/3, default 1]: " >&2
    read -r choice
    case "${choice:-1}" in
        2)
            echo "$default_dir" ;;
        3)
            echo -n "  Enter destination directory: " >&2
            read -r custom_dir
            [[ -n "$custom_dir" ]] || die "No path entered."
            echo "$custom_dir" ;;
        *)
            echo "$existing_dir" ;;
    esac
}

# ── read currently configured Lovelace resource URLs ─────────────────────────
detect_configured_urls() {
    local base="$1"
    local storage="$base/.storage/lovelace_resources"
    if [[ -f "$storage" ]]; then
        grep -o '"url":"[^"]*norwegian-parcel-tracker[^"]*"' "$storage" 2>/dev/null \
            | sed 's/"url":"//;s/"//' \
            || true
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Norwegian Parcel Tracker — card deployer"
echo "════════════════════════════════════════"

# 1. Find HA base
HA_BASE="$(detect_ha_base)"
if [[ -z "$HA_BASE" ]]; then
    warn "Could not auto-detect HA config directory."
    echo -n "  Enter path (e.g. /homeassistant or /config): "
    read -r HA_BASE
    [[ -d "$HA_BASE" ]] || die "Directory does not exist: $HA_BASE"
fi

HA_VERSION="$(detect_ha_version "$HA_BASE")"
INSTALL_TYPE="$(detect_install_type "$HA_BASE")"
info "Detected: $INSTALL_TYPE  (HA $HA_VERSION)"
info "Config base: $HA_BASE"

# 2. Locate www
WWW_DIR="$HA_BASE/www"
if [[ ! -d "$WWW_DIR" ]]; then
    warn "www directory not found at $WWW_DIR — will create it on deploy."
fi

# 3. Suggest destination
if [[ -d "$WWW_DIR/community" ]]; then
    info "HACS detected (www/community exists)"
else
    info "No HACS community directory — will deploy as standalone resource"
fi

DEST_DIR="$(pick_destination "$WWW_DIR")"
DEST_FILE="$DEST_DIR/$(basename "$SRC_FILE")"

# 4. Derive the /local URL
RELATIVE="${DEST_DIR#"$WWW_DIR"}"          # strip www prefix  e.g. /community/npt-card
RESOURCE_URL="/local${RELATIVE}/$(basename "$SRC_FILE")"

# 5. Check currently configured URLs
echo ""
CONFIGURED_URLS="$(detect_configured_urls "$HA_BASE")"
if [[ -n "$CONFIGURED_URLS" ]]; then
    info "Currently configured Lovelace resource URL(s) for this card:"
    while IFS= read -r url; do
        echo "    $url"
    done <<< "$CONFIGURED_URLS"
    echo ""
    if echo "$CONFIGURED_URLS" | grep -qF "$RESOURCE_URL"; then
        success "Detected URL matches proposed destination — good."
    else
        warn "Configured URL does not match proposed destination."
        warn "After deploying you may need to update the Lovelace resource URL."
    fi
fi

# 6. Confirm with user
echo ""
echo "  Source : $SRC_FILE"
echo "  Dest   : $DEST_FILE"
echo "  URL    : $RESOURCE_URL"
echo ""
if $DRY_RUN; then
    warn "Dry-run mode — no files will be changed."
else
    echo -n "Proceed? [y/N] "
    read -r answer
    [[ "$answer" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# 7. Deploy
if ! $DRY_RUN; then
    mkdir -p "$DEST_DIR"
    cp "$SRC_FILE" "$DEST_FILE"
    success "Copied to $DEST_FILE"
fi

# 8. Post-deploy instructions
echo ""
echo "════════════════════════════════════════"
echo " Next steps"
echo "════════════════════════════════════════"
echo ""
echo " 1. In HA → Settings → Dashboards → Resources, make sure this URL"
echo "    is listed as a JavaScript module:"
echo ""
echo "      $RESOURCE_URL"
echo ""
echo "    (Add a cache-busting suffix like ?v=1 if the browser still loads"
echo "     an old version after refreshing.)"
echo ""
echo " 2. Reload the Lovelace dashboard (three-dot menu → Reload resources),"
echo "    or do a hard-refresh in the browser."
echo ""
echo " 3. Card type to use in Lovelace YAML:  norwegian-parcel-tracking"
echo ""
