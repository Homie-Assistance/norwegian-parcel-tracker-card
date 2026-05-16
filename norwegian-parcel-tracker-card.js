// ── Translations ───────────────────────────────────────────────────────────────
const NPT_STRINGS = {
  nb: {
    title: "Pakker", addBtn: "Legg til pakke", addPrompt: "Sporingsnummer:",
    adding: "Legger til pakke…",
    addOk: "Pakke lagt til. Det kan ta litt tid.",
    addErr: "Feil", addErrUnknown: "ukjent feil",
    empty: "Ingen pakker å vise",
    pickup: "Hentested", pickupNA: "Hentested er ikke tilgjengelig for denne pakken",
    eta: "Estimert levering", lastSeen: "Sist sett", time: "Tid",
    orderHome: "Bestille hjemlevering",
    s: {
      title: "Innstillinger", language: "Språk",
      langNb: "Norsk", langEn: "English",
      colors: "Farger", colorNormal: "Normal rad", colorNormalTheme: "Bruk temafarge",
      colorStale: "Treg", colorCritical: "Kritisk (fast)", colorDelivered: "Levert",
      cardHeight: "Korthøyde", heightAuto: "Auto", heightFixed: "Fast (px)",
      showDelivered: "Vis leverte pakker", highlightStuck: "Fremhev trege pakker",
      staleHours: "Timer → treg", criticalHours: "Timer → kritisk",
      on: "På", off: "Av",
      save: "Lagre", cancel: "Avbryt",
    },
  },
  en: {
    title: "Parcels", addBtn: "Add parcel", addPrompt: "Tracking number:",
    adding: "Adding parcel…",
    addOk: "Parcel added. It may take a moment to appear.",
    addErr: "Error", addErrUnknown: "unknown error",
    empty: "No parcels to show",
    pickup: "Pickup", pickupNA: "Pickup location not available for this parcel",
    eta: "Estimated delivery", lastSeen: "Last seen", time: "Time",
    orderHome: "Order home delivery",
    s: {
      title: "Settings", language: "Language",
      langNb: "Norsk", langEn: "English",
      colors: "Colors", colorNormal: "Normal row", colorNormalTheme: "Use theme color",
      colorStale: "Stale", colorCritical: "Critical (stuck)", colorDelivered: "Delivered",
      cardHeight: "Card height", heightAuto: "Auto", heightFixed: "Fixed (px)",
      showDelivered: "Show delivered parcels", highlightStuck: "Highlight stuck parcels",
      staleHours: "Hours → stale", criticalHours: "Hours → critical",
      on: "On", off: "Off",
      save: "Save", cancel: "Cancel",
    },
  },
};

// ── Flag SVGs ─────────────────────────────────────────────────────────────────
const FLAG_NO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 16" width="22" height="16" style="display:inline;vertical-align:middle"><rect width="22" height="16" fill="#EF2B2D"/><rect x="6" width="4" height="16" fill="#fff"/><rect y="6" width="22" height="4" fill="#fff"/><rect x="7" width="2" height="16" fill="#002868"/><rect y="7" width="22" height="2" fill="#002868"/></svg>`;
const FLAG_EN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 16" width="22" height="16" style="display:inline;vertical-align:middle"><rect width="22" height="16" fill="#012169"/><path d="M0,0 L22,16 M22,0 L0,16" stroke="#fff" stroke-width="3.5"/><path d="M0,0 L22,16 M22,0 L0,16" stroke="#C8102E" stroke-width="1.8"/><rect x="8.5" width="5" height="16" fill="#fff"/><rect y="5.5" width="22" height="5" fill="#fff"/><rect x="9.5" width="3" height="16" fill="#C8102E"/><rect y="6.5" width="22" height="3" fill="#C8102E"/></svg>`;

// ─────────────────────────────────────────────────────────────────────────────
class NorwegianParcelTrackingCard extends HTMLElement {
  constructor() {
    super();
    this._addMessage = "";
    this._addBusy = false;
    this._showSettings = false;
    this._yamlConfig = null;
  }

  setConfig(config) {
    this._yamlConfig = config || {};
    this.config = this._getCfg();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._showSettings) this.render();
  }

  getCardSize() {
    const cfg = this._getCfg();
    if (cfg.card_height === "fixed" && Number(cfg.card_height_px) > 0) {
      return Math.ceil(Number(cfg.card_height_px) / 50);
    }
    return 3;
  }

  // ── Config helpers ───────────────────────────────────────────────────────────

  _storageKey() {
    return `npt_card_${this._yamlConfig?.title ?? "Pakker"}`;
  }

  _loadStored() {
    try {
      const r = localStorage.getItem(this._storageKey());
      return r ? JSON.parse(r) : {};
    } catch { return {}; }
  }

  _patchStored(patch) {
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify({ ...this._loadStored(), ...patch }));
    } catch {}
  }

  _getCfg() {
    return {
      title: "Pakker",
      language: "nb",
      show_delivered: true,
      highlight_stuck: true,
      stale_hours: 24,
      critical_hours: 72,
      auto_entities: true,
      entities: [],
      color_normal: "",
      color_stale: "#b88700",
      color_critical: "#8b1e1e",
      color_delivered: "#1f7a3f",
      card_height: "auto",
      card_height_px: 400,
      ...(this._yamlConfig || {}),
      ...this._loadStored(),
    };
  }

  _str(key) {
    const lang = this._getCfg().language;
    const dict = NPT_STRINGS[lang] || NPT_STRINGS.nb;
    return key.split(".").reduce((o, k) => o?.[k], dict) ?? key;
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  render() {
    if (!this._hass) return;
    const cfg = this._getCfg();
    const states = this._getParcelStates(cfg);
    const rows = states.map((s) => this._renderRow(s, cfg)).join("");
    const flagSvg = cfg.language === "en" ? FLAG_EN : FLAG_NO;

    const normalColor = this._safeColor(cfg.color_normal, "");
    const cssVars = [
      normalColor ? `--npt-normal:${normalColor};` : "",
      `--npt-stale:${this._safeColor(cfg.color_stale, "#b88700")};`,
      `--npt-critical:${this._safeColor(cfg.color_critical, "#8b1e1e")};`,
      `--npt-delivered:${this._safeColor(cfg.color_delivered, "#1f7a3f")};`,
    ].join("");

    const bodyStyle = cfg.card_height === "fixed" && Number(cfg.card_height_px) > 0
      ? `max-height:${cfg.card_height_px}px;overflow-y:auto;` : "";

    this.innerHTML = `
      <ha-card style="${cssVars}">
        <div class="npt-card">
          <div class="npt-header">
            <div class="npt-title">${this._escape(cfg.title)}</div>
            <div class="npt-actions">
              <button id="npt-flag-btn" class="npt-icon-btn npt-flag-btn" title="${cfg.language === "nb" ? "Norsk" : "English"}">${flagSvg}</button>
              <button id="npt-settings-btn" class="npt-icon-btn" title="${this._str("s.title")}">⚙</button>
              <button id="npt-add-btn" class="npt-icon-btn npt-add-icon" title="${this._str("addBtn")}" ${this._addBusy ? "disabled" : ""}>+</button>
            </div>
          </div>
          ${this._addMessage ? `<div class="npt-msg">${this._escape(this._addMessage)}</div>` : ""}
          <div style="${bodyStyle}">${rows || `<div class="npt-empty">${this._str("empty")}</div>`}</div>
        </div>
      </ha-card>
      ${this._styles()}
    `;

    this.querySelector("#npt-add-btn")?.addEventListener("click", () => this._addParcel());
    this.querySelector("#npt-settings-btn")?.addEventListener("click", () => this._openSettings());
    this.querySelector("#npt-flag-btn")?.addEventListener("click", () => this._toggleLang());
  }

  _renderRow(state, cfg) {
    const a = state.attributes || {};
    const cls = this._rowClass(a, cfg);
    const sender = a.sender_name || a.tracking_number || state.name;
    const latest = a.latest_event || state.state;
    const status = a.status || state.state;
    const pickupValue = this._cleanPickup(a.pickup_name || a.pickup_display);
    const pickup = pickupValue ? `<div>${this._str("pickup")}: ${this._escape(pickupValue)}</div>` : "";
    const etaValue = this._cleanEta(a.estimated_delivery_iso || a.estimated_delivery);
    const eta = etaValue ? `<div>${this._str("eta")}: ${this._escape(etaValue)}</div>` : "";
    const loc = a.latest_event_location ? `<div>${this._str("lastSeen")}: ${this._escape(a.latest_event_location)}</div>` : "";
    const time = a.latest_event_time ? `<div>${this._str("time")}: ${this._formatTime(a.latest_event_time)}</div>` : "";
    const homeUrl = this._safeUrl(a.home_delivery_url);
    const home = homeUrl
      ? `<div><a class="npt-link" href="${this._escapeAttr(homeUrl)}" target="_blank" rel="noreferrer">${this._str("orderHome")}</a></div>`
      : "";

    return `<div class="npt-row ${cls}">
      <div class="npt-main"><span>${this._escape(sender)}</span><span>${this._escape(status)}</span></div>
      <div class="npt-meta"><div>${this._escape(latest)}</div>${loc}${time}${eta}${pickup}${home}</div>
    </div>`;
  }

  // ── Settings panel ───────────────────────────────────────────────────────────

  _openSettings() {
    this._showSettings = true;
    this._renderSettings();
  }

  _renderSettings() {
    const cfg = this._getCfg();
    const s = (NPT_STRINGS[cfg.language] || NPT_STRINGS.nb).s;

    const toggle = (id, val, label) => `
      <div class="npt-srow">
        <div class="npt-slabel">${label}</div>
        <div class="npt-toggle-wrap">
          <button class="npt-toggle ${val ? "on" : ""}" data-tid="${id}" data-tval="true">${s.on}</button>
          <button class="npt-toggle ${!val ? "on" : ""}" data-tid="${id}" data-tval="false">${s.off}</button>
        </div>
      </div>`;

    const useTheme = !cfg.color_normal;

    this.innerHTML = `
      <ha-card>
        <div class="npt-card">
          <div class="npt-header">
            <div class="npt-title">${s.title}</div>
            <button id="npt-close" class="npt-icon-btn" title="${s.cancel}">✕</button>
          </div>
          <div class="npt-settings">

            <div class="npt-ssec">${s.language}</div>
            <div class="npt-srow npt-lang-row">
              <button class="npt-lang-btn ${cfg.language === "nb" ? "on" : ""}" data-lang="nb">${FLAG_NO}&nbsp;${s.langNb}</button>
              <button class="npt-lang-btn ${cfg.language === "en" ? "on" : ""}" data-lang="en">${FLAG_EN}&nbsp;${s.langEn}</button>
            </div>

            <div class="npt-ssec">${s.colors}</div>
            <div class="npt-srow">
              <label class="npt-slabel">${s.colorNormal}</label>
              <div class="npt-color-wrap">
                <input type="color" id="clr-normal" value="${cfg.color_normal || "#2d2d2d"}" ${useTheme ? "disabled" : ""} style="opacity:${useTheme ? 0.35 : 1}">
                <label class="npt-theme-check"><input type="checkbox" id="clr-normal-theme" ${useTheme ? "checked" : ""}>&nbsp;${s.colorNormalTheme}</label>
              </div>
            </div>
            <div class="npt-srow">
              <label class="npt-slabel">${s.colorStale}</label>
              <input type="color" id="clr-stale" value="${cfg.color_stale || "#b88700"}">
            </div>
            <div class="npt-srow">
              <label class="npt-slabel">${s.colorCritical}</label>
              <input type="color" id="clr-critical" value="${cfg.color_critical || "#8b1e1e"}">
            </div>
            <div class="npt-srow">
              <label class="npt-slabel">${s.colorDelivered}</label>
              <input type="color" id="clr-delivered" value="${cfg.color_delivered || "#1f7a3f"}">
            </div>

            <div class="npt-ssec">${s.cardHeight}</div>
            <div class="npt-srow">
              <div class="npt-toggle-wrap">
                <button class="npt-toggle ${cfg.card_height !== "fixed" ? "on" : ""}" data-height="auto">${s.heightAuto}</button>
                <button class="npt-toggle ${cfg.card_height === "fixed" ? "on" : ""}" data-height="fixed">${s.heightFixed}</button>
              </div>
              <input type="number" id="height-px" value="${cfg.card_height_px || 400}" min="100" max="2000"
                class="npt-num-input" style="visibility:${cfg.card_height === "fixed" ? "visible" : "hidden"}">
            </div>

            <div class="npt-ssec"></div>
            ${toggle("show_delivered", cfg.show_delivered !== false, s.showDelivered)}
            ${toggle("highlight_stuck", cfg.highlight_stuck !== false, s.highlightStuck)}

            <div class="npt-ssec"></div>
            <div class="npt-srow">
              <label class="npt-slabel">${s.staleHours}</label>
              <input type="number" id="stale-hours" value="${cfg.stale_hours ?? 24}" min="1" max="999" class="npt-num-input">
            </div>
            <div class="npt-srow">
              <label class="npt-slabel">${s.criticalHours}</label>
              <input type="number" id="critical-hours" value="${cfg.critical_hours ?? 72}" min="1" max="999" class="npt-num-input">
            </div>

            <div class="npt-footer">
              <button id="npt-save" class="npt-btn-pri">${s.save}</button>
              <button id="npt-cancel" class="npt-btn-sec">${s.cancel}</button>
            </div>
          </div>
        </div>
      </ha-card>
      ${this._styles()}
    `;

    // Language buttons
    this.querySelectorAll(".npt-lang-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.querySelectorAll(".npt-lang-btn").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
      });
    });

    // Toggle buttons (on/off)
    this.querySelectorAll(".npt-toggle[data-tid]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tid;
        this.querySelectorAll(`.npt-toggle[data-tid="${id}"]`).forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
      });
    });

    // Height toggle
    this.querySelectorAll(".npt-toggle[data-height]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.querySelectorAll(".npt-toggle[data-height]").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        const px = this.querySelector("#height-px");
        if (px) px.style.visibility = btn.dataset.height === "fixed" ? "visible" : "hidden";
      });
    });

    // Normal color theme checkbox
    const themeChk = this.querySelector("#clr-normal-theme");
    const clrNorm = this.querySelector("#clr-normal");
    if (themeChk && clrNorm) {
      themeChk.addEventListener("change", () => {
        clrNorm.disabled = themeChk.checked;
        clrNorm.style.opacity = themeChk.checked ? "0.35" : "1";
      });
    }

    this.querySelector("#npt-save")?.addEventListener("click", () => this._saveSettings());
    this.querySelector("#npt-cancel")?.addEventListener("click", () => this._closeSettings());
    this.querySelector("#npt-close")?.addEventListener("click", () => this._closeSettings());
  }

  _saveSettings() {
    const stored = {};

    const langBtn = this.querySelector(".npt-lang-btn.on");
    if (langBtn) stored.language = langBtn.dataset.lang;

    const useTheme = this.querySelector("#clr-normal-theme")?.checked;
    stored.color_normal = useTheme ? "" : (this.querySelector("#clr-normal")?.value || "");
    stored.color_stale = this.querySelector("#clr-stale")?.value || "#b88700";
    stored.color_critical = this.querySelector("#clr-critical")?.value || "#8b1e1e";
    stored.color_delivered = this.querySelector("#clr-delivered")?.value || "#1f7a3f";

    const heightBtn = this.querySelector(".npt-toggle[data-height].on");
    stored.card_height = heightBtn?.dataset.height === "fixed" ? "fixed" : "auto";
    const hpx = parseInt(this.querySelector("#height-px")?.value || "400", 10);
    stored.card_height_px = isNaN(hpx) ? 400 : Math.max(100, Math.min(2000, hpx));

    ["show_delivered", "highlight_stuck"].forEach(id => {
      const btn = this.querySelector(`.npt-toggle[data-tid="${id}"].on`);
      if (btn) stored[id] = btn.dataset.tval === "true";
    });

    const sh = Math.max(1, Math.min(999, parseInt(this.querySelector("#stale-hours")?.value || "24", 10)));
    const ch = Math.max(1, Math.min(999, parseInt(this.querySelector("#critical-hours")?.value || "72", 10)));
    stored.stale_hours = isNaN(sh) ? 24 : sh;
    stored.critical_hours = isNaN(ch) ? 72 : Math.max(stored.stale_hours + 1, ch);

    try { localStorage.setItem(this._storageKey(), JSON.stringify(stored)); } catch {}
    this._showSettings = false;
    this.render();
  }

  _closeSettings() {
    this._showSettings = false;
    this.render();
  }

  _toggleLang() {
    const cfg = this._getCfg();
    this._patchStored({ language: cfg.language === "nb" ? "en" : "nb" });
    this.render();
  }

  // ── Parcel state helpers ─────────────────────────────────────────────────────

  _getParcelStates(cfg) {
    const isMaster = (s) => {
      if (!s?.entity_id?.startsWith("sensor.")) return false;
      const a = s.attributes || {};
      return a.npt_master_entity === true || a.parcel_tracker_entity === "status";
    };

    let states = [];
    if (Array.isArray(cfg.entities) && cfg.entities.length > 0) {
      states = cfg.entities.map(id => this._hass.states[id]).filter(isMaster);
    } else {
      states = Object.values(this._hass.states).filter(isMaster);
    }

    return states
      .filter(s => cfg.show_delivered !== false || !this._isDelivered(s.attributes || {}))
      .sort((a, b) => {
        const ta = new Date((a.attributes || {}).latest_event_time || 0).getTime();
        const tb = new Date((b.attributes || {}).latest_event_time || 0).getTime();
        return tb - ta;
      });
  }

  _rowClass(attrs, cfg) {
    if (this._isDelivered(attrs)) return "delivered";
    if (cfg.highlight_stuck === false) return "";
    const t = attrs.latest_event_time;
    if (!t) return "";
    const ageHours = (Date.now() - new Date(t).getTime()) / 36e5;
    const critical = Number(cfg.critical_hours ?? 72);
    const stale = Number(cfg.stale_hours ?? 24);
    if (critical > 0 && ageHours >= critical) return "critical";
    if (stale > 0 && ageHours >= stale) return "warn";
    return "";
  }

  _isDelivered(attrs) {
    if (attrs.is_delivered === true) return true;
    const text = `${attrs.status || ""} ${attrs.latest_event || ""} ${attrs.status_code || ""}`.toLowerCase();
    return text.includes("pakken er levert") || text.includes("delivered");
  }

  // ── Add parcel ───────────────────────────────────────────────────────────────

  async _addParcel() {
    if (this._addBusy) return;
    const tracking = window.prompt(this._str("addPrompt"))?.trim();
    if (!tracking) return;

    this._addBusy = true;
    this._addMessage = this._str("adding");
    this.render();

    try {
      await this._hass.callService("norwegian_parcel_tracker", "add_parcel", { tracking_number: tracking });
      this._addMessage = this._str("addOk");
    } catch (err) {
      this._addMessage = `${this._str("addErr")}: ${err?.message || this._str("addErrUnknown")}`;
    } finally {
      this._addBusy = false;
      this.render();
      window.setTimeout(() => { this._addMessage = ""; this.render(); }, 5000);
    }
  }

  // ── String cleaning ──────────────────────────────────────────────────────────

  _cleanPickup(value) {
    if (!value) return "";
    const text = String(value).trim();
    // Keep in sync with _sanitize_pickup_name in norwegian-parcel-tracker (api.py)
    const bad = new Set(["expectedPickupUnitURL","expectedPickupUnitUrl","expectedPickupUnitId","expectedPickupUnitName","pickupPointInfo","pickup-point","Pickup not available","Unknown","unknown"]);
    if (bad.has(text)) return this._str("pickupNA");
    if (text.startsWith("http://") || text.startsWith("https://")) return this._str("pickupNA");
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text) && !/\d/.test(text)) return this._str("pickupNA");
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
      const locale = this._getCfg().language === "en" ? "en-GB" : "no-NO";
      return new Date(value).toLocaleString(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return value; }
  }

  _escape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  _escapeAttr(value) {
    return this._escape(value).replaceAll('"', "&quot;");
  }

  // Returns val if it is a safe CSS hex color (#RGB / #RRGGBB / #RRGGBBAA), otherwise fallback.
  _safeColor(val, fallback) {
    return (typeof val === "string" && /^#[0-9a-fA-F]{3,8}$/.test(val.trim())) ? val.trim() : fallback;
  }

  // Returns the URL if it starts with https://, otherwise null.
  _safeUrl(val) {
    return (typeof val === "string" && val.startsWith("https://")) ? val : null;
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  _styles() {
    return `<style>
      .npt-card { padding: 16px; }
      .npt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .npt-title { font-size: 1.15rem; font-weight: 600; }
      .npt-actions { display: flex; align-items: center; gap: 4px; }
      .npt-icon-btn { border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; background: transparent; color: var(--primary-text-color); font-size: 1.1rem; line-height: 1; }
      .npt-icon-btn:hover { background: var(--secondary-background-color); }
      .npt-icon-btn:disabled { opacity: 0.65; cursor: progress; }
      .npt-flag-btn { padding: 3px 6px; }
      .npt-add-icon { background: var(--primary-color); color: var(--text-primary-color); font-weight: 700; font-size: 1.3rem; padding: 2px 10px; }
      .npt-add-icon:hover { filter: brightness(1.15); }
      .npt-msg { font-size: 0.8rem; opacity: 0.85; text-align: right; margin-bottom: 8px; }
      .npt-row { margin: 8px 0; border-radius: 10px; padding: 12px; background: var(--npt-normal, var(--secondary-background-color)); color: var(--primary-text-color); border-left: 5px solid var(--divider-color); }
      .npt-row.delivered { background: var(--npt-delivered, #1f7a3f); color: #fff; border-left-color: #0b4f28; }
      .npt-row.warn { background: var(--npt-stale, #b88700); color: #000; border-left-color: #6d5100; }
      .npt-row.critical { background: var(--npt-critical, #8b1e1e); color: #fff; border-left-color: #4d0c0c; }
      .npt-main { display: flex; justify-content: space-between; gap: 8px; font-weight: 600; }
      .npt-meta { margin-top: 6px; font-size: 0.9rem; opacity: 0.95; line-height: 1.45; }
      .npt-empty { opacity: 0.7; }
      .npt-link { color: inherit; text-decoration: underline; }
      /* ── Settings ── */
      .npt-settings { display: flex; flex-direction: column; gap: 2px; }
      .npt-ssec { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.55; margin-top: 16px; padding-bottom: 3px; border-bottom: 1px solid var(--divider-color); }
      .npt-srow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 5px 0; }
      .npt-slabel { font-size: 0.9rem; flex: 1; }
      .npt-color-wrap { display: flex; align-items: center; gap: 8px; }
      .npt-theme-check { font-size: 0.8rem; display: flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap; }
      .npt-toggle-wrap { display: flex; gap: 4px; }
      .npt-toggle { border: 1px solid var(--divider-color); border-radius: 4px; padding: 3px 10px; font-size: 0.85rem; cursor: pointer; background: transparent; color: var(--primary-text-color); }
      .npt-toggle.on { background: var(--primary-color); color: var(--text-primary-color); border-color: var(--primary-color); }
      .npt-lang-row { justify-content: flex-start; gap: 8px; flex-wrap: wrap; }
      .npt-lang-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--divider-color); border-radius: 6px; padding: 5px 12px; font-size: 0.9rem; cursor: pointer; background: transparent; color: var(--primary-text-color); }
      .npt-lang-btn.on { background: var(--primary-color); color: var(--text-primary-color); border-color: var(--primary-color); }
      .npt-num-input { width: 72px; padding: 3px 6px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--secondary-background-color); color: var(--primary-text-color); font-size: 0.9rem; text-align: right; }
      .npt-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--divider-color); }
      .npt-btn-pri { background: var(--primary-color); color: var(--text-primary-color); border: none; border-radius: 6px; padding: 7px 20px; cursor: pointer; font-weight: 600; font-size: 0.95rem; }
      .npt-btn-sec { background: transparent; color: var(--primary-text-color); border: 1px solid var(--divider-color); border-radius: 6px; padding: 7px 20px; cursor: pointer; font-size: 0.95rem; }
    </style>`;
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
