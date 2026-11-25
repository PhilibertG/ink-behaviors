import { useCallback, useEffect, useRef, useState } from 'react';
import { createTypeahead } from './vendor/typeahead.js';

/**
 * The part of a key event the typeahead looks at. Ink's `Key` (second
 * argument of `useInput`) fits, and so does any object with these fields.
 */
export interface TypeaheadKey {
  ctrl?: boolean;
  meta?: boolean;
  /** Kitty keyboard protocol: 'press', 'repeat' or 'release'. */
  eventType?: string;
}

/** What the typeahead needs to know about an item. Extra fields are fine. */
export interface TypeaheadItem {
  /** The text the typed letters are compared to. */
  label: string;
  /** A disabled item is skipped. */
  disabled?: boolean;
}

export interface UseTypeaheadOptions<T extends TypeaheadItem = TypeaheadItem> {
  /**
   * The items, in the order they are shown. Any object with a `label` fits:
   * your own fields (`value`, `icon`...) are accepted and ignored.
   */
  items: readonly T[];
  /** Index of the item that has the cursor now, or -1 for none. */
  current: number;
  /** Called with the index of the item the typed letters lead to. */
  onMatch: (index: number) => void;
  /** Set to false to ignore every key. @defaultValue true */
  isActive?: boolean;
  /** Milliseconds without typing before the letters are forgotten. @defaultValue 500 */
  timeout?: number;
  /** Language used to compare letters, like "fr". Defaults to the system's. */
  locale?: string;
}

export interface UseTypeaheadResult {
  /**
   * Give it every key the list receives. Returns true when the typeahead used
   * the key: the caller must then not treat it as a shortcut of its own.
   */
  handleInput: (input: string, key?: TypeaheadKey) => boolean;
  /**
   * The letters typed so far, as typed, or '' when no search is in progress.
   * The component renders again each time it changes, so it can be shown.
   */
  query: string;
  /** Forget the letters typed so far. */
  reset: () => void;
}

// One visible character: not a control code, not DEL.
const isPrintable = (char: string) => char >= ' ' && char !== '\u007F';

/**
 * Type-to-select for a list: typing "e" moves to the next item that starts
 * with "e" (accents and case ignored, so "Éditer" matches), typing "ed"
 * quickly narrows it down, and pressing the same letter again steps through
 * the items that start with it.
 *
 * The hook does not listen to the keyboard itself. Call `handleInput` from
 * the list's own `useInput`, so one handler decides what each key does.
 */
export function useTypeahead<T extends TypeaheadItem>(
  options: UseTypeaheadOptions<T>,
): UseTypeaheadResult {
  const { timeout, locale } = options;

  // Always read the latest props from the handler, without recreating it.
  const latest = useRef<UseTypeaheadOptions>(options);
  latest.current = options;

  const [query, setQuery] = useState('');
  const searchRef = useRef<ReturnType<typeof createTypeahead> | null>(null);

  // A typeahead lives as long as its settings. When they change, or when the
  // list goes away, its pending timer is cleared and its letters forgotten.
  useEffect(() => {
    let alive = true;
    const search = createTypeahead({
      timeout,
      locale,
      onQueryChange: (typed) => {
        if (alive) {
          setQuery(typed);
        }
      },
    });
    searchRef.current = search;
    return () => {
      search.reset();
      alive = false;
      searchRef.current = null;
    };
  }, [timeout, locale]);

  const reset = useCallback(() => searchRef.current?.reset(), []);

  const handleInput = useCallback((input: string, key?: TypeaheadKey) => {
    const search = searchRef.current;
    const { items, current, onMatch, isActive = true } = latest.current;

    // No typeahead before the list is mounted, or after it is gone.
    if (!search || !isActive || key?.eventType === 'release') {
      return false;
    }

    const chars = [...input];
    const typed =
      chars.length > 0 && !key?.ctrl && !key?.meta && chars.every(isPrintable);
    // Space starts nothing: alone, it stays the caller's key.
    if (!typed || (input === ' ' && !search.active())) {
      // Any other key (arrows, Enter, Escape...) ends the query.
      search.reset();
      return false;
    }

    // Search only among the items that can be reached.
    const reachable: number[] = [];
    items.forEach((item, index) => {
      if (!item.disabled) {
        reachable.push(index);
      }
    });
    const reachableLabels = reachable.map((index) => items[index]!.label);
    // Position of the cursor among them, or of the last reachable item before it.
    let position = -1;
    for (let i = 0; i < reachable.length && reachable[i]! <= current; i++) {
      position = i;
    }

    // A terminal can deliver several characters at once (fast typing, paste).
    let found = -1;
    for (const char of chars) {
      const match = search(char, reachableLabels, found === -1 ? position : found);
      if (match !== -1) {
        found = match;
      }
    }

    if (found !== -1) {
      const index = reachable[found]!;
      if (index !== current) {
        onMatch(index);
      }
    }
    return true;
  }, []);

  return { handleInput, query, reset };
}
