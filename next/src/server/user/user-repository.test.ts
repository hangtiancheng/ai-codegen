import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { UserRole } from "@/generated/prisma/enums";
import type { PrismaDatabaseClient } from "../database/index";
import { buildUser } from "../test-support/index";
import { createUserRepository } from "./user-repository";

describe("createUserRepository", () => {
  it("findActiveByAccount filters out deleted records", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    const fixture = buildUser({ userAccount: "alice" });
    db.user.findFirst.mockResolvedValue(fixture);

    const repo = createUserRepository(db);
    const result = await repo.findActiveByAccount("alice");

    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { isDelete: false, userAccount: "alice" },
    });
    expect(result).toBe(fixture);
  });

  it("createUser omits userRole when undefined", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.user.create.mockResolvedValue(buildUser());
    const repo = createUserRepository(db);

    await repo.createUser({ userAccount: "bob", userPassword: "secret" });

    expect(db.user.create).toHaveBeenCalledWith({
      data: { userAccount: "bob", userPassword: "secret" },
    });
  });

  it("createUser includes userRole when provided", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.user.create.mockResolvedValue(buildUser({ userRole: UserRole.ADMIN }));
    const repo = createUserRepository(db);

    await repo.createUser({
      userAccount: "carol",
      userPassword: "secret",
      userRole: UserRole.ADMIN,
    });

    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        userAccount: "carol",
        userPassword: "secret",
        userRole: UserRole.ADMIN,
      },
    });
  });

  it("softDeleteById flips isDelete flag", async () => {
    const db = mockDeep<PrismaDatabaseClient>();
    db.user.update.mockResolvedValue(buildUser({ isDelete: true }));
    const repo = createUserRepository(db);

    await repo.softDeleteById(42n);

    expect(db.user.update).toHaveBeenCalledWith({
      data: { isDelete: true },
      where: { id: 42n },
    });
  });
});
