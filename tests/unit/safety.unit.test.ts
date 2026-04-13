import { findBlockedWord } from "../../src/common/safety";

describe("safety helper", () => {
  it("returns null if text is clean", () => {
    expect(findBlockedWord("welcome to BBYO Connect")).toBeNull();
  });

  it("flags configured banned words", () => {
    const result = findBlockedWord("this text has hateword1 inside");
    expect(result).toBe("hateword1");
  });
});
