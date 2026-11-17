import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityFact,
  canAddPricedProduct,
  deliveryFact,
  lowStockLeft,
  measureCm,
  parseDeliveryZones,
  priceHintAmount,
} from "./product-facts.ts";

test("a missing availability column shows nothing", () => {
  assert.equal(availabilityFact({}), null);
  assert.equal(availabilityFact({ availability_type: "made_to_order" }), null);
  assert.deepEqual(availabilityFact({ availability_type: "ready" }), { kind: "ready" });
  assert.deepEqual(availabilityFact({ availability_type: "made_to_order", lead_time_days: 14 }), {
    kind: "made",
    days: 14,
  });
});

test("a hinted unpriced product cannot be added to the cart and is not TZS 0", () => {
  assert.equal(priceHintAmount({ price_hint_tzs_from: 150000 }, true), 150000);
  assert.equal(priceHintAmount({ price_hint_tzs_from: 0 }, true), null);
  assert.equal(priceHintAmount({ price_hint_tzs_from: 150000 }, false), null);
  assert.equal(canAddPricedProduct(true, true), false);
  assert.equal(canAddPricedProduct(false, true), true);
});

test("low stock uses the real count only when it is small", () => {
  assert.equal(lowStockLeft(2), 2);
  assert.equal(lowStockLeft(0), null);
  assert.equal(lowStockLeft(12), null);
  assert.equal(lowStockLeft(undefined), null);
});

test("delivery text follows free, estimated, and unknown", () => {
  const zones = parseDeliveryZones([
    { region: "Mbeya", fee_tzs: 0 },
    { region: "Dar es Salaam", fee_tzs: 45000 },
    { region: "", fee_tzs: 1000 },
  ]);
  assert.deepEqual(deliveryFact({ region: "", freeForRegion: false, zones }), { kind: "confirm" });
  assert.deepEqual(deliveryFact({ region: "Mbeya", freeForRegion: true, zones }), { kind: "free", region: "Mbeya" });
  assert.deepEqual(deliveryFact({ region: "Dar es Salaam", freeForRegion: false, zones }), {
    kind: "estimate",
    region: "Dar es Salaam",
    fee: 45000,
  });
  assert.deepEqual(deliveryFact({ region: "Mbeya", freeForRegion: false, zones }), { kind: "confirm" });
  assert.equal(parseDeliveryZones(undefined).length, 0);
});

test("blank centimetre fields are omitted", () => {
  assert.equal(measureCm(null), null);
  assert.equal(measureCm(0), null);
  assert.equal(measureCm(90.24), 90.2);
});
