import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text, useInput } from 'ink';
import {
  useListNavigation,
  useTypeahead,
  type UseListNavigationOptions,
  type UseListNavigationResult,
} from '../../index.js';

// Ink 5, the last Ink that runs on React 18, does not report Home and End:
// the handler gets an empty input and no flag. The tests on these two keys
// are skipped in that run (see compat/react18).
const inkReportsHomeEnd = process.env.INK_BEHAVIORS_COMPAT !== 'react18';

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

const KEY = {
  up: '\u001B[A',
  down: '\u001B[B',
  pageUp: '\u001B[5~',
  pageDown: '\u001B[6~',
  home: '\u001B[H',
  end: '\u001B[F',
  enter: '\r',
  ctrlDown: '\u001B[1;5B',
};

interface Item {
  label: string;
  disabled?: boolean;
}

// "A" to "L": twelve items, enough to scroll a window of four rows.
const letters = (count = 12, off: number[] = []): Item[] =>
  Array.from({ length: count }, (_, index) => ({
    label: String.fromCharCode(65 + index),
    ...(off.includes(index) ? { disabled: true } : {}),
  }));

type HarnessProps = Partial<UseListNavigationOptions<Item>> & {
  typeahead?: boolean;
  seen?: (input: string, used: boolean) => void;
  onSelect?: (item: Item) => void;
  expose?: (nav: UseListNavigationResult) => void;
};

// A list reduced to the minimum: the visible rows, and a mark on the active one.
function Harness({ typeahead = false, seen, onSelect, expose, ...options }: HarnessProps) {
  const items = options.items ?? letters();
  const nav = useListNavigation({ ...options, items });
  const search = useTypeahead({
    items,
    current: nav.current,
    onMatch: nav.moveTo,
    isActive: typeahead,
  });
  expose?.(nav);
  useInput((input, key) => {
    if (search.handleInput(input, key)) {
      return;
    }
    const used = nav.handleInput(input, key);
    seen?.(input, used);
    if (key.return && nav.canSelect) {
      onSelect?.(items[nav.current]!);
    }
  });
  const rows = items
    .slice(nav.viewportStart, nav.viewportEnd)
    .map((item, row) => (nav.viewportStart + row === nav.current ? `>${item.label}` : item.label));
  return <Text>{`${rows.join(' ')} | ${nav.canSelect ? 'ok' : 'non'}`}</Text>;
}

function setup(props: HarnessProps = {}) {
  const seen = vi.fn();
  const onSelect = vi.fn();
  let nav!: UseListNavigationResult;
  const element = (more: HarnessProps = {}) => (
    <Harness seen={seen} onSelect={onSelect} expose={(value) => (nav = value)} {...props} {...more} />
  );
  const view = render(element());
  const press = async (...keys: string[]) => {
    for (const key of keys) {
      view.stdin.write(key);
      await tick();
    }
  };
  const frame = () => view.lastFrame() ?? '';
  return {
    ...view,
    seen,
    onSelect,
    press,
    /** The visible rows, like "A B >C D". */
    rows: () => frame().split(' | ')[0],
    /** The label of the active item. */
    current: () => />(\S+)/.exec(frame())?.[1],
    canSelect: () => frame().endsWith('ok'),
    nav: () => nav,
    update: async (more: HarnessProps) => {
      view.rerender(element(more));
      await tick();
    },
  };
}

describe('useListNavigation', () => {
  it('commence sur le premier élément et montre toute la liste par défaut', async () => {
    const s = setup({ items: letters(3) });
    await tick();
    expect(s.rows()).toBe('>A B C');
    expect(s.nav()).toMatchObject({ current: 0, viewportStart: 0, viewportEnd: 3, canSelect: true });
  });

  it('descend et monte avec les flèches', async () => {
    const s = setup();
    await tick();
    await s.press(KEY.down, KEY.down);
    expect(s.current()).toBe('C');
    await s.press(KEY.up);
    expect(s.current()).toBe('B');
  });

  it.skipIf(!inkReportsHomeEnd)('va au début et à la fin avec Début et Fin', async () => {
    const s = setup({ visibleCount: 4 });
    await tick();
    await s.press(KEY.end);
    expect(s.rows()).toBe('I J K >L');
    await s.press(KEY.home);
    expect(s.rows()).toBe('>A B C D');
  });

  it('avance et recule d’une fenêtre avec Page suivante et Page précédente', async () => {
    const s = setup({ visibleCount: 4 });
    await tick();
    await s.press(KEY.down, KEY.pageDown);
    expect(s.rows()).toBe('E >F G H');
    await s.press(KEY.pageDown, KEY.pageDown);
    expect(s.rows()).toBe('I J K >L');
    await s.press(KEY.pageUp);
    expect(s.rows()).toBe('E F G >H');
  });

  it('ne boucle pas par défaut', async () => {
    const s = setup({ items: letters(3) });
    await tick();
    await s.press(KEY.up);
    expect(s.current()).toBe('A');
    await s.press(KEY.down, KEY.down, KEY.down);
    expect(s.current()).toBe('C');
  });

  it('boucle de la fin au début quand loop est actif', async () => {
    const s = setup({ visibleCount: 4, loop: true });
    await tick();
    await s.press(KEY.up);
    expect(s.rows()).toBe('I J K >L');
    await s.press(KEY.down);
    expect(s.rows()).toBe('>A B C D');
  });

  it('saute les éléments désactivés', async () => {
    const s = setup({ items: letters(5, [0, 2, 3]) });
    await tick();
    // Le premier est désactivé : on commence sur le suivant.
    expect(s.current()).toBe('B');
    await s.press(KEY.down);
    expect(s.current()).toBe('E');
    await s.press(KEY.up);
    expect(s.current()).toBe('B');
    s.nav().first();
    await tick();
    expect(s.current()).toBe('B');
  });

  it('n’a pas d’élément actif quand tout est désactivé', async () => {
    const s = setup({ items: letters(3, [0, 1, 2]) });
    await tick();
    await s.press(KEY.down, KEY.enter);
    expect(s.rows()).toBe('A B C');
    expect(s.nav().current).toBe(-1);
    expect(s.canSelect()).toBe(false);
    expect(s.onSelect).not.toHaveBeenCalled();
  });

  it('accepte une liste vide', async () => {
    const s = setup({ items: [] });
    await tick();
    await s.press(KEY.down, KEY.pageDown, KEY.up);
    expect(s.nav()).toMatchObject({ current: -1, viewportStart: 0, viewportEnd: 0, canSelect: false });
  });

  describe('fenêtre', () => {
    it('défile pour garder l’élément actif affiché', async () => {
      const s = setup({ visibleCount: 4 });
      await tick();
      await s.press(KEY.down, KEY.down, KEY.down);
      expect(s.rows()).toBe('A B C >D');
      await s.press(KEY.down);
      expect(s.rows()).toBe('B C D >E');
      await s.press(KEY.up, KEY.up, KEY.up, KEY.up);
      expect(s.rows()).toBe('>A B C D');
    });

    it('suit la liste quand elle rétrécit', async () => {
      const s = setup({ visibleCount: 4 });
      await tick();
      await s.press(KEY.pageDown, KEY.pageDown, KEY.pageDown);
      expect(s.current()).toBe('L');
      await s.update({ items: letters(6) });
      expect(s.rows()).toBe('C D E >F');
    });

    it('suit visibleCount quand il change', async () => {
      const s = setup({ visibleCount: 4 });
      await tick();
      await s.press(KEY.pageDown, KEY.pageDown, KEY.pageDown);
      await s.update({ visibleCount: 2 });
      expect(s.rows()).toBe('K >L');
      await s.update({ visibleCount: 40 });
      expect(s.rows()).toBe('A B C D E F G H I J K >L');
    });

    it('quitte l’élément actif s’il devient désactivé', async () => {
      const s = setup({ items: letters(4) });
      await tick();
      await s.press(KEY.down);
      await s.update({ items: letters(4, [1]) });
      expect(s.current()).toBe('C');
    });
  });

  describe('avec useTypeahead', () => {
    it('la fenêtre défile jusqu’à l’élément trouvé par le typeahead', async () => {
      const s = setup({ visibleCount: 4, typeahead: true });
      await tick();
      expect(s.rows()).toBe('>A B C D');
      await s.press('k');
      expect(s.rows()).toBe('H I J >K');
      // Laisser passer le délai : sinon "b" complète la recherche en "kb".
      await tick(600);
      await s.press('b');
      expect(s.rows()).toBe('>B C D E');
    });

    it('les flèches repartent de l’élément trouvé', async () => {
      const s = setup({ visibleCount: 4, typeahead: true });
      await tick();
      await s.press('k', KEY.down);
      expect(s.rows()).toBe('I J K >L');
    });

    it('les deux hooks sautent les mêmes éléments désactivés', async () => {
      const items = [
        { label: 'Annuler' },
        { label: 'Éditer', disabled: true },
        { label: 'Envoyer' },
      ];
      const s = setup({ items, typeahead: true });
      await tick();
      await s.press('e');
      expect(s.current()).toBe('Envoyer');
      await s.press(KEY.up);
      expect(s.current()).toBe('Annuler');
    });
  });

  describe('focusDisabled', () => {
    it('s’arrête sur un élément désactivé sans permettre de le valider', async () => {
      const s = setup({ items: letters(3, [1]), focusDisabled: true });
      await tick();
      await s.press(KEY.down);
      expect(s.current()).toBe('B');
      expect(s.canSelect()).toBe(false);
      await s.press(KEY.enter);
      expect(s.onSelect).not.toHaveBeenCalled();
      await s.press(KEY.down, KEY.enter);
      expect(s.current()).toBe('C');
      expect(s.onSelect).toHaveBeenCalledTimes(1);
      expect(s.onSelect).toHaveBeenCalledWith({ label: 'C' });
    });

    it('peut commencer sur un élément désactivé', async () => {
      const s = setup({ items: letters(3, [0]), focusDisabled: true });
      await tick();
      expect(s.current()).toBe('A');
      expect(s.canSelect()).toBe(false);
    });
  });

  describe('touches', () => {
    it('dit vrai pour ses touches, même au bout de la liste', async () => {
      const s = setup({ items: letters(3) });
      await tick();
      await s.press(KEY.up, KEY.down, KEY.pageDown, KEY.pageUp);
      expect(s.seen.mock.calls.map((call) => call[1])).toEqual([true, true, true, true]);
    });

    it.skipIf(!inkReportsHomeEnd)('dit vrai pour Début et Fin', async () => {
      const s = setup({ items: letters(3) });
      await tick();
      await s.press(KEY.home, KEY.end);
      expect(s.seen.mock.calls.map((call) => call[1])).toEqual([true, true]);
    });

    it('laisse les lettres, Entrée et ctrl+flèche à l’appelant', async () => {
      const s = setup();
      await tick();
      await s.press('j', KEY.enter, KEY.ctrlDown);
      expect(s.seen.mock.calls.map((call) => call[1])).toEqual([false, false, false]);
      expect(s.current()).toBe('A');
    });

    it('ne fait rien quand isActive est faux', async () => {
      const s = setup({ isActive: false });
      await tick();
      await s.press(KEY.down);
      expect(s.current()).toBe('A');
      expect(s.seen).toHaveBeenLastCalledWith('', false);
    });

    it('accepte un appel sans objet de touche', async () => {
      const s = setup();
      await tick();
      expect(s.nav().handleInput('x')).toBe(false);
    });
  });

  describe('actions', () => {
    it('moveTo, next, previous, first, last, pageDown et pageUp déplacent le curseur', async () => {
      const s = setup({ visibleCount: 4 });
      await tick();
      const act = async (run: (nav: UseListNavigationResult) => void) => {
        run(s.nav());
        await tick();
        return s.rows();
      };
      expect(await act((nav) => nav.moveTo(6))).toBe('D E F >G');
      expect(await act((nav) => nav.next())).toBe('E F G >H');
      expect(await act((nav) => nav.previous())).toBe('E F >G H');
      expect(await act((nav) => nav.last())).toBe('I J K >L');
      expect(await act((nav) => nav.first())).toBe('>A B C D');
      expect(await act((nav) => nav.pageDown())).toBe('>E F G H');
      expect(await act((nav) => nav.pageUp())).toBe('>A B C D');
    });

    it('deux actions dans le même instant s’ajoutent', async () => {
      const s = setup();
      await tick();
      s.nav().next();
      s.nav().next();
      await tick();
      expect(s.current()).toBe('C');
    });

    it('les actions gardent la même identité d’un affichage à l’autre', async () => {
      const s = setup();
      await tick();
      const before = s.nav();
      await s.press(KEY.down);
      const after = s.nav();
      expect(after.handleInput).toBe(before.handleInput);
      expect(after.moveTo).toBe(before.moveTo);
    });

    it('respecte initialIndex', async () => {
      const s = setup({ visibleCount: 4, initialIndex: 9 });
      await tick();
      expect(s.rows()).toBe('G H I >J');
    });
  });
});
