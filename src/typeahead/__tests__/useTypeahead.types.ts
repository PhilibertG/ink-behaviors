// Type tests. Nothing here runs: `npm run typecheck` fails if a line that
// must compile does not, or if a line marked @ts-expect-error does.
import { useTypeahead, type TypeaheadItem } from '../index.js';

const onMatch = (_index: number) => {};

export function typeTests() {
  // An array written in the call, with fields of its own.
  useTypeahead({
    items: [
      { label: 'Un', value: 1 },
      { label: 'Deux', value: 2, disabled: true },
    ],
    current: 0,
    onMatch,
  });

  // The same through a variable, a readonly array and a plain item list.
  const options = [{ label: 'Un', value: 1, description: 'premier' }];
  useTypeahead({ items: options, current: 0, onMatch });
  const frozen = [{ label: 'Un', icon: '*' }] as const;
  useTypeahead({ items: frozen, current: 0, onMatch });
  const plain: TypeaheadItem[] = [{ label: 'Un' }];
  useTypeahead({ items: plain, current: 0, onMatch });

  // @ts-expect-error an item needs a label
  useTypeahead({ items: [{ value: 1 }], current: 0, onMatch });
  // @ts-expect-error a label is a string
  useTypeahead({ items: [{ label: 1 }], current: 0, onMatch });
  // @ts-expect-error disabled is a boolean
  useTypeahead({ items: [{ label: 'Un', disabled: 'oui' }], current: 0, onMatch });
  // @ts-expect-error strings are not items
  useTypeahead({ items: ['Un'], current: 0, onMatch });

  const result = useTypeahead({ items: plain, current: 0, onMatch });
  const query: string = result.query;
  const used: boolean = result.handleInput('a');
  // @ts-expect-error isSearching was replaced by query
  result.isSearching;
  return { query, used };
}
