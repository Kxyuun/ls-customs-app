// Password input with a Show/Hide toggle, used on login, signup and account forms.
import { useState } from 'react';

function PasswordField({ id, name, placeholder, value, onChange, minLength, maxLength, required }) {
  var [visible, setVisible] = useState(false);

  return (
    <div className="field-input-wrap">
      <input
        type={visible ? 'text' : 'password'}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
      />
      <button
        type="button"
        className="field-toggle mono"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={function () { setVisible(!visible); }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export default PasswordField;
