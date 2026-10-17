// Base/starting prices for each service. This is the single source of
// truth for pricing across the whole app: the Home page's "Starting From"
// prices and the Booking page's base prices both read from here, so they
// can never drift out of sync. Additional services picked in Booking add
// on top of a chosen base price — see serviceOptions below.
export var serviceDetails = {
  'auto-care': {
    kicker: 'Routine Maintenance',
    title: 'Auto Care',
    price: 3500,
    items: [
      'Engine oil and filter change',
      'Tire rotation and pressure check',
      'Brake fluid, coolant, and transmission fluid top-up',
      'Battery health check',
      'Multi-point visual inspection'
    ]
  },
  'core-fix': {
    kicker: 'Damage Repairs',
    title: 'Core Fix',
    price: 4000,
    items: [
      'Engine diagnostics and repair',
      'Transmission repair or replacement',
      'Brake system repair (pads, rotors, lines)',
      'Electrical system troubleshooting and fixes',
      'Follow-up test drive after repair'
    ]
  },
  'vehicle-mod': {
    kicker: 'Modifications',
    title: 'Vehicle Mod',
    price: 23000,
    items: [
      'Custom paint jobs and wraps',
      'Body kit installation',
      'Engine performance upgrades',
      'Suspension and exhaust modifications',
      'Consultation on parts compatibility before work starts'
    ]
  },
  'body-work': {
    kicker: 'Structure Repair',
    title: 'Body Work',
    price: 25000,
    items: [
      'Dent and scratch removal',
      'Panel replacement after collision',
      'Frame straightening',
      'Rust treatment and repainting',
      'Photo documentation before and after'
    ]
  },
  // Car Wash is the ONLY service priced by vehicle type. `price` is the lowest
  // (starting) price; `vehiclePrices` is what is actually charged.
  // PLACEHOLDER PRICES - the owner must confirm them. The backend keeps the same
  // table in ls-customs-api/utils/pricing.js (keep both in sync).
  'car-wash': {
    kicker: 'Cleaning',
    title: 'Car Wash',
    price: 200,
    vehiclePrices: { Sedan: 350, SUV: 500, Motorcycle: 200 },
    items: [
      'Exterior hand wash and dry',
      'Wheel, tire and rim cleaning',
      'Interior vacuum and dashboard wipe-down',
      'Window and mirror cleaning',
      'Price depends on vehicle type (sedan, SUV or motorcycle)'
    ]
  },
  'consultation': {
    kicker: 'Not Sure What You Need?',
    title: 'Consultation',
    price: 0,
    items: [
      'A technician inspects your vehicle in person',
      "We walk you through what's actually wrong",
      'You get an honest recommendation, no pressure to upsell',
      'Free — you only pay if you decide to book a service after'
    ]
  }
};

// Flat list built from serviceDetails above, in the shape the Booking page
// needs (a value label + price + the matching detail key for the "What's
// Included" modal). Home.js reads serviceDetails[key].price directly for
// its "Starting From" prices, so both pages always show the same numbers.
export var serviceOptions = [
  { value: 'Auto Care', price: serviceDetails['auto-care'].price, detail: 'auto-care' },
  { value: 'Core Fix', price: serviceDetails['core-fix'].price, detail: 'core-fix' },
  { value: 'Vehicle Mod', price: serviceDetails['vehicle-mod'].price, detail: 'vehicle-mod' },
  { value: 'Body Work', price: serviceDetails['body-work'].price, detail: 'body-work' },
  { value: 'Car Wash', price: serviceDetails['car-wash'].price, vehiclePrices: serviceDetails['car-wash'].vehiclePrices, detail: 'car-wash' },
  { value: 'Not Sure? Get a Consultation', price: serviceDetails['consultation'].price, detail: 'consultation' }
];

// Optional additional services, grouped by the service type (detail key) they
// belong to. The booking page shows the group of the service type the customer
// clicked LAST. Each extra is a flat price for any vehicle.
// PLACEHOLDER PRICES - the owner must confirm them. The backend keeps the same
// table in ls-customs-api/utils/pricing.js (ADDONS); keep both in sync.
export var serviceAddons = {
  'auto-care': [
    { value: 'Engine Flush', price: 1200 },
    { value: 'Wheel Alignment', price: 1500 },
    { value: 'Aircon Cleaning', price: 1800 },
    { value: 'Headlight Restoration', price: 1500 }
  ],
  'core-fix': [
    { value: 'Computer Diagnostic Scan', price: 1000 },
    { value: 'Brake Fluid Flush', price: 1200 },
    { value: 'Battery Replacement', price: 500 },
    { value: 'Test Drive Report', price: 300 }
  ],
  'vehicle-mod': [
    { value: 'Window Tint', price: 6000 },
    { value: 'Underglow Lights', price: 4500 },
    { value: 'Custom Decals', price: 3500 },
    { value: 'Sport Exhaust Tip', price: 2500 }
  ],
  'body-work': [
    { value: 'Ceramic Coating', price: 12000 },
    { value: 'Paint Protection Film', price: 6000 },
    { value: 'Minor Dent Repair', price: 1500 },
    { value: 'Rust Proofing', price: 3500 }
  ],
  'car-wash': [
    { value: 'Underwash', price: 300 },
    { value: 'Engine Bay Wash', price: 500 },
    { value: 'Wax Polish', price: 800 },
    { value: 'Interior Deep Clean', price: 1200 }
  ]
};

// Price of a service for a vehicle type. Services without `vehiclePrices` cost
// the same for every vehicle. Falls back to the starting price if no vehicle
// has been picked yet.
export function priceForVehicle(option, vehicle) {
  if (option && option.vehiclePrices && vehicle && option.vehiclePrices[vehicle] !== undefined) {
    return option.vehiclePrices[vehicle];
  }
  return option ? option.price : 0;
}

export default serviceDetails;
