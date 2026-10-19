// Booking page: 4-step wizard (vehicle -> services -> date & time -> confirm & payment).
// Prices come from data/serviceData.js for display; the API recalculates the real total when saving.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import RequireCustomerAuth from '../components/RequireCustomerAuth.js';
import ProgressTrack from '../components/ProgressTrack.js';
import ChoiceCard from '../components/ChoiceCard.js';
import { API } from '../config/api.js';
import { serviceDetails, serviceOptions, serviceAddons, priceForVehicle } from '../data/serviceData.js';
import { vehicleOptions, payOptions, vehicleStepSub, pricingNote } from '../data/bookingContent.js';
import { BOOKING_WINDOW_DAYS, closedDaysText, dayName, hoursSummary } from '../data/businessHours.js';
import { businessInfo } from '../data/businessInfo.js';
import { addDays, dayOfWeek, isValidDateStr } from '../utils/dates.js';
import { useShopNow } from '../utils/useShopNow.js';
import { getDayAvailability, getDemoFullDates } from '../utils/availability.js';
import { createBooking } from '../utils/bookingsStore.js';
import { clearDraft, loadDraft, saveDraft } from '../utils/bookingDraft.js';
import { useCustomerSession } from '../utils/auth.js';
import { formatAddonPrice, formatEstimatedTotal, formatEstimatedTotalPdf, formatStartingPrice } from '../utils/pricing.js';
import { usePageTitle } from '../utils/usePageTitle.js';

// serviceOptions (base prices) comes from data/serviceData.js — the single
// source of truth Home.js also reads. Split out the priced services from the
// free-form consultation so the flow can treat them as two paths.
var basePriceOptions = serviceOptions.filter(function (o) { return o.detail !== 'consultation'; });
var consultationOption = serviceOptions.filter(function (o) { return o.detail === 'consultation'; })[0];

// Finds a service option by its key.
function findOption(detailKey) {
  return serviceOptions.filter(function (o) { return o.detail === detailKey; })[0] || null;
}

// Prevents jumping to a step before the earlier steps are completed.
function clampStep(step, s) {
  var n = Number(step) || 1;
  if (!s.vehicle) return '1';
  if (n >= 3 && !s.services.length) return '2';
  if (n >= 4 && !(s.date && s.slot)) return '3';
  return String(Math.min(Math.max(n, 1), 4));
}

// Restores the saved draft for this account (if any), then lets an explicit
// ?service= (from a service card / modal) override the base service.
function buildInitial(email, serviceParam, todayStr) {
  var draft = loadDraft(email) || {};
  var maxDate = addDays(todayStr, BOOKING_WINDOW_DAYS);

  var vehicle = vehicleOptions.some(function (v) { return v.value === draft.vehicle; }) ? draft.vehicle : null;
  // One or more service types, in the order they were clicked (an older draft
  // may hold a single `baseService`). Consultation can't be combined with others.
  var services = [];
  var draftServices = Array.isArray(draft.services) ? draft.services : (draft.baseService ? [draft.baseService] : []);
  draftServices.forEach(function (key) {
    var opt = findOption(key);
    if (opt && !services.some(function (x) { return x.detail === opt.detail; })) services.push(opt);
  });
  if (services.length > 1) {
    services = services.filter(function (x) { return x.detail !== 'consultation'; });
  }

  // Additional services, each tied to the service type it belongs to.
  var addons = [];
  if (Array.isArray(draft.addons)) {
    draft.addons.forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      var owner = services.filter(function (x) { return x.detail === a.detail; })[0];
      var list = serviceAddons[a.detail] || [];
      var found = list.filter(function (x) { return x.value === a.value; })[0];
      if (owner && found && !addons.some(function (x) { return x.detail === a.detail && x.value === a.value; })) {
        addons.push({ detail: a.detail, value: found.value, price: found.price });
      }
    });
  }

  var preselected = serviceParam ? findOption(serviceParam) : null;
  if (preselected) {
    services = [preselected];
    addons = [];
  }

  var date = isValidDateStr(draft.date) && draft.date >= todayStr && draft.date <= maxDate ? draft.date : todayStr;
  var slot = typeof draft.slot === 'string' && date === draft.date ? draft.slot : null;
  var payment = payOptions.indexOf(draft.payment) !== -1 ? draft.payment : null;

  var state = { vehicle: vehicle, services: services, addons: addons, date: date, slot: slot, payment: payment };
  state.step = clampStep(draft.step, state);
  // Arriving from a service card/modal arrow: always begin at "Pick your
  // vehicle" (step 1) with that service already chosen, whatever step an old
  // draft was on. A plain /book still resumes the saved draft.
  if (preselected) state.step = '1';
  return state;
}

// API mode returns the server response as-is, which may omit fields. Fill any
// gap from the payload that was submitted so the confirmation screen and the
// PDF (services.join, additionalServices.length, ...) can never throw.
function normalizeConfirmed(response, payload) {
  var r = response && typeof response === 'object' ? response : {};
  var additional = Array.isArray(r.additionalServices)
    ? r.additionalServices
    : (Array.isArray(payload.additionalServices) ? payload.additionalServices : []);
  var baseService = r.baseService || payload.baseService || '';
  var serviceTypes = Array.isArray(r.serviceTypes) && r.serviceTypes.length
    ? r.serviceTypes
    : (Array.isArray(payload.serviceTypes) && payload.serviceTypes.length ? payload.serviceTypes : [baseService].filter(Boolean));
  var services = Array.isArray(r.services)
    ? r.services
    : (Array.isArray(payload.services) && payload.services.length
        ? payload.services
        : serviceTypes.concat(additional).filter(Boolean));
  var total = r.totalEstimate !== undefined && r.totalEstimate !== null ? r.totalEstimate : payload.totalEstimate;

  return Object.assign({}, payload, r, {
    referenceCode: r.referenceCode || '',
    vehicle: r.vehicle || payload.vehicle,
    baseService: baseService,
    serviceTypes: serviceTypes,
    additionalServices: additional,
    services: services,
    date: r.date || payload.date,
    timeSlot: r.timeSlot || payload.timeSlot,
    payment: r.payment || payload.payment,
    totalEstimate: total
  });
}

// Selectable service card (opens the details modal via the info button).
function ServiceCard({ option, type, name, selected, priceText, onSelect, onInfo }) {
  return (
    <div
      className={'service-select-card' + (selected ? ' selected' : '')}
      onClick={function (e) {
        // Keyboard activation comes through the real input's onChange; ignore
        // clicks that came from the input or the info button so nothing fires twice.
        if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
        onSelect();
      }}
    >
      <input
        type={type}
        className="sr-only"
        name={name}
        checked={selected}
        onChange={onSelect}
        aria-label={option.value + ', ' + priceText}
      />
      <span className="service-select-name">{option.value}</span>
      {onInfo && (
        <button
          type="button"
          className="service-info-icon mono"
          aria-label={"What's included in " + option.value}
          onClick={function (e) { e.stopPropagation(); onInfo(); }}
        >
          &#9432;
        </button>
      )}
      <span className="service-select-price">{priceText}</span>
    </div>
  );
}

// The booking wizard itself (state, validation, availability lookup, submit and PDF summary).
function BookingFlow({ customer }) {
  var email = customer.email;
  var now = useShopNow();
  var todayStr = now.dateStr;
  var maxDateStr = addDays(todayStr, BOOKING_WINDOW_DAYS);
  var nowMinutes = now.hour * 60 + now.minute;

  var navigate = useNavigate();
  var [searchParams, setSearchParams] = useSearchParams();
  var [init] = useState(function () {
    return buildInitial(email, searchParams.get('service'), todayStr);
  });

  var [step, setStep] = useState(init.step);
  var [vehicle, setVehicle] = useState(init.vehicle);
  var [services, setServices] = useState(init.services); // service types, in click order; the LAST one is the active category
  var [addons, setAddons] = useState(init.addons);
  var [date, setDate] = useState(init.date);
  var [slot, setSlot] = useState(init.slot);
  var [payment, setPayment] = useState(init.payment);
  var [activeDetail, setActiveDetail] = useState(null);
  var [errors, setErrors] = useState({});
  var [error3Text, setError3Text] = useState('Pick a date and time slot to continue.');
  var [confirmBusy, setConfirmBusy] = useState(false);
  var [error4Text, setError4Text] = useState('Pick a payment method to confirm.');
  var [confirmed, setConfirmed] = useState(null);
  var [availability, setAvailability] = useState({ date: null, status: 'loading', data: null });
  var submittingRef = useRef(false);

  // The ?service= param was consumed by buildInitial; drop it so a refresh
  // doesn't override the restored draft.
  useEffect(function () {
    if (searchParams.get('service')) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist wizard progress per account; clear it when the wizard is empty.
  useEffect(function () {
    if (step === 'done') return;
    var empty = step === '1' && !vehicle && !services.length && !slot && !payment;
    if (empty) {
      clearDraft(email);
      return;
    }
    saveDraft(email, {
      step: step,
      vehicle: vehicle,
      services: services.map(function (x) { return x.detail; }),
      addons: addons.map(function (a) { return { detail: a.detail, value: a.value }; }),
      date: date,
      slot: slot,
      payment: payment
    });
  }, [email, step, vehicle, services, addons, date, slot, payment]);

  // Day rolled over while the page was open: never keep a past date.
  useEffect(function () {
    if (date < todayStr) {
      setDate(todayStr);
      setSlot(null);
    }
  }, [date, todayStr]);

  // Load availability for the chosen date. Currently local demo data (see
  // utils/availability.js); the async shape is ready for a real API.
  useEffect(function () {
    var cancelled = false;
    setAvailability({ date: date, status: 'loading', data: null });
    getDayAvailability(date, todayStr).then(function (data) {
      if (!cancelled) setAvailability({ date: date, status: 'ready', data: data });
    }).catch(function () {
      if (!cancelled) setAvailability({ date: date, status: 'error', data: null });
    });
    return function () { cancelled = true; };
  }, [date, todayStr]);

  // Slot buttons for the chosen date; today's slots that have already started
  // (shop time) are disabled.
  var slotViews = useMemo(function () {
    if (availability.date !== date || availability.status !== 'ready') return [];
    return availability.data.slots.map(function (s) {
      var past = date === todayStr && s.hour * 60 <= nowMinutes;
      return { label: s.label, disabled: past || !s.available };
    });
  }, [availability, date, todayStr, nowMinutes]);

  // A selected slot that is no longer selectable (time passed / unavailable) is cleared.
  useEffect(function () {
    if (!slot) return;
    if (availability.date !== date || availability.status !== 'ready') return;
    var ok = slotViews.some(function (v) { return v.label === slot && !v.disabled; });
    if (!ok) setSlot(null);
  }, [slot, slotViews, availability, date]);

  useEffect(function () {
    if (step === '4' && !slot) setStep('3');
  }, [step, slot]);

  function hideError(key) {
    setErrors(function (prev) {
      if (!prev[key]) return prev;
      var next = Object.assign({}, prev);
      delete next[key];
      return next;
    });
  }

  function showError(key) {
    setErrors(function (prev) {
      var next = Object.assign({}, prev);
      next[key] = true;
      return next;
    });
    return false;
  }

  // Service types are multi-select. The one clicked LAST is the "active" category:
  // its optional additional services are the ones shown below. Un-ticking a
  // service also drops the extras that belonged to it.
  function toggleService(option) {
    hideError('error2');
    var isOn = services.some(function (x) { return x.detail === option.detail; });
    if (isOn) {
      setServices(services.filter(function (x) { return x.detail !== option.detail; }));
      setAddons(addons.filter(function (a) { return a.detail !== option.detail; }));
      return;
    }
    if (option.detail === 'consultation') {
      // Consultation stands alone: it clears everything else.
      setServices([option]);
      setAddons([]);
      return;
    }
    setServices(services.filter(function (x) { return x.detail !== 'consultation'; }).concat([option]));
  }

  function toggleAddon(owner, extra) {
    setAddons(function (prev) {
      var index = prev.findIndex(function (a) { return a.detail === owner.detail && a.value === extra.value; });
      if (index === -1) return prev.concat([{ detail: owner.detail, value: extra.value, price: extra.price }]);
      var next = prev.slice();
      next.splice(index, 1);
      return next;
    });
  }

  // Total = every chosen service + every chosen additional service. Only Car Wash
  // depends on vehicle type (see priceForVehicle); everything else has one price.
  function unitPrice(option) { return priceForVehicle(option, vehicle); }

  function totalPrice() {
    return services.reduce(function (sum, x) { return sum + unitPrice(x); }, 0) +
      addons.reduce(function (sum, a) { return sum + a.price; }, 0);
  }

  function selectedServiceNames() {
    return services.map(function (x) { return x.value; }).concat(addons.map(function (a) { return a.value; }));
  }

  function handleDateChange(e) {
    var value = e.target.value;
    if (!isValidDateStr(value) || value < todayStr || value > maxDateStr) value = todayStr;
    setDate(value);
    setSlot(null);
    hideError('error3');
  }

  function validateStep(currentStep) {
    if (currentStep === '1' && !vehicle) return showError('error1');
    if (currentStep === '2' && !services.length) return showError('error2');
    if (currentStep === '3') {
      var selectable = slot && slotViews.some(function (v) { return v.label === slot && !v.disabled; });
      if (!date || !selectable) {
        setError3Text('Pick a date and time slot to continue.');
        return showError('error3');
      }
    }
    if (currentStep === '4' && !payment) return showError('error4');
    return true;
  }

  function goNext(nextStep) {
    if (!validateStep(step)) return;
    setStep(nextStep);
  }

  function cancelBooking() {
    var hasProgress = vehicle || services.length || slot || payment;
    if (hasProgress && !window.confirm('Cancel this booking and clear what you\'ve entered?')) return;
    clearDraft(email);
    setVehicle(null);
    setServices([]);
    setAddons([]);
    setSlot(null);
    setPayment(null);
    setDate(todayStr);
    setErrors({});
    setActiveDetail(null);
    setStep('1');
    // Go back to the page the user came from (Home if there is none).
    var canGoBack = window.history.state && window.history.state.idx > 0;
    navigate(canGoBack ? -1 : '/');
  }

  async function submitBooking() {
    // Guard first, synchronously, before any async work, so a fast double
    // click can never start two submissions.
    if (submittingRef.current) return;
    if (!validateStep('4')) return;
    if (!validateStep('3')) {
      setError3Text('That time slot is no longer available. Pick another.');
      setStep('3');
      return;
    }

    submittingRef.current = true;
    setConfirmBusy(true);
    hideError('error4');

    var payload = {
      vehicle: vehicle,
      serviceTypes: services.map(function (x) { return x.value; }),
      baseService: services[0].value,
      additionalServices: addons.map(function (a) { return a.value; }),
      services: selectedServiceNames(),
      date: date,
      timeSlot: slot,
      payment: payment,
      totalEstimate: totalPrice()
    };

    try {
      var booking = normalizeConfirmed(await createBooking(payload, customer), payload);
      clearDraft(email);
      setConfirmed(booking);
      setStep('done');
    } catch (err) {
      setError4Text(err && err.status === 0
        ? 'Could not reach the server. Try again.'
        : err && err.status === 409
          ? 'Sorry, that time slot was just taken. Go back and pick another time.'
          : "We couldn't save your booking. Try again.");
      showError('error4');
    } finally {
      submittingRef.current = false;
      setConfirmBusy(false);
    }
  }

  function downloadPdf() {
    if (!confirmed) return;
    var doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(businessInfo.name + ' — Booking Confirmation', 20, 25);

    doc.setDrawColor(200);
    doc.line(20, 30, 190, 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    var lines = [
      ['Reference Code', confirmed.referenceCode],
      ['Vehicle', confirmed.vehicle],
      ['Service(s)', confirmed.services.join(', ')],
      ['Date', confirmed.date],
      ['Time', confirmed.timeSlot],
      ['Payment Method', confirmed.payment],
      ['Estimated Total', formatEstimatedTotalPdf(confirmed.totalEstimate)]
    ];

    var y = 45;
    lines.forEach(function (row) {
      doc.setFont('helvetica', 'bold');
      doc.text(row[0] + ':', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(row[1]), 80, y);
      y += 10;
    });

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(businessInfo.name + ' — ' + businessInfo.cityLabel + '. Est. ' + businessInfo.established + '.', 20, y + 10);

    doc.save(confirmed.referenceCode + '.pdf');
  }

  var activeDetailData = activeDetail ? serviceDetails[activeDetail] : null;
  var activeService = services.length ? services[services.length - 1] : null;
  var activeAddons = activeService ? (serviceAddons[activeService.detail] || []) : [];
  var total = totalPrice();
  var availabilityLoading = availability.date !== date || availability.status === 'loading';
  var allSlotsGone = availability.status === 'ready' && availability.date === date &&
    availability.data.status === 'open' && slotViews.length > 0 && slotViews.every(function (v) { return v.disabled; });

  var slotMessage = null;
  if (availabilityLoading) slotMessage = 'Loading availability...';
  else if (availability.status === 'error') slotMessage = 'Could not load availability. Pick the date again or reload.';
  else if (availability.data.status === 'closed') slotMessage = 'Closed on ' + dayName(dayOfWeek(date)) + 's. Pick another date.';
  else if (availability.data.status === 'full') slotMessage = 'Fully booked that day' + (API.AVAILABILITY ? '' : ' (demo data)') + '. Pick another date.';
  else if (allSlotsGone) slotMessage = 'No more time slots left today. Pick another date.';

  var bookingSummary = confirmed || {
    vehicle: vehicle,
    baseService: services.length ? services[0].value : '',
    serviceTypes: services.map(function (x) { return x.value; }),
    additionalServices: addons.map(function (a) { return a.value; }),
    date: date,
    timeSlot: slot,
    payment: payment,
    totalEstimate: total
  };

  return (
    <main className="booking-page">
      <div className="container">
        <div className="booking-head">
          <p className="auth-eyebrow mono">Schedule a service</p>
          <h1>Book Appointment</h1>
        </div>

        <ProgressTrack currentStep={step} />

        <div className="booking-panel">

          {step === '1' && (
            <section className="booking-screen" data-screen="1">
              <h2 className="booking-step-title">Pick your vehicle</h2>
              <p className="booking-step-sub">{vehicleStepSub}</p>
              <div className="option-grid" role="radiogroup" aria-label="Vehicle type">
                {vehicleOptions.map(function (v) {
                  return (
                    <ChoiceCard
                      key={v.value}
                      className="option-card"
                      name="vehicle"
                      value={v.value}
                      checked={vehicle === v.value}
                      onChange={function () { setVehicle(v.value); hideError('error1'); }}
                    >
                      <div className="opt-title">{v.value}</div>
                      <div className="opt-sub">{v.sub}</div>
                    </ChoiceCard>
                  );
                })}
              </div>
              <p className={'booking-error mono' + (errors.error1 ? ' show' : '')}>Pick a vehicle type to continue.</p>
              <div className="booking-nav">
                <span></span>
                <button type="button" className="btn btn-yellow" onClick={function () { goNext('2'); }}>Continue &rarr;</button>
              </div>
            </section>
          )}

          {step === '2' && (
            <section className="booking-screen" data-screen="2">
              <h2 className="booking-step-title">Choose your services</h2>
              <p className="booking-step-sub">Pick one or more service types. The extras listed below belong to the service you clicked last. Tap the info icon to see what's included.</p>

              <p className="service-kicker mono" style={{ marginBottom: '10px' }}>Service Types</p>
              <div className="service-select-grid" role="group" aria-label="Service types">
                {basePriceOptions.concat(consultationOption ? [consultationOption] : []).map(function (option) {
                  var selected = services.some(function (x) { return x.detail === option.detail; });
                  return (
                    <ServiceCard
                      key={option.value}
                      option={option}
                      type="checkbox"
                      name="service-type"
                      selected={selected}
                      priceText={formatStartingPrice(unitPrice(option))}
                      onSelect={function () { toggleService(option); }}
                      onInfo={function () { setActiveDetail(option.detail); }}
                    />
                  );
                })}
              </div>

              {activeService && activeAddons.length > 0 && (
                <>
                  <p className="service-kicker mono" style={{ margin: '20px 0 10px' }}>Additional Services for {activeService.value} (optional)</p>
                  <div className="service-select-grid" role="group" aria-label={'Additional services for ' + activeService.value}>
                    {activeAddons.map(function (extra) {
                      var selected = addons.some(function (a) { return a.detail === activeService.detail && a.value === extra.value; });
                      return (
                        <ServiceCard
                          key={activeService.detail + ':' + extra.value}
                          option={extra}
                          type="checkbox"
                          name="addon"
                          selected={selected}
                          priceText={formatAddonPrice(extra.price)}
                          onSelect={function () { toggleAddon(activeService, extra); }}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {addons.length > 0 && (
                <p className="field-hint mono" style={{ marginTop: '12px' }}>Extras chosen: {addons.map(function (a) { return a.value; }).join(', ')}</p>
              )}

              {activeDetailData && (
                <div className="service-detail-panel" aria-live="polite">
                  <p className="service-kicker mono">{activeDetailData.kicker}</p>
                  <h3 className="service-title" style={{ fontSize: '22px' }}>{activeDetailData.title}</h3>
                  <ul className="modal-list">
                    {activeDetailData.items.map(function (item) {
                      return <li key={item}>{item}</li>;
                    })}
                  </ul>
                </div>
              )}

              {activeService && activeService.detail !== 'consultation' && (
                <div className="summary-row" style={{ marginTop: '16px' }}>
                  <span>Estimated Total</span>
                  <span className="service-price" style={{ fontSize: '20px' }}>{formatEstimatedTotal(total)}</span>
                </div>
              )}

              <p className="field-hint mono">{pricingNote}</p>
              <p className="booking-step-sub" style={{ marginTop: '14px', marginBottom: 0 }}>Don't know what your car needs? Pick Consultation (it can't be combined with other services) and we'll figure it out with you on-site.</p>
              <p className={'booking-error mono' + (errors.error2 ? ' show' : '')}>Pick at least one service to continue.</p>
              <div className="booking-nav">
                <button type="button" className="btn btn-outline" onClick={function () { setStep('1'); }}>&larr; Back</button>
                <button type="button" className="btn btn-yellow" onClick={function () { goNext('3'); }}>Continue &rarr;</button>
              </div>
            </section>
          )}

          {step === '3' && (
            <section className="booking-screen" data-screen="3">
              <h2 className="booking-step-title">Set your schedule</h2>
              <p className="booking-step-sub">{hoursSummary()}. Closed {closedDaysText()}. Bookings open up to {BOOKING_WINDOW_DAYS} days ahead.</p>

              <div className="booking-field">
                <label htmlFor="bookingDate">Date</label>
                <input id="bookingDate" type="date" min={todayStr} max={maxDateStr} value={date} onChange={handleDateChange} />
                <p className="field-hint mono">
                  {API.AVAILABILITY
                    ? 'Times shown are live: a slot disappears once it is booked.'
                    : 'Demo availability: sample data, not live shop availability. Sample full days: ' + getDemoFullDates(todayStr).join(', ') + '.'}
                </p>
              </div>

              <div className="booking-field">
                <label id="slotLabel">Time slot (appointment start time)</label>
                {slotMessage ? (
                  <div className="slot-grid">
                    <p className="mono" role="status" style={{ color: availability.status === 'error' ? '#ff6b6b' : availabilityLoading ? 'var(--text-dim)' : '#ff6b6b', fontSize: '11px' }}>{slotMessage}</p>
                  </div>
                ) : (
                  <div className="slot-grid" role="radiogroup" aria-labelledby="slotLabel">
                    {slotViews.map(function (v) {
                      return (
                        <ChoiceCard
                          key={v.label}
                          className="slot"
                          name="time-slot"
                          value={v.label}
                          checked={slot === v.label}
                          disabled={v.disabled}
                          onChange={function () { setSlot(v.label); hideError('error3'); }}
                        >
                          {v.label}
                        </ChoiceCard>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className={'booking-error mono' + (errors.error3 ? ' show' : '')}>{error3Text}</p>
              <div className="booking-nav">
                <button type="button" className="btn btn-outline" onClick={function () { setStep('2'); }}>&larr; Back</button>
                <button type="button" className="btn btn-yellow" onClick={function () { goNext('4'); }}>Continue &rarr;</button>
              </div>
            </section>
          )}

          {step === '4' && (
            <section className="booking-screen" data-screen="4">
              <h2 className="booking-step-title">Confirm & pay</h2>
              <p className="booking-step-sub">
                {total === 0
                  ? "Consultation is free \u2014 you only pay if you book a service afterward. Choose your preferred payment method."
                  : "Review the details, choose how you'll pay."}
              </p>

              <div className="summary-list">
                <div className="summary-row"><span>Vehicle</span><span>{vehicle}</span></div>
                <div className="summary-row"><span>Service(s)</span><span>{services.map(function (x) { return x.value; }).join(', ')}</span></div>
                {addons.length > 0 && (
                  <div className="summary-row"><span>Add-ons</span><span>{addons.map(function (a) { return a.value; }).join(', ')}</span></div>
                )}
                <div className="summary-row"><span>Date</span><span>{date}</span></div>
                <div className="summary-row"><span>Time</span><span>{slot}</span></div>
                <div className="summary-row"><span>Estimated Total</span><span>{formatEstimatedTotal(total)}</span></div>
              </div>
              {total !== 0 && <p className="field-hint mono">{pricingNote}</p>}

              <div className="booking-field">
                <label id="payLabel">Payment method</label>
                <div className="pay-grid" role="radiogroup" aria-labelledby="payLabel">
                  {payOptions.map(function (p) {
                    return (
                      <ChoiceCard
                        key={p}
                        className="option-card"
                        name="payment"
                        value={p}
                        checked={payment === p}
                        onChange={function () { setPayment(p); hideError('error4'); }}
                      >
                        <div className="opt-title">{p}</div>
                      </ChoiceCard>
                    );
                  })}
                </div>
              </div>

              <p className={'booking-error mono' + (errors.error4 ? ' show' : '')} role="alert">{error4Text}</p>
              <div className="booking-nav">
                <button type="button" className="btn btn-outline" onClick={function () { setStep('3'); }} disabled={confirmBusy}>&larr; Back</button>
                <button type="button" className="btn btn-yellow" onClick={submitBooking} disabled={confirmBusy}>
                  {confirmBusy ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </section>
          )}

          {step === 'done' && confirmed && (
            <section className="booking-screen confirm-screen" data-screen="done">
              <div className="confirm-badge">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h2 className="booking-step-title">You're booked</h2>
              <p className="booking-step-sub">We'll see you then. Save your reference number.</p>
              <div className="confirm-code">{confirmed.referenceCode}</div>
              <div className="summary-list">
                <div className="summary-row"><span>Vehicle</span><span>{bookingSummary.vehicle}</span></div>
                <div className="summary-row"><span>Service(s)</span><span>{(bookingSummary.serviceTypes && bookingSummary.serviceTypes.length ? bookingSummary.serviceTypes : [bookingSummary.baseService]).join(', ')}</span></div>
                {(bookingSummary.additionalServices || []).length > 0 && (
                  <div className="summary-row"><span>Add-ons</span><span>{bookingSummary.additionalServices.join(', ')}</span></div>
                )}
                <div className="summary-row"><span>Date</span><span>{bookingSummary.date}</span></div>
                <div className="summary-row"><span>Time</span><span>{bookingSummary.timeSlot}</span></div>
                <div className="summary-row"><span>Payment</span><span>{bookingSummary.payment}</span></div>
                <div className="summary-row"><span>Estimated Total</span><span>{formatEstimatedTotal(bookingSummary.totalEstimate)}</span></div>
              </div>
              <div className="booking-nav" style={{ justifyContent: 'center', gap: '14px' }}>
                <button type="button" className="btn btn-outline-yellow" onClick={downloadPdf}>Download PDF</button>
                <Link to="/account" className="btn btn-outline">My Bookings</Link>
                <Link to="/" className="btn btn-outline">Back to Home</Link>
              </div>
            </section>
          )}

        </div>

        {step !== 'done' && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button type="button" className="link-btn mono" onClick={cancelBooking} disabled={confirmBusy}>Cancel booking</button>
          </div>
        )}
      </div>
    </main>
  );
}

// Wraps the wizard so only a signed-in customer can use it.
function BookingRoute() {
  var session = useCustomerSession();
  // key: a different account (e.g. after switching in another tab) gets a
  // fresh wizard with its own draft.
  return session ? <BookingFlow key={session.email} customer={session} /> : null;
}

function Book() {
  usePageTitle('Book Appointment — LS Customs');

  return (
    <RequireCustomerAuth>
      <Header variant="public" />
      <BookingRoute />
      <Footer />
    </RequireCustomerAuth>
  );
}

export default Book;
