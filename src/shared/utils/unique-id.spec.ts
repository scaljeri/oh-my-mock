import { uniqueId } from "./unique-id";

describe('Utils/UniqueId', () => {
  it('should generate and id with default length', () => {
    expect(uniqueId().length).toBe(10);
  });

  it('should generate and id with specified length', () => {
    expect(uniqueId(12).length).toBe(12);
  });
});
