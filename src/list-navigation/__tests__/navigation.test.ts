import { describe, expect, it } from 'vitest';
import { move, settle, visibleRows, type ListMove, type ListView } from '../navigation.js';

// A list of `count` items showing `visible` rows. `off` lists disabled indexes.
const list = (count: number, visible = count, off: number[] = [], more: Partial<ListView> = {}): ListView => ({
  count,
  visible,
  isDisabled: (index) => off.includes(index),
  loop: false,
  focusDisabled: false,
  ...more,
});

const at = (current: number, viewportStart = 0) => ({ current, viewportStart });

// Plays several moves in a row and gives the final state.
const play = (view: ListView, from: ReturnType<typeof at>, ...types: ListMove['type'][]) =>
  types.reduce((state, type) => move(view, state, { type } as ListMove), from);

describe('visibleRows', () => {
  it('ne dépasse pas le nombre d’éléments et vaut au moins 1', () => {
    expect(visibleRows(list(10, 4))).toBe(4);
    expect(visibleRows(list(3, 8))).toBe(3);
    expect(visibleRows(list(0, 8))).toBe(1);
    expect(visibleRows(list(10, 0))).toBe(1);
    expect(visibleRows(list(10, 2.9))).toBe(2);
  });
});

describe('settle', () => {
  it('garde un état déjà valide, sans créer d’objet', () => {
    const state = at(2, 1);
    expect(settle(list(10, 4), state)).toBe(state);
  });

  it('ramène le curseur dans la liste quand elle a rétréci', () => {
    expect(settle(list(3, 2), at(8, 6))).toEqual(at(2, 1));
  });

  it('quitte un élément désactivé : vers l’avant d’abord, sinon vers l’arrière', () => {
    expect(settle(list(4, 4, [1]), at(1))).toEqual(at(2));
    expect(settle(list(4, 4, [2, 3]), at(3))).toEqual(at(1));
  });

  it('donne -1 pour une liste vide ou entièrement désactivée', () => {
    expect(settle(list(0), at(0))).toEqual(at(-1));
    expect(settle(list(2, 2, [0, 1]), at(0))).toEqual(at(-1));
  });

  it('reste sur un élément désactivé quand focusDisabled est actif', () => {
    const state = at(1);
    expect(settle(list(3, 3, [1], { focusDisabled: true }), state)).toBe(state);
  });

  it('fait défiler la fenêtre pour montrer le curseur', () => {
    expect(settle(list(10, 3), at(7, 0))).toEqual(at(7, 5));
    expect(settle(list(10, 3), at(1, 4))).toEqual(at(1, 1));
  });
});

describe('move', () => {
  it('suivant et précédent avancent d’un élément', () => {
    expect(play(list(5), at(0), 'next', 'next')).toEqual(at(2));
    expect(play(list(5), at(2), 'previous')).toEqual(at(1));
  });

  it('s’arrête aux deux bouts sans boucle, et rend le même état', () => {
    const top = at(0);
    expect(move(list(3), top, { type: 'previous' })).toBe(top);
    const bottom = at(2);
    expect(move(list(3), bottom, { type: 'next' })).toBe(bottom);
  });

  it('boucle de la fin au début et du début à la fin', () => {
    const view = list(10, 3, [], { loop: true });
    expect(move(view, at(9, 7), { type: 'next' })).toEqual(at(0, 0));
    expect(move(view, at(0, 0), { type: 'previous' })).toEqual(at(9, 7));
  });

  it('saute les éléments désactivés, y compris en bouclant', () => {
    expect(move(list(5, 5, [1, 2]), at(0), { type: 'next' })).toEqual(at(3));
    expect(move(list(5, 5, [1, 2]), at(3), { type: 'previous' })).toEqual(at(0));
    const view = list(4, 4, [0, 3], { loop: true });
    expect(move(view, at(2), { type: 'next' })).toEqual(at(1));
    expect(move(view, at(1), { type: 'previous' })).toEqual(at(2));
  });

  it('ne bouge pas quand tout est désactivé', () => {
    const view = list(3, 3, [0, 1, 2], { loop: true });
    expect(play(view, at(0), 'next', 'previous', 'last', 'pageDown')).toEqual(at(-1));
  });

  it('début et fin vont au premier et au dernier élément actif', () => {
    const view = list(10, 3, [0, 9]);
    expect(move(view, at(5, 4), { type: 'first' })).toEqual(at(1, 1));
    expect(move(view, at(5, 4), { type: 'last' })).toEqual(at(8, 6));
  });

  it('page suivante et page précédente avancent d’une fenêtre', () => {
    const view = list(20, 5);
    expect(move(view, at(2, 0), { type: 'pageDown' })).toEqual(at(7, 5));
    expect(move(view, at(7, 5), { type: 'pageUp' })).toEqual(at(2, 0));
  });

  it('une page s’arrête au bout de la liste et n’en fait pas le tour', () => {
    const view = list(12, 5, [], { loop: true });
    expect(move(view, at(9, 7), { type: 'pageDown' })).toEqual(at(11, 7));
    const end = at(11, 7);
    expect(move(view, end, { type: 'pageDown' })).toBe(end);
    expect(move(view, at(1, 0), { type: 'pageUp' })).toEqual(at(0, 0));
  });

  it('une page qui tombe sur un élément désactivé prend le plus proche', () => {
    // 2 + 5 = 7 est désactivé : on va en 8, le suivant.
    expect(move(list(20, 5, [7]), at(2, 0), { type: 'pageDown' })).toEqual(at(8, 5));
    // La fin est désactivée : on prend le dernier actif avant elle.
    expect(move(list(8, 5, [6, 7]), at(2, 0), { type: 'pageDown' })).toEqual(at(5, 3));
    // Rien d’actif plus loin : on ne recule pas.
    const stuck = at(5, 3);
    expect(move(list(8, 5, [6, 7]), stuck, { type: 'pageDown' })).toBe(stuck);
    expect(move(list(20, 5, [2]), at(7, 5), { type: 'pageUp' })).toEqual(at(1, 0));
  });

  it('aller à un index fait défiler la fenêtre jusqu’à lui', () => {
    expect(move(list(20, 5), at(0, 0), { type: 'to', index: 12 })).toEqual(at(12, 8));
    expect(move(list(20, 5), at(12, 8), { type: 'to', index: 3 })).toEqual(at(3, 3));
  });

  it('refuse un index hors liste ou désactivé', () => {
    const state = at(1);
    const view = list(4, 4, [2]);
    expect(move(view, state, { type: 'to', index: 2 })).toBe(state);
    expect(move(view, state, { type: 'to', index: 9 })).toBe(state);
    expect(move(view, state, { type: 'to', index: -1 })).toBe(state);
    expect(move(view, state, { type: 'to', index: Number.NaN })).toBe(state);
  });

  it('avec focusDisabled, s’arrête sur les éléments désactivés', () => {
    const view = list(4, 4, [1, 2], { focusDisabled: true });
    expect(move(view, at(0), { type: 'next' })).toEqual(at(1));
    expect(move(view, at(0), { type: 'to', index: 2 })).toEqual(at(2));
  });

  it('garde toujours le curseur dans la fenêtre, quelle que soit la suite de touches', () => {
    const types: ListMove['type'][] = ['next', 'previous', 'pageDown', 'pageUp', 'first', 'last'];
    const view = list(23, 4, [0, 5, 6, 22], { loop: true });
    let state = at(0);
    let seed = 7;
    for (let step = 0; step < 2000; step++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      state = move(view, state, { type: types[seed % types.length]! } as ListMove);
      expect(view.isDisabled(state.current)).toBe(false);
      expect(state.current).toBeGreaterThanOrEqual(state.viewportStart);
      expect(state.current).toBeLessThan(state.viewportStart + 4);
      expect(state.viewportStart).toBeGreaterThanOrEqual(0);
      expect(state.viewportStart).toBeLessThanOrEqual(23 - 4);
    }
  });
});
