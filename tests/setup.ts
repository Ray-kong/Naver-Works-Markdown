import { afterEach } from "vitest";

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});
