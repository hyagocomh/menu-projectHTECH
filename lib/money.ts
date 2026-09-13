export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoneyFromCents(value: number) {
  return brl.format(value / 100);
}
