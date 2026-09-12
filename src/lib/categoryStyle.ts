import type { Category } from "./categories";

// Each category gets a distinct "ink stamp" color used consistently across
// the bar chart, transaction tags, and category dots — so you can recognize
// a category by color at a glance instead of reading every label.
export const CATEGORY_COLORS: Record<Category, string> = {
  Food: "#c1443a",
  Transport: "#3e6e8e",
  Shopping: "#8b5fbf",
  Bills: "#6b6a5e",
  Entertainment: "#d98f3e",
  Groceries: "#3f6b4a",
  Family: "#b2557b",
  Other: "#9c9884",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category as Category] ?? CATEGORY_COLORS.Other;
}
