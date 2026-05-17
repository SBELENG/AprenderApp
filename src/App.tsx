
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Intro from './pages/Intro';
import Auth from './pages/Auth';
import Contratar from './pages/Contratar';
import Pago from './pages/Pago';
import Ficha from './pages/Ficha';
import AgendaPadres from './pages/AgendaPadres';
import AgendaAdmin from './pages/AgendaAdmin';
import AsistenciaAdmin from './pages/AsistenciaAdmin';
import Contabilidad from './pages/Contabilidad';
import Maestras from './pages/Maestras';
import EvolucionAlumnos from './pages/EvolucionAlumnos';
import ConfiguracionAdmin from './pages/ConfiguracionAdmin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/contratar" element={<Contratar />} />
        <Route path="/pago" element={<Pago />} />
        <Route path="/ficha" element={<Ficha />} />
        <Route path="/agenda" element={<AgendaPadres />} />
        <Route path="/admin" element={<Navigate to="/admin/asistencia" replace />} />
        <Route path="/admin/agenda" element={<AgendaAdmin />} />
        <Route path="/admin/asistencia" element={<AsistenciaAdmin />} />
        <Route path="/admin/contabilidad" element={<Contabilidad />} />
        <Route path="/admin/maestras" element={<Maestras />} />
        <Route path="/admin/evolucion" element={<EvolucionAlumnos />} />
        <Route path="/admin/configuracion" element={<ConfiguracionAdmin />} />
      </Routes>
    </Router>
  );
}

export default App;
