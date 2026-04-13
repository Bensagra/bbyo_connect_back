import { canModerate, canPublishFeed, canUseMessaging } from "../../src/common/permissions";

describe("permissions helper", () => {
  it("validates feed publish permissions", () => {
    expect(canPublishFeed("teen_verified")).toBe(true);
    expect(canPublishFeed("chapter_verified")).toBe(true);
    expect(canPublishFeed("teen_pending")).toBe(false);
    expect(canPublishFeed("guest")).toBe(false);
  });

  it("validates messaging permissions", () => {
    expect(canUseMessaging("teen_verified")).toBe(true);
    expect(canUseMessaging("chapter_verified")).toBe(true);
    expect(canUseMessaging("teen_pending")).toBe(false);
  });

  it("validates moderation role check", () => {
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("advisor")).toBe(true);
    expect(canModerate("teen_verified")).toBe(false);
  });
});
