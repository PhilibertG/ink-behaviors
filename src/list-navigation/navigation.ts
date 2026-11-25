// The rules of list navigation as plain functions: no React, no keyboard.
// Everything works on a "view" of the list, so it can be tested on its own.

export interface ListState {
  /** Index of the active item, or -1 when no item can be active. */
  current: number;
  /** Index of the first visible row. */
  viewportStart: number;
}

export interface ListView {
  /** Number of items. */
  count: number;
  /** Number of rows that fit on screen. */
  visible: number;
  /** Whether the item at this index is disabled. */
  isDisabled: (index: number) => boolean;
  /** Go from the last item to the first, and back. */
  loop: boolean;
  /** Let the cursor stop on disabled items. */
  focusDisabled: boolean;
}

export type ListMove =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'pageDown' }
  | { type: 'pageUp' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'to'; index: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Rows shown at once: never more than there are items, never less than one. */
export function visibleRows(view: ListView) {
  return clamp(Math.floor(view.visible), 1, Math.max(view.count, 1));
}

function canStop(view: ListView, index: number) {
  return (
    index >= 0 &&
    index < view.count &&
    (view.focusDisabled || !view.isDisabled(index))
  );
}

/** First index the cursor can stop on, walking from `from` by `step`. -1 if none. */
function seek(view: ListView, from: number, step: 1 | -1) {
  for (let index = from; index >= 0 && index < view.count; index += step) {
    if (canStop(view, index)) {
      return index;
    }
  }
  return -1;
}

/** Slides the window just enough to show `current`, and keeps it in the list. */
function reveal(view: ListView, current: number, viewportStart: number) {
  const rows = visibleRows(view);
  let start = viewportStart;
  if (current !== -1) {
    if (current < start) {
      start = current;
    } else if (current >= start + rows) {
      start = current - rows + 1;
    }
  }
  return clamp(start, 0, Math.max(view.count - rows, 0));
}

/**
 * Makes a state valid for a list: the list may have shrunk, or the active
 * item may have become disabled. The cursor then goes to the nearest item it
 * can stop on, looking forward first.
 */
export function settle(view: ListView, state: ListState): ListState {
  let current = -1;
  if (view.count > 0) {
    const wanted = clamp(state.current, 0, view.count - 1);
    current = seek(view, wanted, 1);
    if (current === -1) {
      current = seek(view, wanted, -1);
    }
  }
  const viewportStart = reveal(view, current, state.viewportStart);
  return current === state.current && viewportStart === state.viewportStart
    ? state
    : { current, viewportStart };
}

/** The state after a move. Returns the same object when nothing changes. */
export function move(view: ListView, from: ListState, action: ListMove): ListState {
  const state = settle(view, from);
  const { current } = state;
  const rows = visibleRows(view);
  let target = -1;
  let viewportStart = state.viewportStart;

  switch (action.type) {
    case 'next':
      target = seek(view, current + 1, 1);
      if (target === -1 && view.loop) {
        target = seek(view, 0, 1);
      }
      break;
    case 'previous':
      target = current === -1 ? -1 : seek(view, current - 1, -1);
      if (target === -1 && view.loop) {
        target = seek(view, view.count - 1, -1);
      }
      break;
    case 'first':
      target = seek(view, 0, 1);
      break;
    case 'last':
      target = seek(view, view.count - 1, -1);
      break;
    case 'pageDown': {
      // One page further, or the closest item it can stop on before that.
      const wanted = Math.min(current + rows, view.count - 1);
      target = seek(view, wanted, 1);
      if (target === -1) {
        target = seek(view, wanted, -1);
      }
      if (target !== -1 && target > current) {
        viewportStart += rows;
      }
      break;
    }
    case 'pageUp': {
      const wanted = Math.max(current - rows, 0);
      target = seek(view, wanted, -1);
      if (target === -1) {
        target = seek(view, wanted, 1);
      }
      if (target !== -1 && target < current) {
        viewportStart -= rows;
      }
      break;
    }
    case 'to':
      target = canStop(view, action.index) ? action.index : -1;
      break;
  }

  if (target === -1) {
    return state;
  }
  // A page key never moves the cursor backwards, or forwards for page up.
  if (action.type === 'pageDown' && target < current) {
    return state;
  }
  if (action.type === 'pageUp' && target > current) {
    return state;
  }
  const next = {
    current: target,
    viewportStart: reveal(view, target, viewportStart),
  };
  return next.current === state.current && next.viewportStart === state.viewportStart
    ? state
    : next;
}
