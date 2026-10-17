// Business facts used across the site. Values here were carried over from the
// existing site content — the owner should confirm phone/email/address before
// launch. Nothing new was invented.
export var businessInfo = {
  name: 'LS Customs',
  established: 2019,
  cityLabel: 'Pasay City, PH',
  timeZone: 'Asia/Manila',
  address: '123 Pickup Coffee, Pasay City, PH',
  coordinates: { lat: 14.5309, lng: 120.9819 },
  phone: '+63 917 676 6767',
  email: 'lscustoms.pasay@gmail.com'
};

export function currentYear() {
  return new Date().getFullYear();
}

export function yearsRunning() {
  return Math.max(0, currentYear() - businessInfo.established);
}

export function phoneHref() {
  return 'tel:' + businessInfo.phone.replace(/[^+\d]/g, '');
}

export function emailHref() {
  return 'mailto:' + businessInfo.email;
}

export function directionsUrl() {
  var c = businessInfo.coordinates;
  return 'https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng;
}
