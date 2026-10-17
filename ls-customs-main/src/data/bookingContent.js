// Booking-flow content that isn't a service or a price (those live in
// serviceData.js). Kept in one place so Home and Book can't drift apart.
export var vehicleOptions = [
  { value: 'Sedan', sub: 'Compact / Midsize' },
  { value: 'SUV', sub: 'Crossover / Pickup' },
  { value: 'Motorcycle', sub: 'All sizes' }
];

export var payOptions = ['GCash', 'Maya', 'Cash'];

// Only Car Wash is priced by vehicle type; every other service has one price.
export var vehicleStepSub = "Tell us if it's a sedan, SUV, or motorcycle so we know what's rolling in. Car Wash is priced by vehicle type; other services aren't.";

export var pricingNote = 'Prices shown are starting prices. The final amount is on your invoice before work begins.';
