# Changelog

All notable changes to this package are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions
follow [Semantic Versioning](https://semver.org/). Before 1.0.0, a minor
version (0.x) may change the API.

## [0.1.0] - 2026-11-25

First version.

### Added

- `useListNavigation`: up and down arrows, Home, End, Page Up and Page Down
  for a list, with a window of visible rows that scrolls to keep the active
  item on screen. Options: `loop`, `focusDisabled`, `visibleCount`,
  `isActive`, `initialIndex`. Disabled items are skipped by default.
- `useTypeahead`: type letters to jump to the item that starts with them.
  Case and accents are ignored the way the locale ignores them. Exposes the
  typed letters as `query`.
- The two hooks work together: `useListNavigation`'s `moveTo` is
  `useTypeahead`'s `onMatch`.
- Neither hook listens to the keyboard. Each exposes `handleInput`, which
  returns `true` when it used the key.
- Tested with React 19 (Ink 8) and React 18 (Ink 5).

### Known limits

- Ink 5 does not report Home and End, so these two keys do nothing there.
- Not tested with Ink 4, 6 and 7, or with Node below 22.

### Credits

- The matching logic of `useTypeahead` is adapted from
  [UI SDK](https://github.com/vercel-labs/ui) by Vercel, under the Apache
  License 2.0. See `LICENSE-APACHE-2.0`.
