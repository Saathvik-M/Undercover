import { Link, NavLink, Outlet } from "react-router-dom";

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          UnderCover
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Queue
          </NavLink>
          <NavLink to="/instructions">Agent instructions</NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
