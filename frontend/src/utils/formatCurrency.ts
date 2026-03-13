export const formatCurrency = (
  amount: number,
  currency = 'INR',
  locale = 'en-IN',
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
