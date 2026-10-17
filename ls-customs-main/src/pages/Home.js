import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import ServiceModal from '../components/ServiceModal.js';
import { serviceDetails, serviceOptions } from '../data/serviceData.js';
import { payOptions, vehicleStepSub } from '../data/bookingContent.js';
import { openDaysPerWeek, weeklyHoursRows, hoursSummary, closedDaysText } from '../data/businessHours.js';
import { businessInfo, directionsUrl, emailHref, phoneHref, yearsRunning } from '../data/businessInfo.js';
import { formatPrice } from '../utils/pricing.js';
import { usePageTitle } from '../utils/usePageTitle.js';
import lscWorkshopImage from '../assets/lsc.jpg';
import autoCareImage from '../assets/maintenance.jpg';
import coreFixImage from '../assets/core-fix.jpg';
import vehicleModImage from '../assets/vehicle-mod.jpg';
import bodyWorkImage from '../assets/body-work.jpg';

// Starting prices come straight from serviceDetails (src/data/serviceData.js),
// the same source Book.js uses for its base prices, so these numbers can
// never drift out of sync with the Booking page.
function startingPrice(key) {
  return formatPrice(serviceDetails[key].price);
}

var serviceCards = [
  {
    key: 'auto-care',
    num: '01',
    img: autoCareImage,
    kicker: 'Routine Maintenance',
    title: 'Auto Care',
    desc: 'Regular upkeep services like oil changes, tire rotations, and fluid flushes to prevent breakdowns.',
    price: startingPrice('auto-care')
  },
  {
    key: 'core-fix',
    num: '02',
    img: coreFixImage,
    kicker: 'Damage Repairs',
    title: 'Core Fix',
    desc: 'Fixing or replacing broken core parts like the engine, transmission, brakes, or electrical systems.',
    price: startingPrice('core-fix')
  },
  {
    key: 'vehicle-mod',
    num: '03',
    img: vehicleModImage,
    kicker: 'Modifications',
    title: 'Vehicle Mod',
    desc: "Modifying the vehicle's look and performance through custom paint, body kits, wraps, and engine upgrades.",
    price: startingPrice('vehicle-mod')
  },
  {
    key: 'body-work',
    num: '04',
    img: bodyWorkImage,
    kicker: 'Structure Repair',
    title: 'Body Work',
    desc: "Fixing structural damage, dents, and scratches after an accident to restore the car's shape.",
    price: startingPrice('body-work')
  }
];

var weeklyHours = weeklyHoursRows();

var howToBook = [
  { num: '01', title: 'Pick your vehicle', desc: vehicleStepSub },
  { num: '02', title: 'Choose a service', desc: 'Select one or more from our menu: Auto care, core fix, vehicle mod, or body work.' },
  { num: '03', title: 'Set your schedule', desc: 'Pick a date and a time slot (' + hoursSummary() + '). We\u2019ll hold it for you.' },
  { num: '04', title: 'Confirm & pay', desc: "Review the details, choose GCash, Maya, or cash. Done. We'll see you then." }
];

var trustCards = [
  {
    title: 'Verified Technicians',
    desc: "Every mechanic on our floor has been background-checked, licensed, and assessed. We don't hire people we wouldn't trust with our own car.",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 11 15 16 9"></polyline></svg>
    )
  },
  {
    title: 'On Time, Everytime',
    desc: "We give you a real ETA and we keep it. If something changes, you hear it from us first, not after you've already shown up.",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    )
  },
  {
    title: 'Photo Documentation',
    desc: 'We photograph your vehicle before and after every job. No disputes. No he-said-she-said. Just proof that we did what we said we\u2019d do.',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
    )
  },
  {
    title: 'Transparent Pricing',
    desc: 'You get a full invoice before we touch anything. Listed prices are starting prices \u2014 the invoice shows the final amount, with no hidden charges and no surprise add-ons.',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M4 2h13l3 3v17H4z"></path><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="13" y2="16"></line></svg>
    )
  }
];

var heroStats = [
  { num: String(yearsRunning()), label: 'Years Running' },
  { num: String(serviceOptions.filter(function (o) { return o.price > 0; }).length), label: 'Service Types' },
  { num: String(openDaysPerWeek()), label: 'Days Open / Week' },
  { num: String(payOptions.length), label: 'Payment Options' }
];

function Home() {
  var [activeDetail, setActiveDetail] = useState(null);
  usePageTitle('LS Customs \u2014 Pasay City Auto Shop');

  return (
    <>
      <Header variant="public" />

      <section className="hero">
        <div className="container">
          <div>
            <p className="hero-tag mono">Est. {businessInfo.established} — {businessInfo.cityLabel}</p>
            <h1><span className="yellow">Laging sira?</span><br />we can<br />fix it!</h1>
            <p className="hero-sub">Repairs so fast, your insurance company won't even believe it.</p>
            <div className="hero-actions">
              <Link to={{ pathname: '/', hash: '#services' }} className="btn btn-red">View Services</Link>
              <Link to="/account" className="btn btn-outline">My Bookings</Link>
            </div>
          </div>

          <div className="hero-media">
            <div className="hero-media-frame">
              <img src={lscWorkshopImage} alt="LS Customs workshop floor" />
              <div className="cam-label mono">
                <span>CAM-01 // WORKSHOP-FLOOR</span>
                <span>REC &#9679;</span>
              </div>
            </div>
            <div className="stat-bar">
              {heroStats.map(function (stat) {
                return (
                  <div className="stat" key={stat.label}>
                    <div className="stat-num">{stat.num}</div>
                    <div className="stat-label mono">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Service Menu</span>
          </div>

          <div className="service-grid">
            {serviceCards.map(function (svc) {
              return (
                <div className="service-card" key={svc.key}>
                  <div
                    className="service-num"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)), url(\'' + svc.img + '\')' }}
                  >
                    <span>{svc.num}</span>
                  </div>
                  <div className="service-body">
                    <p className="service-kicker mono">{svc.kicker}</p>
                    <h3 className="service-title">{svc.title}</h3>
                    <p className="service-desc">{svc.desc}</p>
                    <p className="service-kicker mono" style={{ marginBottom: 0 }}>Starting From</p>
                    <button
                      type="button"
                      className="service-info-link mono"
                      onClick={function () { setActiveDetail(svc.key); }}
                    >
                      What's Included &darr;
                    </button>
                    <div className="service-foot">
                      <span className="service-price">{svc.price}</span>
                      <Link to={'/book?service=' + encodeURIComponent(svc.key)} className="service-arrow" aria-label={'Book ' + svc.title}>&rarr;</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" id="schedule">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Schedules</span>
          </div>

          <div className="two-col">
            <div className="panel">
              <div className="panel-title">Weekly Hours</div>
              {weeklyHours.map(function (row) {
                return (
                  <div className="day-row" key={row.day}>
                    <div className="day-name">{row.day}</div>
                    <div className="day-hours mono">{row.hours}</div>
                    <div className={'day-status mono ' + (row.open ? 'status-open' : 'status-closed')}>
                      {row.open ? 'Open' : 'Closed'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="panel">
              <div className="panel-title">How To Book?</div>

              {howToBook.map(function (step, i) {
                return (
                  <div className="step-row" style={i === howToBook.length - 1 ? { borderBottom: 'none' } : undefined} key={step.num}>
                    <div className="step-num">{step.num}</div>
                    <div className="step-body">
                      <div className="step-title">{step.title}</div>
                      <p className="step-desc">{step.desc}</p>
                    </div>
                  </div>
                );
              })}

              <div style={{ padding: '16px 20px', textAlign: 'right', background: '#121212' }}>
                <Link to="/book" className="btn btn-outline-yellow">Book Now</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="container">
          <div className="about-band">
            <div className="brand-mark"><span></span></div>
            <h2><span className="yellow">ls</span> Customs</h2>
            <p>High-performance auto care meets street-level accountability. We fix what others break, upgrade what others can't, and get you back on the road before the paint even dries. Pasay-built, street-tested.</p>
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="container">
          <div className="two-col">
            <div className="trust-grid">
              {trustCards.map(function (card) {
                return (
                  <div className="trust-card" key={card.title}>
                    <div className="trust-icon">{card.icon}</div>
                    <h3 className="trust-title">{card.title}</h3>
                    <p className="trust-desc">{card.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="contact-panel-title">Contact Us</div>
              <div className="contact-panel" style={{ flex: 1 }}>
                <div className="contact-row">
                  <div className="contact-icon"></div>
                  <div>
                    <div className="contact-label">Location</div>
                    <div className="contact-value mono">{businessInfo.address} <span className="contact-sub">[{businessInfo.coordinates.lat}&deg; N, {businessInfo.coordinates.lng}&deg; E]</span></div>
                  </div>
                </div>
                <div className="contact-row">
                  <div className="contact-icon"></div>
                  <div>
                    <div className="contact-label">Operating Hours</div>
                    <div className="contact-value mono">{hoursSummary()} <span className="contact-sub">({closedDaysText()} Closed)</span></div>
                  </div>
                </div>
                <div className="contact-cols">
                  <div className="contact-row">
                    <div className="contact-icon"></div>
                    <div>
                      <div className="contact-label">Direct Line</div>
                      <div className="contact-value mono"><a href={phoneHref()}>{businessInfo.phone}</a></div>
                    </div>
                  </div>
                  <div className="contact-row">
                    <div className="contact-icon"></div>
                    <div>
                      <div className="contact-label">Email</div>
                      <div className="contact-value mono"><a href={emailHref()}>{businessInfo.email}</a></div>
                    </div>
                  </div>
                </div>
                <a href={directionsUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-outline-yellow" style={{ marginTop: '12px' }}>Get Directions &#8599;</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <ServiceModal detailKey={activeDetail} onClose={function () { setActiveDetail(null); }} />
    </>
  );
}

export default Home;
