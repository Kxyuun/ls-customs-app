// Reusable confirmation pop-up (used for cancel, remove and similar actions).
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Small accessible confirm modal. Reuses the existing .modal-overlay/.modal-box
// styles. Escape and the backdrop cancel; focus starts on Cancel (the safe
// choice), stays inside the dialog, and returns to the trigger on close.
function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, confirmClass, onConfirm, onCancel }) {
  var boxRef = useRef(null);
  var cancelRef = useRef(null);
  var onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(function () {
    if (!open) return undefined;

    var previousFocus = document.activeElement;
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (cancelRef.current) cancelRef.current.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      var focusables = boxRef.current.querySelectorAll('button');
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
      if (previousFocus && previousFocus.focus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  // Portaled to <body> so the sticky header's stacking context can't trap it.
  return createPortal(
    <div
      className="modal-overlay open"
      onClick={function (e) { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="modal-box"
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h3 className="service-title" id="confirm-dialog-title">{title}</h3>
        <p className="booking-step-sub" id="confirm-dialog-message" style={{ marginTop: '10px' }}>{message}</p>
        <div className="booking-nav" style={{ marginTop: '24px', marginBottom: 0 }}>
          <button type="button" className="btn btn-outline" ref={cancelRef} onClick={onCancel}>{cancelLabel || 'Cancel'}</button>
          <button type="button" className={'btn ' + (confirmClass || 'btn-red')} onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmDialog;
