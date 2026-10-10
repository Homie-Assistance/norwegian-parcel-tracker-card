/**
 * Norwegian Parcel Tracker — Map Card
 *
 * Shows the current geocoded location of a tracked parcel on a map,
 * plus the recent event history list below it.
 *
 * Config:
 *   type: custom:norwegian-parcel-tracker-map-card
 *   entity: device_tracker.parcel_abc123_location   (device_tracker entity)
 *   title: "My parcel"                              (optional)
 *   history_rows: 5                                 (event rows shown, default 5)
 *
 * The card automatically finds the matching status sensor (same device)
 * to pull the recent_events list.
 */

const CARD_VERSION = "1.0.0";
const DEFAULT_HISTORY_ROWS = 5;
const DEFAULT_ZOOM = 11;

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_CSS = `
  :host {
    display: block;
  }
  ha-card {
    overflow: hidden;
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 4px;
    font-size: 1.1em;
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .card-header ha-icon {
    --mdi-icon-size: 20px;
    color: var(--state-active-color, var(--primary-color));
  }
  .map-wrapper {
    width: 100%;
    height: 260px;
    position: relative;
  }
  .map-wrapper ha-map {
    width: 100%;
    height: 100%;
  }
  .no-location {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 260px;
    color: var(--secondary-text-color);
    font-size: 0.9em;
    text-align: center;
    padding: 16px;
  }
  .events {
    padding: 8px 0 4px;
    border-top: 1px solid var(--divider-color);
  }
  .event-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 4px 16px;
    font-size: 0.85em;
    line-height: 1.3;
  }
  .event-date {
    color: var(--secondary-text-color);
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 100px;
  }
  .event-desc {
    color: var(--primary-text-color);
  }
  .event-loc {
    color: var(--secondary-text-color);
    margin-left: auto;
    white-space: nowrap;
  }
  .no-events {
    padding: 8px 16px 12px;
    color: var(--secondary-text-color);
    font-size: 0.85em;
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return iso.slice(0, 16).replace("T", " ");
  }
}

// ── Card element ──────────────────────────────────────────────────────────────

class NorwegianParcelTrackerMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._rendered = false;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("norwegian-parcel-tracker-map-card: 'entity' is required");
    }
    this._config = { history_rows: DEFAULT_HISTORY_ROWS, ...config };
    this._rendered = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _findStatusSensorEntity() {
    // device_tracker unique_id pattern: "<entry_id>_location"
    // status sensor unique_id pattern: "<entry_id>_status"
    // They share the same device (identifiers match), but we find by entity_id convention:
    // device_tracker.X_location → sensor.X_status (X is the tracking number slug)
    const dtId = this._config.entity;
    const states = this._hass.states;
    // Look for a sensor whose entity_id replaces 'device_tracker.' with 'sensor.'
    // and '_location' suffix with '_status'
    const candidate = dtId
      .replace(/^device_tracker\./, "sensor.")
      .replace(/_location$/, "_status");
    return states[candidate] || null;
  }

  _render() {
    if (!this._hass || !this._config.entity) return;

    const hass = this._hass;
    const dtState = hass.states[this._config.entity];
    const sensorState = this._findStatusSensorEntity();

    const lat = dtState?.attributes?.latitude ?? null;
    const lon = dtState?.attributes?.longitude ?? null;
    const hasLocation = lat !== null && lon !== null;
    const locationName = dtState?.attributes?.friendly_name || this._config.entity;
    const latestLoc = dtState?.attributes?.location_name || "";

    const recentEvents = sensorState?.attributes?.recent_events || [];
    const rows = recentEvents.slice(0, this._config.history_rows);

    const title = this._config.title ||
      (sensorState?.attributes?.friendly_name?.replace(/ Status$/, "") ?? "Parcel");

    // Avoid full re-render if only data changed (map stays mounted)
    if (!this._rendered) {
      this._buildShadow();
      this._rendered = true;
    }
    this._update(hasLocation, lat, lon, locationName, latestLoc, rows, title);
  }

  _buildShadow() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = CARD_CSS;

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="card-header">
        <ha-icon icon="mdi:map-marker-path"></ha-icon>
        <span class="card-title"></span>
      </div>
      <div class="map-wrapper">
        <div class="no-location" style="display:none"></div>
        <div class="ha-map-container" style="width:100%;height:100%"></div>
      </div>
      <div class="events"></div>
    `;

    root.appendChild(style);
    root.appendChild(card);
  }

  _update(hasLocation, lat, lon, locationName, latestLoc, rows, title) {
    const root = this.shadowRoot;

    const titleEl = root.querySelector(".card-title");
    if (titleEl) titleEl.textContent = title;

    const noLocEl = root.querySelector(".no-location");
    const mapContainer = root.querySelector(".ha-map-container");

    if (!hasLocation) {
      if (noLocEl) {
        noLocEl.style.display = "flex";
        noLocEl.textContent = "Location not available yet — waiting for the first geocoded event.";
      }
      if (mapContainer) mapContainer.style.display = "none";
    } else {
      if (noLocEl) noLocEl.style.display = "none";
      if (mapContainer) {
        mapContainer.style.display = "";
        this._updateMap(mapContainer, lat, lon, locationName, latestLoc);
      }
    }

    const eventsEl = root.querySelector(".events");
    if (eventsEl) this._updateEvents(eventsEl, rows);
  }

  _updateMap(container, lat, lon, locationName, latestLoc) {
    // Use ha-map if not already created, or update entities list
    let haMap = container.querySelector("ha-map");
    if (!haMap) {
      container.innerHTML = "";
      haMap = document.createElement("ha-map");
      haMap.style.width = "100%";
      haMap.style.height = "100%";
      container.appendChild(haMap);
    }

    const entityConfig = { entity: this._config.entity };
    haMap.hass = this._hass;
    haMap.entities = [entityConfig];
    haMap.zoom = DEFAULT_ZOOM;

    // ha-map renders the entity via hass + entities config
    // If ha-map is unavailable (older HA), fall back to a coordinate display
    if (typeof haMap.hass === "undefined") {
      container.innerHTML = "";
      const fb = document.createElement("div");
      fb.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:4px;color:var(--secondary-text-color);font-size:0.85em";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:map-marker");
      icon.style.setProperty("--mdi-icon-size", "32px");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = latestLoc || locationName;
      const coordSpan = document.createElement("span");
      coordSpan.style.fontSize = "0.8em";
      coordSpan.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      fb.append(icon, nameSpan, coordSpan);
      container.appendChild(fb);
    }
  }

  _updateEvents(container, rows) {
    container.innerHTML = "";
    if (rows.length === 0) {
      const noEv = document.createElement("div");
      noEv.className = "no-events";
      noEv.textContent = "No events recorded yet.";
      container.appendChild(noEv);
      return;
    }
    for (const ev of rows) {
      const row = document.createElement("div");
      row.className = "event-row";

      const date = document.createElement("span");
      date.className = "event-date";
      date.textContent = _formatDate(ev.date_iso);

      const desc = document.createElement("span");
      desc.className = "event-desc";
      desc.textContent = ev.description || ev.status || "";

      row.appendChild(date);
      row.appendChild(desc);

      if (ev.location) {
        const loc = document.createElement("span");
        loc.className = "event-loc";
        loc.textContent = ev.location;
        row.appendChild(loc);
      }
      container.appendChild(row);
    }
  }

  static getConfigElement() {
    // Visual editor not implemented — use YAML config
    return null;
  }

  static getStubConfig() {
    return { entity: "device_tracker.parcel_TRACKINGNUMBER_location" };
  }

  getCardSize() {
    return 5;
  }
}

customElements.define("norwegian-parcel-tracker-map-card", NorwegianParcelTrackerMapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "norwegian-parcel-tracker-map-card",
  name: "Norwegian Parcel Tracker — Map",
  description: "Shows the current parcel location on a map with recent event history.",
  preview: false,
  documentationURL: "https://github.com/Homie-Assistance/norwegian-parcel-tracker",
});
