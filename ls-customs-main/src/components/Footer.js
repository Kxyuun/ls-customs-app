import { businessInfo, currentYear } from '../data/businessInfo.js';

function Footer() {
  return (
    <footer className="site-footer">
      <p>&copy; {currentYear()} {businessInfo.name}. {businessInfo.cityLabel}. Est. {businessInfo.established}.</p>
    </footer>
  );
}

export default Footer;
