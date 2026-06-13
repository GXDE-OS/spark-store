# App Detail Fixed Sidebar Scroll Design

## Goal

In the app detail popup, keep the left app action/meta area fixed on desktop while only the right content area scrolls. Preserve the existing modal/popup visual style and mobile behavior.

## Scope

This change only affects `src/components/AppDetailModal.vue` and its unit tests. It does not change app identity, review behavior, install behavior, or the surrounding `App.vue` modal flow.

## Desktop Layout

For `lg` and wider screens:

1. The modal overlay remains a centered popup with the existing dim background.
2. `.modal-panel` keeps the rounded card style but stops being the scroll container.
3. `.modal-panel` uses a bounded height and `overflow-hidden` so the popup itself stays fixed.
4. The modal body is split into two columns.
5. The left column contains the return button, app icon/name, source selector, install/open/remove/favorite buttons, and metadata. This column does not scroll with wheel movement over the right side.
6. The right column contains app details, screenshots, and reviews. This column is the independent vertical scroll container.

## Mobile Layout

Below `lg`, keep the existing stacked modal behavior. The modal remains scrollable as a single column so small screens can still access all controls and content.

## Scroll Behavior

Wheel scrolling over normal modal content should scroll the right content column on desktop. The overlay wheel guard remains in place so the background page does not scroll through the modal.

## Testing

Update `AppDetailModal.test.ts` to assert:

1. The popup still renders as a fixed modal overlay with `.modal-panel`.
2. `.modal-panel` uses `overflow-hidden` instead of being the primary vertical scroll container on desktop.
3. The left fixed column and right scroll column have stable test selectors.

## Acceptance Criteria

1. Desktop: left A column remains visually fixed while right B column scrolls.
2. Mobile: stacked layout remains usable.
3. Existing detail modal behavior remains intact.
4. Unit tests and Vite build pass.
