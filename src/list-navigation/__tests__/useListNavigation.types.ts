// Type tests. Nothing here runs: `npm run typecheck` fails if a line that
// must compile does not, or if a line marked @ts-expect-error does.
import { useListNavigation, useTypeahead } from '../../index.js';

export function typeTests() {
  // Items can be anything: objects, strings, numbers.
  useListNavigation({ items: [{ label: 'Un', value: 1, disabled: true }] });
  useListNavigation({ items: ['un', 'deux'] as const, visibleCount: 5, loop: true });
  useListNavigation({ items: [1, 2, 3], focusDisabled: true, isActive: false, initialIndex: 2 });

  // @ts-expect-error items are required
  useListNavigation({ visibleCount: 5 });
  // @ts-expect-error visibleCount is a number
  useListNavigation({ items: [], visibleCount: '5' });

  // The two hooks plug into each other without a conversion.
  const items = [{ label: 'Un', value: 1 }];
  const nav = useListNavigation({ items });
  useTypeahead({ items, current: nav.current, onMatch: nav.moveTo });

  const current: number = nav.current;
  const visible = items.slice(nav.viewportStart, nav.viewportEnd);
  const used: boolean = nav.handleInput('', { downArrow: true });
  const canSelect: boolean = nav.canSelect;
  return { current, visible, used, canSelect };
}
