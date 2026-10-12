# ATOM Flow

A Flutter app for monitoring flow-measuring devices in the field. It shows live readings, online/offline status, and where each device is installed.

It talks to a separate backend over REST (default port 4000) and polls it every 5 seconds.

## Features

- **Dashboard**: quick stats, a live flow trend, an online/offline donut chart, top devices by flow, live alerts, a small map preview, and a list of offline devices.
- **Home**: one card per device, for day-to-day monitoring and control.
- **Map**: all devices that have a location, shown on OpenStreetMap. Tapping a device in the list below the map centers the map on it.
- **Device management**: add a device, rename it, and set or change its location from a map picker.
- **Status details**: shows exactly when a device went online or offline. The backend records `onlineSince` / `offlineSince` when the state actually changes, not when the last message happened to arrive.

Favorites and Reports are in the drawer but are still empty placeholders.

## Dashboard vs. Home

They look at the same data differently. The Dashboard is for analysis (trends, distribution, alerts). Home is the card view you'd use to check on devices quickly. Each card has a ⋮ menu with **Rename device**, **Edit location** and **Status details**.

Alerts on the Dashboard are generated live from two conditions: a device is offline, or its flow velocity is high.

## Project structure

```
lib/
  main.dart
  theme/app_theme.dart                 colors, Plus Jakarta Sans via google_fonts
  models/equipment.dart                includes location (lat/lng), onlineSince, offlineSince
  services/api_service.dart
  utils/time_format.dart               "time ago" and online-duration formatting

  screens/
    login_screen.dart                  animated logo
    main_shell.dart                    app shell and drawer
    analytics_dashboard_screen.dart
    home_screen.dart
    map_screen.dart
    location_picker_screen.dart        used when adding or editing a device
    add_device_screen.dart
    device_detail_screen.dart
    settings_screen.dart
    favorite_screen.dart               placeholder
    reports_screen.dart                placeholder

  widgets/
    app_drawer.dart
    equipment_card.dart
    coming_soon_placeholder.dart
```

## Getting started

```bash
cd flutter_app
flutter pub get
flutter run
```

Set the backend address in `lib/services/api_service.dart`:

```dart
static const String baseUrl = 'http://10.0.2.2:4000/api'; // Android emulator
```

`10.0.2.2` only works from the Android emulator, where it points to your machine's localhost. On the iOS simulator use `localhost`, and on a physical device use your computer's LAN IP.

The map uses `flutter_map` with OpenStreetMap tiles, so no API key is needed.

## Known limitations

- **The flow trend is not historical.** The backend only keeps the latest reading, so the trend chart is built from live readings while the Dashboard is open. Close the page and it starts over.
- **Polling, not push.** The app fetches data every 5 seconds. Alerts only show up while the Dashboard is open.

## Roadmap

1. Store readings in a time-series database so Reports and the trend chart can cover days or weeks.
2. Implement the Favorites screen.
3. Push notifications for offline and high-velocity alerts.
4. Replace polling with WebSockets.