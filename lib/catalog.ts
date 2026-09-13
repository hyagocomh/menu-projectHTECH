import menuJson from "@/data/menu.json";

export type CategoryId = keyof typeof menuJson;

export type Product = {
  id: string;
  img: string;
  name: string;
  dsc: string;
  price: number;
};

export const menu = menuJson as Record<CategoryId, Product[]>;

export const categories: Array<{
  id: CategoryId;
  label: string;
  icon: string;
}> = [
  { id: "burgers", label: "Burguers", icon: "fas fa-hamburger" },
  { id: "pizzas", label: "Pizzas", icon: "fas fa-pizza-slice" },
  { id: "churrasco", label: "Churrasco", icon: "fas fa-drumstick-bite" },
  { id: "steaks", label: "Steaks", icon: "fas fa-bacon" },
  { id: "bebidas", label: "Bebidas", icon: "fas fa-cocktail" },
  { id: "sobremesas", label: "Sobremesas", icon: "fas fa-ice-cream" },
];

const products = Object.values(menu).flat();
const productIndex = new Map(products.map((product) => [product.id, product]));

export function findProduct(productId: string) {
  return productIndex.get(productId);
}

export function priceToCents(price: number) {
  return Math.round(price * 100);
}
