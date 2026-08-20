
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
import ProtectedRoute from './components/ProtectedRoute';

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
        
        {/* Rutas protegidas para Administradores */}
        <Route path="/admin" element={<Navigate to="/admin/asistencia" replace />} />
        <Route path="/admin/agenda" element={<ProtectedRoute><AgendaAdmin /></ProtectedRoute>} />
        <Route path="/admin/asistencia" element={<ProtectedRoute><AsistenciaAdmin /></ProtectedRoute>} />
        <Route path="/admin/contabilidad" element={<ProtectedRoute><Contabilidad /></ProtectedRoute>} />
        <Route path="/admin/maestras" element={<ProtectedRoute><Maestras /></ProtectedRoute>} />
        <Route path="/admin/evolucion" element={<ProtectedRoute><EvolucionAlumnos /></ProtectedRoute>} />
        <Route path="/admin/configuracion" element={<ProtectedRoute><ConfiguracionAdmin /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
