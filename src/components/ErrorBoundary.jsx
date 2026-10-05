import { Component } from "react";

/** Si una pantalla falla, muestra un aviso en vez de dejar la app en blanco. */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" style={{ display: "grid", gap: 10 }} role="alert">
        <h2>Algo salió mal en esta sección</h2>
        <p className="muted">Tu progreso está guardado. Prueba otra pestaña o vuelve a intentarlo.</p>
        <div className="row"><button type="button" className="btn" onClick={() => this.setState({ error: null })}>Reintentar</button></div>
      </div>
    );
  }
}
