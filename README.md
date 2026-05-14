# Norwegian parcel tracker card

A Lovelace dashboard card for parcels tracked by [Norwegian parcel tracker](https://github.com/Homie-Assistance/norwegian-parcel-tracker).

## Installation with HACS

Add this repository as a HACS custom repository with category **Lovelace** / **Frontend**:

```text
https://github.com/Homie-Assistance/norwegian-parcel-tracker-card
```

HACS installs the card resource as:

```text
/hacsfiles/norwegian-parcel-tracker-card/norwegian-parcel-tracker-card.js
```

## Card configuration

```yaml
type: custom:norwegian-parcel-tracking
title: Pakker
show_delivered: false
highlight_stuck: true
```

## Features

- Lists all parcel tracking sensors from Norwegian parcel tracker.
- Shows latest event, estimated delivery, pickup point and location if available.
- Green for delivered parcels.
- Dark yellow for parcels not moving after 24 hours.
- Red for parcels not moving after 72 hours.
- Optional add-tracking-number field using the integration service.
