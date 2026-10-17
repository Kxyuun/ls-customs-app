// Every price string in the UI goes through here. Amounts come from
// serviceData.js only. Base prices are starting prices; the final amount is on
// the invoice before work begins.
function peso(n) { return '\u20B1' + n.toLocaleString('en-PH'); }

export function formatStartingPrice(price) {
  return price === 0 ? 'Free' : 'Starting from ' + peso(price);
}

// Bare amount (no wording), for places that already have a "Starting From" label.
export function formatPrice(price) {
  return price === 0 ? 'Free' : peso(price);
}

// Add-ons show the extra cost they add on top of the base service.
export function formatAddonPrice(price) {
  return '+' + peso(price);
}

export function formatEstimatedTotal(total) {
  return total === 0 ? 'To be discussed' : peso(total);
}

export function formatEstimatedTotalPdf(total) {
  return total === 0 ? 'To be discussed' : 'PHP ' + total.toLocaleString('en-PH') + ' (starting price)';
}
