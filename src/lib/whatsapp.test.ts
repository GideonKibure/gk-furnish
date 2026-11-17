import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsAppLink, normaliseWhatsAppNumber, whatsAppOrderText } from "./whatsapp.ts";

test("a plus, a local zero, and spaces all become the same WhatsApp number", () => {
  assert.equal(normaliseWhatsAppNumber("+255 692 713 993"), "255692713993");
  assert.equal(normaliseWhatsAppNumber("0692713993"), "255692713993");
  assert.equal(normaliseWhatsAppNumber("255 692 713 993"), "255692713993");
});

test("the link is wa.me with the message encoded and no image attached", () => {
  const href = buildWhatsAppLink({
    number: "0692 713 993",
    text: "Hello GK Furnish\nStar Bed\nhttps://gkfurnish.co.tz/products/star-bed",
  });
  assert.equal(
    href,
    "https://wa.me/255692713993?text=Hello%20GK%20Furnish%0AStar%20Bed%0Ahttps%3A%2F%2Fgkfurnish.co.tz%2Fproducts%2Fstar-bed",
  );
  assert.equal(href.includes("media"), false);
});

test("blank lines are left out of the prefilled message", () => {
  assert.equal(whatsAppOrderText(["Hello", "  ", "Star Bed"]), "Hello\nStar Bed");
});
