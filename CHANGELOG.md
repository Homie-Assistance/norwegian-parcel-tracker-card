# Changelog

## 1.6.0

- Added `custom:norwegian-parcel-tracker-map-card`: a new Lovelace card that shows the current geocoded parcel location on a map (using HA's built-in `ha-map` element, no CDN dependency), with recent event history below. Requires integration v1.3.0 or later (which adds `device_tracker` entities). Configure by pointing at the `device_tracker` entity. The card auto-discovers the matching status sensor for recent events. Note: HACS only auto-registers the main card file; the map card must be added as a Lovelace resource manually (see README).

## 1.5.0

- Adding a parcel from the card now asks for an optional display name after the tracking number — matching the integration UI flow.

## 1.4.0

- Swipe right to manually refresh all parcels. A "↻ Refresh" hint appears as you drag; the card blinks three times to confirm the refresh triggered.
- Per-row spinner while a refresh is in progress.
- Helthjem parcels collected from a pickup point now colour green correctly.
- Card no longer re-renders on every Home Assistant state push — only when parcel data actually changes.

## 1.3.1

- Added HACS validation workflow.
- Added screenshots to README.

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
