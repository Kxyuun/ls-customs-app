// A whole-card clickable choice built on a REAL radio/checkbox input, so
// keyboard users get Tab / arrow keys / Space and screen readers get the
// right role and checked state. The input is visually hidden (.sr-only) so
// the existing card design is unchanged.
function ChoiceCard({ type, name, value, checked, disabled, onChange, className, children }) {
  var cls = className + (checked ? ' selected' : '') + (disabled ? ' disabled' : '');
  return (
    <label className={cls}>
      <input
        type={type || 'radio'}
        className="sr-only"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {children}
    </label>
  );
}

export default ChoiceCard;
