// Server-side price list and booking price calculation. The browser never decides the total;
// keep these tables in sync with the frontend src/data/serviceData.js.

// Base price per service type. Car Wash is priced by vehicle type.
const SERVICE_PRICES = {
  'Auto Care': 3500,
  'Core Fix': 4000,
  'Vehicle Mod': 23000,
  'Body Work': 25000,
  
  'Car Wash': { Sedan: 350, SUV: 500, Motorcycle: 200 },
  'Not Sure? Get a Consultation': 0,
};
const CONSULTATION = 'Not Sure? Get a Consultation';


// Optional additional services, grouped by the service type they belong to.
const ADDONS = {
  'Auto Care': { 'Engine Flush': 1200, 'Wheel Alignment': 1500, 'Aircon Cleaning': 1800, 'Headlight Restoration': 1500 },
  'Core Fix': { 'Computer Diagnostic Scan': 1000, 'Brake Fluid Flush': 1200, 'Battery Replacement': 500, 'Test Drive Report': 300 },
  'Vehicle Mod': { 'Window Tint': 6000, 'Underglow Lights': 4500, 'Custom Decals': 3500, 'Sport Exhaust Tip': 2500 },
  'Body Work': { 'Ceramic Coating': 12000, 'Paint Protection Film': 6000, 'Minor Dent Repair': 1500, 'Rust Proofing': 3500 },
  'Car Wash': { 'Underwash': 300, 'Engine Bay Wash': 500, 'Wax Polish': 800, 'Interior Deep Clean': 1200 },
};

// Price of one service for a vehicle, or null if the service is unknown.
function priceOf(service, vehicle) {
  const p = SERVICE_PRICES[service];
  if (p === undefined) return null;
  return typeof p === 'number' ? p : (p[vehicle] !== undefined ? p[vehicle] : null);
}


// Validates the chosen services/extras and returns {serviceTypes, addons, services, total}, or {error}.
function priceBooking(vehicle, serviceTypes, addons) {
  const types = Array.isArray(serviceTypes) ? serviceTypes.map(String) : [];
  const extras = Array.isArray(addons) ? addons.map(String) : [];
  if (!types.length) return { error: 'Pick a service' };
  if (new Set(types).size !== types.length) return { error: 'Duplicate service' };
  if (new Set(extras).size !== extras.length) return { error: 'Duplicate additional service' };

  if (types.includes(CONSULTATION) && (types.length > 1 || extras.length)) {
    return { error: 'Consultation cannot be combined with other services' };
  }

  let total = 0;
  for (const t of types) {
    const p = priceOf(t, vehicle);
    if (p === null) return { error: 'Unknown service' };
    total += p;
  }
  for (const a of extras) {
    
    const owner = types.find((t) => ADDONS[t] && ADDONS[t][a] !== undefined);
    if (!owner) return { error: 'Additional service does not match the chosen services' };
    total += ADDONS[owner][a];
  }
  return { serviceTypes: types, addons: extras, services: types.concat(extras), total };
}

module.exports = { priceBooking, SERVICE_PRICES, ADDONS };
