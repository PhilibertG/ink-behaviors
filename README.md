# ink-behaviors

> **Unofficial community package.** `ink-behaviors` is not affiliated with,
> endorsed by, or maintained by the [Ink](https://github.com/vadimdemedes/ink)
> project or its authors.

Behavior hooks for [Ink](https://github.com/vadimdemedes/ink) lists and menus:
they handle the keys and the state, and render nothing. You keep full control
of how your component looks. This is what Base UI or Radix do for the web,
applied to terminal apps.

Status: early work, not published on npm yet. One hook so far.

## Launch

One command installs the dependencies, then checks the types, runs the tests
and builds the package:

```bash
npm install && npm run check
```

Separate commands:

| Command | What it does |
|---|---|
| `npm test` | runs the tests once |
| `npm run typecheck` | checks the TypeScript types |
| `npm run build` | writes the package to `dist/` (ESM, CommonJS and types) |

Requires Node 22 or later to develop (the tests use Ink 8).

## `useTypeahead`

Type-to-select for a list. Typing `e` moves to the next item that starts with
"e". Case and accents are ignored, so `e` finds "Éditer". Typing `en` quickly
narrows the search, and pressing the same letter again steps through the items
that start with it. The typed letters are forgotten after a short pause.

```tsx
import { useState } from 'react';
import { Text, useInput } from 'ink';
import { useTypeahead } from 'ink-behaviors';

const items = [
  { label: 'Annuler' },
  { label: 'Éditer' },
  { label: 'Envoyer', disabled: true },
];

function Menu() {
  const [current, setCurrent] = useState(0);
  const typeahead = useTypeahead({ items, current, onMatch: setCurrent });

  useInput((input, key) => {
    if (typeahead.handleInput(input, key)) return; // the letter was used
    if (key.downArrow) setCurrent((i) => Math.min(i + 1, items.length - 1));
    if (key.upArrow) setCurrent((i) => Math.max(i - 1, 0));
  });

  return (
    <>
      {items.map((item, index) => (
        <Text key={item.label} inverse={index === current}>
          {item.label}
        </Text>
      ))}
      {typeahead.query && <Text dimColor>search: {typeahead.query}</Text>}
    </>
  );
}
```

### Why the hook does not listen to the keyboard

In Ink, every `useInput` handler receives every key. A hook with its own
`useInput` would see `j` at the same time as your list does, and both would
act on it. So the hook gives you `handleInput`, and your single `useInput`
decides: when `handleInput` returns `true`, the key was used by the search.

### Options

| Option | Type | Meaning |
|---|---|---|
| `items` | `{ label: string; disabled?: boolean }[]` | The items, in display order. Disabled items are skipped. Your own objects with more fields (like `value`) fit when passed as a variable. |
| `current` | `number` | Index of the item that has the cursor, or `-1`. |
| `onMatch` | `(index: number) => void` | Called with the index to move to. |
| `isActive` | `boolean` | `false` ignores every key. Default `true`. |
| `timeout` | `number` | Pause in milliseconds before the typed letters are forgotten. Default `500`. |
| `locale` | `string` | Language used to compare letters, like `"fr"`. Default: the system's. |

### Result

| Field | Type | Meaning |
|---|---|---|
| `handleInput` | `(input, key?) => boolean` | Give it every key. Returns `true` when the search used it. |
| `query` | `string` | The letters typed so far, `''` when idle. The component re-renders when it changes. |
| `reset` | `() => void` | Forgets the typed letters. |

Keys the hook leaves to you (returns `false`): arrows, Enter, Escape, Tab,
`ctrl`/`meta` combinations, and Space when no search is in progress. Any of
them also ends the search in progress.

## Licenses

This package is under the [MIT license](LICENSE), Copyright (c) 2026 Philibert
Gentien, **except one file**:

- `src/typeahead/vendor/typeahead.ts` is adapted from
  [UI SDK](https://github.com/vercel-labs/ui) (commit
  `d5c6249e1a0b1df47334d3012180bfba9b9374ec`), Copyright 2026 Vercel, Inc.,
  under the [Apache License 2.0](LICENSE-APACHE-2.0). The changes made to it
  are listed at the top of the file. Its notice is kept in the built files.

That is why `package.json` declares `MIT AND Apache-2.0`.
