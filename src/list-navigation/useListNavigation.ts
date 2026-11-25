import { useCallback, useMemo, useRef, useState } from 'react';
import {
  move,
  settle,
  visibleRows,
  type ListMove,
  type ListState,
  type ListView,
} from './navigation.js';

/**
 * The part of a key event the navigation looks at. Ink's `Key` (second
 * argument of `useInput`) fits, and so does any object with these fields.
 */
export interface ListNavigationKey {
  upArrow?: boolean;
  downArrow?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
  /** Ink 8 reports Home and End. Ink 5 does not: there the two keys do nothing. */
  home?: boolean;
  end?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  /** Kitty keyboard protocol: 'press', 'repeat' or 'release'. */
  eventType?: string;
}

export interface UseListNavigationOptions<T = unknown> {
  /**
   * The items, in the order they are shown. They can be anything. An item
   * that is an object with `disabled: true` is a disabled item.
   */
  items: readonly T[];
  /** Number of rows shown at once. Defaults to all the items. */
  visibleCount?: number;
  /** Go from the last item to the first, and back. @defaultValue false */
  loop?: boolean;
  /**
   * Let the cursor stop on disabled items, so they can be read. `canSelect`
   * is then false on them. @defaultValue false (disabled items are skipped)
   */
  focusDisabled?: boolean;
  /** Set to false to ignore every key. @defaultValue true */
  isActive?: boolean;
  /** Item that has the cursor at first. @defaultValue 0 */
  initialIndex?: number;
}

export interface UseListNavigationResult {
  /** Index of the active item, or -1 when no item can be active. */
  current: number;
  /** Index of the first visible item. */
  viewportStart: number;
  /** Index after the last visible item: `items.slice(viewportStart, viewportEnd)`. */
  viewportEnd: number;
  /** False when there is no active item or when it is disabled. Check it before validating. */
  canSelect: boolean;
  /**
   * Give it every key the list receives. Returns true when the key is a
   * navigation key: the caller must then not treat it as its own.
   */
  handleInput: (input: string, key?: ListNavigationKey) => boolean;
  /** Move to an item, and scroll to show it. Ignored if the cursor cannot stop there. */
  moveTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  pageDown: () => void;
  pageUp: () => void;
  first: () => void;
  last: () => void;
}

const isDisabledItem = (item: unknown) =>
  typeof item === 'object' &&
  item !== null &&
  (item as { disabled?: unknown }).disabled === true;

/**
 * Keyboard navigation for a list: up and down arrows, Home, End, Page Up and
 * Page Down, with a window of visible rows that scrolls to keep the active
 * item on screen.
 *
 * The hook does not listen to the keyboard itself. Call `handleInput` from
 * the list's own `useInput`, so one handler decides what each key does.
 */
export function useListNavigation<T>(
  options: UseListNavigationOptions<T>,
): UseListNavigationResult {
  const {
    items,
    visibleCount,
    loop = false,
    focusDisabled = false,
    isActive = true,
    initialIndex = 0,
  } = options;

  const view: ListView = {
    count: items.length,
    visible: visibleCount ?? items.length,
    isDisabled: (index) => isDisabledItem(items[index]),
    loop,
    focusDisabled,
  };

  const [stored, setStored] = useState<ListState>({
    current: initialIndex,
    viewportStart: 0,
  });
  // What is shown is always valid for the items of this render, even when
  // the list just shrank or the active item just became disabled.
  const state = settle(view, stored);

  // Always read the latest list from the actions, without recreating them.
  const latest = useRef({ view, isActive });
  latest.current = { view, isActive };

  const actions = useMemo(() => {
    const run = (action: ListMove) =>
      setStored((previous) => move(latest.current.view, previous, action));
    return {
      moveTo: (index: number) => run({ type: 'to', index }),
      next: () => run({ type: 'next' }),
      previous: () => run({ type: 'previous' }),
      pageDown: () => run({ type: 'pageDown' }),
      pageUp: () => run({ type: 'pageUp' }),
      first: () => run({ type: 'first' }),
      last: () => run({ type: 'last' }),
    };
  }, []);

  const handleInput = useCallback(
    (_input: string, key?: ListNavigationKey) => {
      if (!key || !latest.current.isActive || key.eventType === 'release') {
        return false;
      }
      // With a modifier, the key means something else: it stays the caller's.
      if (key.ctrl || key.meta || key.shift) {
        return false;
      }
      if (key.downArrow) {
        actions.next();
      } else if (key.upArrow) {
        actions.previous();
      } else if (key.pageDown) {
        actions.pageDown();
      } else if (key.pageUp) {
        actions.pageUp();
      } else if (key.home) {
        actions.first();
      } else if (key.end) {
        actions.last();
      } else {
        return false;
      }
      return true;
    },
    [actions],
  );

  return {
    current: state.current,
    viewportStart: state.viewportStart,
    viewportEnd: Math.min(state.viewportStart + visibleRows(view), items.length),
    canSelect: state.current !== -1 && !view.isDisabled(state.current),
    handleInput,
    ...actions,
  };
}
