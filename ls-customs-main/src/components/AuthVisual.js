// Left-hand photo panel with the tagline, shared by the Login and Signup pages.
import tireImage from '../assets/tire-hero.jpg';

function AuthVisual() {
  return (
    <div className="auth-visual">
      <img src={tireImage} alt="Pirelli P Zero performance tire" />
      <div className="auth-visual-content">
        <p className="auth-visual-eyebrow mono">System Terminal // Secured Access</p>
        <h1 className="auth-visual-heading">
          Enter the<br />
          Garage.<br />
          <span className="yellow">Own the<br />Streets.</span>
        </h1>
        <div className="auth-visual-divider"></div>
        <p className="auth-visual-desc">
          Control your custom builds and track active service. Access your complete fleet history and performance records in one secure platform.
        </p>
        <div className="auth-visual-status mono">
          <span className="dot"></span>
          All Systems Operational
        </div>
      </div>
    </div>
  );
}

export default AuthVisual;
