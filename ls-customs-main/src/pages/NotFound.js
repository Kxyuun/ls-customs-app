// 404 page shown for any route that does not exist.
import { Link } from 'react-router-dom';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import { usePageTitle } from '../utils/usePageTitle.js';

function NotFound() {
  usePageTitle('Page Not Found — LS Customs');

  return (
    <>
      <Header variant="public" />
      <main className="booking-page">
        <div className="container">
          <div className="booking-head">
            <p className="auth-eyebrow mono">Error 404</p>
            <h1>Page Not Found</h1>
          </div>
          <div className="booking-panel">
            <p className="booking-step-sub">That page doesn't exist or has moved.</p>
            <div className="booking-nav">
              <span></span>
              <Link to="/" className="btn btn-yellow">Back to Home</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default NotFound;
