# Installed Apps Modal Actions Design

## Background

The installed-apps modal currently renders each installed app row with display information and an uninstall button only. It no longer exposes any path to launch an installed app or open that app's detail modal.

As a result:

1. Users cannot launch apps from the installed-apps manager.
2. Clicking apps that are already listed in the store no longer opens their detail view from that manager.

The parent app already has working handlers for both behaviors:

- `openDownloadedApp(pkgname, origin)` for launching
- `openDetail(app)` for showing app details

The regression is therefore in the modal interaction layer rather than in the launch backend itself.

## Goals

1. Restore a direct “open app” action in the installed-apps modal.
2. Restore a “view details” action for installed apps that can be matched to store detail data.
3. Reuse the existing parent handlers instead of creating a second launch/detail path.
4. Keep uninstall behavior unchanged.
5. Keep the change local to the installed-apps modal and its parent wiring.

## Non-Goals

1. Do not redesign the whole installed-apps UI.
2. Do not change uninstall flow.
3. Do not add a brand new launcher backend.
4. Do not change app-detail modal behavior itself.

## Recommended Approach

Add two explicit actions to each installed-app row:

1. `打开` - always available for installed apps, routed to the existing launch handler.
2. `查看详情` - available only when the app has enough store metadata to open a meaningful detail modal.

The modal emits these actions upward, and `App.vue` wires them to the existing parent methods. This restores behavior with minimal code movement and avoids duplicating launch or detail logic.

## UI Behavior

### Open action

- Every installed app row gets an `打开` button.
- Clicking it emits the installed app object upward.
- The parent maps this to `openDownloadedApp(app.pkgname, app.origin)`.

### Detail action

- Installed apps that can be resolved to a store-backed detail view get a `查看详情` button.
- The modal should treat an app as detail-capable when its data is sufficient for the existing `openDetail` path, specifically when:
  - it has a non-`unknown` category, or
  - it already carries enough store-backed fields to be opened meaningfully by the current parent logic.
- Clicking it emits the app upward.
- The parent maps this to `openDetail(app)`.

### Uninstall action

- The existing `卸载` button remains unchanged.

## Event Contract

`InstalledAppsModal.vue` should expose two additional emits:

1. `open-app`
2. `open-detail`

`App.vue` should listen to both and route them to existing functions, not wrappers with new behavior.

## Data Flow

1. `refreshInstalledApps()` continues building the installed app list.
2. Each installed app row decides whether the detail action is available.
3. Modal emits the chosen action with the clicked app.
4. Parent receives the event and invokes the existing launch/detail flow.

## Testing

Add focused unit coverage for the modal:

1. It renders the `打开` button for installed items.
2. It renders the `查看详情` button only when the app is detail-capable.
3. It emits `open-app` when the open button is clicked.
4. It emits `open-detail` when the detail button is clicked.

The tests do not need to re-test the internals of `openDownloadedApp()` or `openDetail()`; they only need to prove the modal restores the event path correctly.
