// The 4-step progress bar at the top of the booking page (vehicle, service, schedule, confirm).
var steps = [
  { step: '1', label: 'Vehicle' },
  { step: '2', label: 'Service' },
  { step: '3', label: 'Schedule' },
  { step: '4', label: 'Confirm' }
];

// currentStep is '1' | '2' | '3' | '4' | 'done'
function ProgressTrack({ currentStep }) {
  return (
    <div className="progress-track">
      {steps.map(function (s) {
        var isDone = currentStep === 'done' || Number(s.step) < Number(currentStep);
        var isActive = currentStep !== 'done' && s.step === currentStep;
        var className = 'progress-step' + (isActive ? ' active' : '') + (isDone ? ' done' : '');

        return (
          <div className={className} data-step={s.step} key={s.step}>
            <div className="progress-dot">{'0' + s.step}</div>
            <div className="progress-label mono">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default ProgressTrack;
