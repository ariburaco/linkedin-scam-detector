import { PrismaClient } from "../prisma/generated/client";
const prisma = new PrismaClient();
export type { JsonValue, InputJsonValue } from "@prisma/client/runtime/library";
export default prisma;

export type * from "../prisma/generated/client";
