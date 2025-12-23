import { v5 as uuidv5 } from "uuid";

// Fixed namespace for your app (DO NOT CHANGE after production)
const NAMESPACE = "8b52a3a0-6b4f-4c62-9e4b-1a9f4e6b0c11";

export function getThreadId(userA: string, userB: string) {
  const key = [userA, userB].sort().join(":");
  return uuidv5(key, NAMESPACE);
}
