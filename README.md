# ink-behaviors

> **Unofficial community package.** `ink-behaviors` is not affiliated with,
> endorsed by, or maintained by the [Ink](https://github.com/vadimdemedes/ink)
> project or its authors.

Behavior hooks for [Ink](https://github.com/vadimdemedes/ink) lists and menus:
they handle the keys and the state, and render nothing. You keep full control
of how your component looks. This is what Base UI or Radix do for the web,
applied to terminal apps.

| Hook | What it does |
|---|---|
| [`useListNavigation`](#uselistnavigation) | Arrows, Home, End, Page Up and Page Down, with a scrolling window of visible rows. |
| [`useTypeahead`](#usetypeahead) | Type letters to jump to the item that starts with them. Accents and case are ignored. |

## Install

```bash
npm install ink-behaviors
```

You also need `react` (18 or later) and `ink` in your app. The package has no
other dependency. See [Compatibility](#compatibility).

## The one rule: the hooks do not listen to the keyboard

In Ink, every `useInput` handler receives every key. A hook with its own
`useInput` would see `j` at the same time as your list does, and both would
act on it. So each hook gives you a `handleInput` function, and your single
`useInput` decides. When `handleInput` returns `true`, the hook used the key
and you stop there:

```ts
useInput((input, key) => {
  if (typeahead.handleInput(input, key)) return;
  if (nav.handleInput(input, key)) return;
  // your own keys: Enter, Escape...
});
```

## `useListNavigation`

Moves a cursor in a list and scrolls a window of visible rows so the active
item stays on screen. Disabled items are skipped.

A complete program. Save it as `list.tsx` and run `npx tsx list.tsx`:

```tsx
import React, { useState } from 'react';
import { Box, Text, render, useInput } from 'ink';
import { useListNavigation } from 'ink-behaviors';

const items = [
  { label: 'Apple' },
  { label: 'Banana' },
  { label: 'Cherry', disabled: true },
  { label: 'Grape' },
  { label: 'Lemon' },
  { label: 'Mango' },
  { label: 'Orange' },
  { label: 'Peach' },
];

function FruitList() {
  const [chosen, setChosen] = useState('nothing yet');
  const nav = useListNavigation({ items, visibleCount: 4, loop: true });

  useInput((input, key) => {
    if (nav.handleInput(input, key)) return;
    if (key.return && nav.canSelect) setChosen(items[nav.current]!.label);
  });

  return (
    <Box flexDirection="column">
      {items.slice(nav.viewportStart, nav.viewportEnd).map((item, row) => {
        const index = nav.viewportStart + row;
        return (
          <Text key={item.label} inverse={index === nav.current} dimColor={item.disabled}>
            {item.label}
          </Text>
        );
      })}
      <Text dimColor>Chosen: {chosen} (Enter to choose, ctrl+c to quit)</Text>
    </Box>
  );
}

render(<FruitList />);
```

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `items` | `readonly T[]` | required | The items, in display order. They can be anything. An object with `disabled: true` is a disabled item. |
| `visibleCount` | `number` | all items | Number of rows shown at once. |
| `loop` | `boolean` | `false` | Go from the last item to the first, and back. Page keys never loop. |
| `focusDisabled` | `boolean` | `false` | Let the cursor stop on disabled items, so they can be read. `canSelect` is then `false` on them. |
| `isActive` | `boolean` | `true` | `false` ignores every key. |
| `initialIndex` | `number` | `0` | Item that has the cursor at first. |

### Result

| Field | Type | Meaning |
|---|---|---|
| `current` | `number` | Index of the active item, or `-1` when no item can be active (empty list, or every item disabled). |
| `viewportStart`, `viewportEnd` | `number` | The visible rows are `items.slice(viewportStart, viewportEnd)`. |
| `canSelect` | `boolean` | `false` when there is no active item or when it is disabled. Check it before you validate. |
| `handleInput` | `(input, key?) => boolean` | Give it every key. Returns `true` for a navigation key, even at the end of the list. |
| `moveTo` | `(index: number) => void` | Moves to an item and scrolls to show it. |
| `next`, `previous`, `pageDown`, `pageUp`, `first`, `last` | `() => void` | The same moves as the keys, for your own shortcuts (`j`/`k`, `ctrl+d`...). |

Keys used: up and down arrows, Page Up, Page Down, Home, End. With `ctrl`,
`meta` or `shift` held, the key is left to you.

The hook stays valid when the list changes: if it shrinks, or if the active
item becomes disabled, the cursor goes to the nearest item it can stop on.
Disabled rows at the top or bottom of the list are still scrolled into view,
so they can be read even though the cursor never stops on them.

## `useTypeahead`

Type-to-select for a list. Typing `e` moves to the next item that starts with
"e". Case and accents are ignored, so `e` finds "Éditer". Typing `en` quickly
narrows the search, and pressing the same letter again steps through the items
that start with it. The typed letters are forgotten after a short pause.

A complete program. Save it as `menu.tsx` and run `npx tsx menu.tsx`:

```tsx
import React, { useState } from 'react';
import { Box, Text, render, useInput } from 'ink';
import { useTypeahead } from 'ink-behaviors';

const items = [
  { label: 'Annuler' },
  { label: 'Éditer' },
  { label: 'Envoyer' },
  { label: 'Exporter', disabled: true },
  { label: 'Quitter' },
];

function Menu() {
  const [current, setCurrent] = useState(0);
  const typeahead = useTypeahead({ items, current, onMatch: setCurrent });

  useInput((input, key) => {
    if (typeahead.handleInput(input, key)) return;
    if (key.downArrow) setCurrent((index) => Math.min(index + 1, items.length - 1));
    if (key.upArrow) setCurrent((index) => Math.max(index - 1, 0));
  });

  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Text key={item.label} inverse={index === current} dimColor={item.disabled}>
          {item.label}
        </Text>
      ))}
      <Text dimColor>Search: {typeahead.query || '(type a letter)'}</Text>
    </Box>
  );
}

render(<Menu />);
```

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `items` | `readonly { label: string; disabled?: boolean }[]` | required | The items, in display order. Your own fields (`value`, `icon`...) are accepted. Disabled items are never matched. |
| `current` | `number` | required | Index of the item that has the cursor, or `-1`. |
| `onMatch` | `(index: number) => void` | required | Called with the index to move to. |
| `isActive` | `boolean` | `true` | `false` ignores every key and forgets the typed letters. |
| `timeout` | `number` | `500` | Pause in milliseconds before the typed letters are forgotten. |
| `locale` | `string` | the system's | Language used to compare letters, like `"fr"`. Swedish keeps "ä" apart from "a", French does not. |

### Result

| Field | Type | Meaning |
|---|---|---|
| `handleInput` | `(input, key?) => boolean` | Give it every key. Returns `true` when the search used it. |
| `query` | `string` | The letters typed so far, `''` when idle. The component renders again when it changes. |
| `reset` | `() => void` | Forgets the typed letters. |

Keys left to you (`handleInput` returns `false`): arrows, Enter, Escape, Tab,
`ctrl`/`meta` combinations, and Space when no search is in progress. Any of
them also ends the search in progress.

## Both hooks together

`moveTo` is made to be `onMatch`: when the typeahead finds an item outside
the window, the list scrolls to it. Save as `both.tsx`, run `npx tsx both.tsx`:

```tsx
import React from 'react';
import { Box, Text, render, useInput } from 'ink';
import { useListNavigation, useTypeahead } from 'ink-behaviors';

const items = [
  'Argentina', 'Belgium', 'Canada', 'Denmark', 'Égypte', 'France',
  'Germany', 'Hungary', 'Iceland', 'Japan', 'Kenya', 'Latvia',
].map((label) => ({ label }));

function Countries() {
  const nav = useListNavigation({ items, visibleCount: 5 });
  const typeahead = useTypeahead({ items, current: nav.current, onMatch: nav.moveTo });

  useInput((input, key) => {
    if (typeahead.handleInput(input, key)) return;
    if (nav.handleInput(input, key)) return;
  });

  return (
    <Box flexDirection="column">
      {items.slice(nav.viewportStart, nav.viewportEnd).map((item, row) => (
        <Text key={item.label} inverse={nav.viewportStart + row === nav.current}>
          {item.label}
        </Text>
      ))}
      <Text dimColor>
        {nav.current + 1}/{items.length} {typeahead.query && `search: ${typeahead.query}`}
      </Text>
    </Box>
  );
}

render(<Countries />);
```

Call the typeahead first: it takes letters, and leaves the arrows to the
navigation.

## Compatibility

| | Tested with | Note |
|---|---|---|
| React 19 | React 19.3, Ink 8 | Full test suite. |
| React 18 | React 18.3, Ink 5 | Same test suite, minus Home and End. |

- **Home and End need a recent Ink.** Ink 5 does not report these two keys
  (the handler gets an empty input and no flag), so they do nothing there.
  Everything else works. Ink 8 reports them.
- The hooks only import `react`. Ink is not a dependency: any object with the
  same fields as Ink's `key` works.
- Not tested: Ink 4, 6 and 7, and Node versions below 22.

## Development

One command installs the dependencies, checks the types, runs the tests on
React 19 and on React 18, and builds the package:

```bash
npm install && npm run check
```

| Command | What it does |
|---|---|
| `npm test` | runs the tests once (React 19, Ink 8) |
| `npm run test:react18` | runs the same tests with React 18 and Ink 5 (installed in `compat/react18`) |
| `npm run typecheck` | checks the TypeScript types, including the type tests (`*.types.ts`) |
| `npm run build` | writes the package to `dist/` (ESM, CommonJS and types) |

Developing needs Node 22 or later, because the tests use Ink 8.

## Licenses

This package is under the MIT license (file `LICENSE`), Copyright (c) 2026
Philibert Gentien, **except one file**:

- `src/typeahead/vendor/typeahead.ts` is adapted from
  [UI SDK](https://github.com/vercel-labs/ui) (commit
  `d5c6249e1a0b1df47334d3012180bfba9b9374ec`), Copyright 2026 Vercel, Inc.,
  under the Apache License 2.0 (file `LICENSE-APACHE-2.0`). The changes made to it
  are listed at the top of the file. Its notice is kept in the built files.

That is why `package.json` declares `MIT AND Apache-2.0`.
