class NorwegianParcelTrackingCard extends HTMLElement {
  constructor() {
    super();
    this._addMessage = "";
    this._addBusy = false;
  }

  setConfig(config) {
    this.config = {
      title: "Pakker",
      show_delivered: true,
      highlight_stuck: true,
      stale_hours: 24,
      critical_hours: 72,
      auto_entities: true,
      entities: [],
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 3;
  }

  render() {
    if (!this._hass) return;

    const cfg = this.config || {};
    const states = this._getParcelStates();
    const rows = states.map((s) => this.renderRow(s)).join("");

    this.innerHTML = `
      <ha-card>
        <div class="npt-card">
          <div class="npt-header">
            <div class="npt-title">${this._escape(cfg.title || "Pakker")}</div>
            <div class="npt-add">
              <button id="npt-add-btn" title="Legg til pakke" ${this._addBusy ? "disabled" : ""}>+</button>
            </div>
            ${this._addMessage ? `<div class="npt-add-message">${this._escape(this._addMessage)}</div>` : ""}
          </div>
          <div>${rows || `<div class="npt-empty">Ingen pakker å vise</div>`}</div>
        </div>
      </ha-card>
      <style>
        .npt-card { padding: 16px; }
        .npt-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
        .npt-title { font-size: 1.15rem; font-weight: 600; }
        .npt-add button { border: 0; border-radius: 6px; padding: 4px 10px; cursor: pointer; background: var(--primary-color); color: var(--text-primary-color); font-weight: 700; font-size: 1.1rem; }
        .npt-add button:disabled { opacity: 0.65; cursor: progress; }
        .npt-add-message { font-size: 0.8rem; opacity: 0.85; text-align: right; }
        .npt-row { margin: 8px 0; border-radius: 10px; padding: 12px; background: var(--secondary-background-color); color: var(--primary-text-color); border-left: 5px solid var(--divider-color); }
        .npt-row.delivered { background: #1f7a3f; color: #fff; border-left-color: #0b4f28; }
        .npt-row.warn { background: #b88700; color: #000; border-left-color: #6d5100; }
        .npt-row.critical { background: #8b1e1e; color: #fff; border-left-color: #4d0c0c; }
        .npt-main { display: flex; justify-content: space-between; gap: 8px; font-weight: 600; }
        .npt-meta { margin-top: 6px; font-size: 0.9rem; opacity: 0.95; line-height: 1.45; }
        .npt-empty { opacity: 0.7; }
        .npt-link { color: inherit; text-decoration: underline; }
      </style>
    `;
    this.querySelector("#npt-add-btn")?.addEventListener("click", () => this.addParcel());
  }

  _getParcelStates() {
    const cfg = this.config || {};
    const isMasterParcelStatus = (s) => {
      if (!s || !s.entity_id || !s.entity_id.startsWith("sensor.")) return false;
      const a = s.attributes || {};
      return a.npt_master_entity === true || a.parcel_tracker_entity === "status";
    };

    let states = [];
    if (Array.isArray(cfg.entities) && cfg.entities.length > 0) {
      states = cfg.entities
        .map((entityId) => this._hass.states[entityId])
        .filter(isMasterParcelStatus);
    } else {
      states = Object.values(this._hass.states).filter(isMasterParcelStatus);
    }

    return states
      .filter((s) => cfg.show_delivered !== false || !this._isDelivered(s.attributes || {}))
      .sort((a, b) => {
        const ta = new Date((a.attributes || {}).latest_event_time || 0).getTime();
        const tb = new Date((b.attributes || {}).latest_event_time || 0).getTime();
        return tb - ta;
      });
  }

  renderRow(state) {
    const a = state.attributes || {};
    const cls = this.rowClass(a);
    const sender = a.sender_name || a.tracking_number || state.name;
    const latest = a.latest_event || state.state;
    const status = a.status || state.state;
    const pickupValue = this._cleanPickup(a.pickup_name || a.pickup_display);
    const pickup = pickupValue ? `<div>Hentested: ${this._escape(pickupValue)}</div>` : "";
    const etaValue = this._cleanEta(a.estimated_delivery_iso || a.estimated_delivery);
    const eta = etaValue ? `<div>Estimert: ${this._escape(etaValue)}</div>` : "";
    const loc = a.latest_event_location ? `<div>Sist sett: ${this._escape(a.latest_event_location)}</div>` : "";
    const time = a.latest_event_time ? `<div>Tid: ${this._formatTime(a.latest_event_time)}</div>` : "";
    const home = a.home_delivery_url ? `<div><a class="npt-link" href="${this._escapeAttr(a.home_delivery_url)}" target="_blank" rel="noreferrer">Bestille hjemlevering</a></div>` : "";

    return `<div class="npt-row ${cls}">
      <div class="npt-main"><span>${this._escape(sender)}</span><span>${this._escape(status)}</span></div>
      <div class="npt-meta">
        <div>${this._escape(latest)}</div>
        ${loc}
        ${time}
        ${eta}
        ${pickup}
        ${home}
      </div>
    </div>`;
  }

  rowClass(attrs) {
    if (this._isDelivered(attrs)) return "delivered";
    if (this.config?.highlight_stuck === false) return "";

    const t = attrs.latest_event_time;
    if (!t) return "";

    const ageHours = (Date.now() - new Date(t).getTime()) / 36e5;
    const critical = Number(this.config?.critical_hours ?? 72);
    const stale = Number(this.config?.stale_hours ?? 24);

    if (critical > 0 && ageHours >= critical) return "critical";
    if (stale > 0 && ageHours >= stale) return "warn";
    return "";
  }

  _isDelivered(attrs) {
    if (attrs.is_delivered === true) return true;
    const text = `${attrs.status || ""} ${attrs.latest_event || ""} ${attrs.status_code || ""}`.toLowerCase();
    return text.includes("pakken er levert") || text.includes("delivered");
  }

  async addParcel() {
    if (this._addBusy) return;

    const tracking = window.prompt("Sporingsnummer:")?.trim();
    if (!tracking) return;

    this._addBusy = true;
    this._addMessage = "Legger til pakke…";
    this.render();

    try {
      await this._hass.callService("norwegian_parcel_tracker", "add_parcel", { tracking_number: tracking });
      this._addMessage = "Pakke lagt til. Det kan ta litt tid før den vises.";
    } catch (err) {
      this._addMessage = `Kunne ikke legge til pakke: ${err?.message || "ukjent feil"}`;
    } finally {
      this._addBusy = false;
      this.render();
      window.setTimeout(() => {
        this._addMessage = "";
        this.render();
      }, 5000);
    }
  }

  _cleanPickup(value) {
    if (!value) return "";
    const text = String(value).trim();
    // Keep in sync with _sanitize_pickup_name in norwegian-parcel-tracker (api.py)
    const bad = new Set([
      "expectedPickupUnitURL",
      "expectedPickupUnitUrl",
      "expectedPickupUnitId",
      "expectedPickupUnitName",
      "pickupPointInfo",
      "pickup-point",
      "Pickup not available",
      "Unknown",
      "unknown",
    ]);
    if (bad.has(text)) return "Hentested er ikke tilgjengelig for denne pakken";
    if (text.startsWith("http://") || text.startsWith("https://")) return "Hentested er ikke tilgjengelig for denne pakken";
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text) && !/\d/.test(text)) return "Hentested er ikke tilgjengelig for denne pakken";
    return text;
  }

  _cleanEta(value) {
    if (!value) return "";
    const text = String(value).trim();
    // Keep in sync with _sanitize_estimated_delivery / _looks_like_internal_key in norwegian-parcel-tracker (api.py)
    if (text === "estimatedTimeSpanOfDelivery" || text === "EstimatedTimeSpanOfDelivery") return "";
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text) && !/\d/.test(text)) return "";
    return text;
  }

  _formatTime(value) {
    try {
      return new Date(value).toLocaleString("no-NO", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_err) {
      return value;
    }
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  _escapeAttr(value) {
    return this._escape(value).replaceAll('"', "&quot;");
  }
}

if (!customElements.get("norwegian-parcel-tracking")) {
  customElements.define("norwegian-parcel-tracking", NorwegianParcelTrackingCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "norwegian-parcel-tracking",
  name: "Norwegian parcel tracking",
  description: "Shows parcels tracked by Norwegian parcel tracker.",
});
