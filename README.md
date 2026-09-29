# ACF Flexible Copy Paste

Copies ACF Pro Flexible Content layouts between WordPress editing screens.

## Requirements

- WordPress 6.0+
- PHP 7.4+
- ACF Pro
- ACF 6.5+ for individual layout actions
- Permission to edit the current post type

## Usage

1. Use **Copy all layouts** and **Paste layouts** to copy an entire Flexible Content field.
2. Use **Copy Layout** and **Paste After** from the layout action menu to copy one layout.
3. Save the destination post after pasting.

## Technical Notes

- Source and destination fields must have the same ACF field key.
- Pasted layouts are appended; existing layouts are not replaced.
- Data is stored in browser `localStorage` under `acfFlexibleCopyPaste`.
- Copying another field or layout replaces the stored selection.
- Invalid layouts and layouts exceeding ACF limits are skipped.
- Stored markup is sanitized before insertion.

## Changelog

### 1.0.2

- Maintenance release with package metadata updates.

### 1.0.1

- Maintenance release with package metadata updates.

### 1.0.0

- Added full-field and individual layout copy/paste actions.
- Added validation, sanitization, and ACF limit checks.
