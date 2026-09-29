export type DependencyState =
  | { readonly status: "unavailable" }
  | { readonly status: "available-inactive" }
  | { readonly status: "available-active" };

export function classifyDependency(
  extension: { readonly isActive: boolean } | undefined,
): DependencyState {
  if (extension === undefined) {
    return { status: "unavailable" };
  }
  return {
    status: extension.isActive ? "available-active" : "available-inactive",
  };
}
