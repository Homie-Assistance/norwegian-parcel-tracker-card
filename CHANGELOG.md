# Changelog

## 1.3.0

- Add settings panel (⚙ button): language, row colors, card height, show_delivered, highlight_stuck, stale/critical thresholds. Settings persist in browser localStorage.
- Add Norwegian/English translation framework — all card strings now switch language.
- Add language indicator flag button (left of ⚙): click to toggle nb↔en instantly without opening the panel.
- Expose previously YAML-only options (stale_hours, critical_hours) in the settings UI.

## 1.2.0

- Move card JS file to repository root (was `dist/`). HACS was preserving
  the `dist/` subdirectory when installing, causing the file path and the
  auto-registered resource URL to diverge.

## 1.1.0

- Replace inline tracking-number input with a browser prompt dialog. The input field was losing focus on every Home Assistant state update; the prompt is modal and unaffected by state changes.

## 1.0.0

- Add `deploy.sh` for automated deployment with HA install-type detection (HassOS, Docker, HACS vs standalone, existing-path vs default-path choice).
- Independent versioning starts here — card previously shared version numbers with the backend repo.

## 0.1.5

- Fix Lovelace add-tracker input losing focus during Home Assistant state updates.

## 0.1.4

- Fix internal Posten key names (e.g. `expectedPickupUnitURL`) never shown as a pickup address.

## 0.1.3

- Fix bogus `estimatedTimeSpanOfDelivery` placeholder appearing as ETA after delivery.
- Add visible success/error feedback when adding a parcel from the card.

## 0.1.2

- Tighten entity filtering so only master parcel status entities are rendered.

## 0.1.1

- Rename custom card type to `custom:norwegian-parcel-tracking`.
- Fix entity discovery so only parcel status sensors are shown by default.

## 0.1.0

- Initial release.
