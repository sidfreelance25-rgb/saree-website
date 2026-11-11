export const ROLES = ["owner", "manager", "catalogue", "orders", "content"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "products.read",
  "products.write",
  "inventory.write",
  "orders.read",
  "orders.write",
  "customers.read",
  "customers.write",
  "content.write",
  "promotions.write",
  "settings.write",
  "team.write",
  "reports.read",
  "instagram.write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];

const MATRIX: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "team.write" && p !== "settings.write"),
  catalogue: ["products.read", "products.write", "inventory.write"],
  orders: ["orders.read", "orders.write", "customers.read"],
  content: ["products.read", "content.write", "instagram.write"],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission) {
  if (!isRole(role)) return false;
  return MATRIX[role].includes(permission);
}

export function roleLabel(role: string) {
  switch (role) {
    case "owner":
      return "Store owner";
    case "manager":
      return "Store manager";
    case "catalogue":
      return "Catalogue manager";
    case "orders":
      return "Order manager";
    case "content":
      return "Content manager";
    default:
      return role;
  }
}
