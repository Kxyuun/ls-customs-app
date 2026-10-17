import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { serviceDetails } from '../data/serviceData.js';

function ServiceModal({ detailKey, onClose }) {
  var data = detailKey ? serviceDetails[detailKey] : null;
  var isOpen = !!data;
  var boxRef = useRef(null);
  var closeRef = useRef(null);
  var onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // While open: Escape closes, background scroll is locked, focus moves into
  // the dialog, Tab stays inside it, and focus returns to the trigger on close.
  useEffect(function () {
    if (!isOpen) return undefined;

    var previousFocus = document.activeElement;
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (closeRef.current) closeRef.current.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      var focusables = boxRef.current.querySelectorAll('button, a[href]');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return function () {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
  }, [isOpen]);

  return (
    <div
      className={'modal-overlay' + (isOpen ? ' open' : '')}
      aria-hidden={isOpen ? undefined : 'true'}
      onClick={function (e) {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-box"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
      >
        <button type="button" className="modal-close" aria-label="Close" ref={closeRef} onClick={onClose}>&times;</button>
        {data && (
          <>
            <p className="service-kicker mono">{data.kicker}</p>
            <h3 className="service-title" id="service-modal-title">{data.title}</h3>
            <ul className="modal-list">
              {data.items.map(function (item) {
                return <li key={item}>{item}</li>;
              })}
            </ul>
            <Link
              to={'/book?service=' + encodeURIComponent(detailKey)}
              className="btn btn-yellow"
              style={{ marginTop: '10px' }}
            >
              Book This Service
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default ServiceModal;
