import test from "node:test";
import assert from "node:assert/strict";
import { findStrayLocations, levelAliases, slotTotal } from "../src/utils/locationKeys.js";

const main = { id: "main", shelves: [{ rows: 2, levelsPerFila: 1 }, { rows: 1, type: "double", levelsPerFila: 2 }] };
const bodega = { id: "bodega", shelves: [{ rows: 1, levelsPerFila: 1 }] };
const layouts = [main, bodega];

test("el primer layout acepta los tres formatos de clave", () => {
  assert.deepEqual(levelAliases(layouts, main, 1, 0, 0, "A"), ["main__1-0-0-A", "1-0-0-A", "1-0-A"]);
  assert.deepEqual(levelAliases(layouts, main, 1, 0, 1, "A"), ["main__1-0-1-A", "1-0-1-A"]);
  assert.deepEqual(levelAliases(layouts, bodega, 0, 0, 0, "A"), ["bodega__0-0-0-A"]);
});

test("el total de un casillero no suma stock de otro layout ni de niveles inexistentes", () => {
  const products = [
    { id: "a", locations: { "1-0-A": 5, "main__1-0-1-A": 3 } },
    { id: "b", locations: { "bodega__1-0-0-A": 100, "main__1-0-7-A": 50, "main__1-0-0-B": 2 } },
  ];
  assert.equal(slotTotal(layouts, main, products, 1, 0, "A"), 8);
  assert.equal(slotTotal(layouts, main, products, 1, 0, "B"), 2);
});

test("detecta ubicaciones que ningún casillero muestra", () => {
  const products = [
    {
      id: "a",
      name: "A",
      locations: {
        "1-0-A": 5,
        "main__0-1-0-A": 1,
        "bodega__1-0-0-A": 100,
        "main__1-0-7-A": 50,
        "borrado__0-0-0-A": 4,
        "main__0-0-0-A": 0,
      },
    },
  ];
  assert.deepEqual(
    findStrayLocations(layouts, products).map((s) => s.key).sort(),
    ["bodega__1-0-0-A", "borrado__0-0-0-A", "main__0-0-0-A", "main__1-0-7-A"],
  );
});

test("sin layouts cargados no marca nada para borrar", () => {
  assert.deepEqual(findStrayLocations([], [{ id: "a", locations: { "x": 1 } }]), []);
});
