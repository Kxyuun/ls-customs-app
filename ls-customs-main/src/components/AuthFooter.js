import { businessInfo, currentYear } from '../data/businessInfo.js';

function AuthFooter() {
  return (
    <footer className="auth-footer">
      <p>&copy; {currentYear()} {businessInfo.name.toUpperCase()} — {businessInfo.cityLabel}</p>
    </footer>
  );
}

export default AuthFooter;
