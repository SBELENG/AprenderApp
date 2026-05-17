import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, UserCheck, UserMinus, FileEdit, Check, BarChart3, Users2, LineChart, Loader2 } from 'lucide-react';
import AdminAuthModal from '../components/AdminAuthModal';
import HealthAlertModal from '../components/HealthAlertModal';
import { supabase } from '../lib/supabase';

type Alumno = {
  id: string;
  nombre: string;
  turno: string;
  estado: 'Pendiente' | 'Presente' | 'Retirado';
  horaIngreso?: string;
  horaRetiro?: string;
  observaciones?: string;
  salud?: string;
  dni?: string;
  emergencia?: string;
  autorizados?: string;
};

const AsistenciaAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [observacionTemp, setObservacionTemp] = useState('');
  const [pushNotification, setPushNotification] = useState<string | null>(null);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [healthAlertAlumno, setHealthAlertAlumno] = useState<Alumno | null>(null);

  useEffect(() => {
    fetchAlumnos();
  }, []);

  const fetchAlumnos = async () => {
    setIsLoading(true);
    try {
      // 1. Obtener todos los alumnos
      const { data: alumnosData, error: alumnosError } = await supabase
        .from('alumnos')
        .select('*')
        .order('nombre');

      if (alumnosError) throw alumnosError;

      // 2. Obtener asistencia de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: asistenciaData, error: asistenciaError } = await supabase
        .from('asistencia')
        .select('*')
        .eq('fecha', today);

      if (asistenciaError) throw asistenciaError;

      // 3. Mapear datos
      const mappedAlumnos: Alumno[] = alumnosData.map(a => {
        const asistencia = asistenciaData?.find(as => as.alumno_id === a.id);
        let estado: 'Pendiente' | 'Presente' | 'Retirado' = 'Pendiente';
        if (asistencia) {
          estado = asistencia.hora_retiro ? 'Retirado' : 'Presente';
        }

        return {
          id: a.id,
          nombre: a.nombre,
          turno: a.grado || 'S/D', // Usamos grado como turno temporalmente o lo que venga
          estado,
          horaIngreso: asistencia?.hora_ingreso,
          horaRetiro: asistencia?.hora_retiro,
          observaciones: asistencia?.observaciones,
          salud: a.salud_info,
          dni: a.dni,
          emergencia: a.emergencia_contacto,
          autorizados: a.autorizados_retiro
        };
      });

      setAlumnos(mappedAlumnos);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showPush = (message: string) => {
    setPushNotification(message);
    setTimeout(() => setPushNotification(null), 4000);
  };

  const handleIngreso = async (id: string) => {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;

    if (alumno.salud && !healthAlertAlumno) {
      setHealthAlertAlumno(alumno);
      return;
    }

    const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    try {
      const { error } = await supabase
        .from('asistencia')
        .insert([{
          alumno_id: id,
          fecha: new Date().toISOString().split('T')[0],
          hora_ingreso: horaActual
        }]);

      if (error) throw error;

      setAlumnos(prev => prev.map(a => 
        a.id === id ? { ...a, estado: 'Presente', horaIngreso: horaActual } : a
      ));
      
      showPush(`Notificación enviada a padres: "¡${alumno.nombre} ingresó a la academia a las ${horaActual}!"`);
    } catch (error: any) {
      alert('Error al registrar ingreso: ' + error.message);
    } finally {
      setHealthAlertAlumno(null);
    }
  };

  const openRetiroModal = (id: string) => {
    setActiveModalId(id);
    setObservacionTemp('');
  };

  const handleConfirmarRetiro = async () => {
    if (!activeModalId) return;
    if (observacionTemp.trim().length === 0) {
      alert("Debes ingresar una observación (qué se trabajó, tareas, etc.)");
      return;
    }

    const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { error } = await supabase
        .from('asistencia')
        .update({
          hora_retiro: horaActual,
          observaciones: observacionTemp
        })
        .eq('alumno_id', activeModalId)
        .eq('fecha', today);

      if (error) throw error;

      setAlumnos(prev => prev.map(a => 
        a.id === activeModalId ? { ...a, estado: 'Retirado', horaRetiro: horaActual, observaciones: observacionTemp } : a
      ));

      const alumno = alumnos.find(a => a.id === activeModalId);
      showPush(`Notificación enviada a padres: "¡${alumno?.nombre} fue retirado! Observación: ${observacionTemp}"`);
    } catch (error: any) {
      alert('Error al registrar retiro: ' + error.message);
    } finally {
      setActiveModalId(null);
    }
  };

  return (
    <div className="auth-layout" style={{ background: 'var(--color-white)', position: 'relative' }}>
      
      {/* Toast de Notificación Push Simulada */}
      {pushNotification && (
        <div style={{
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1F2937', color: 'white', padding: '1rem 1.5rem', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', gap: '1rem',
          width: '90%', maxWidth: '400px', animation: 'fadeIn 0.3s'
        }}>
          <Bell size={24} color="#FBBF24" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>Firebase FCM (Mock)</p>
            <p style={{ margin: 0, fontSize: '0.85rem', marginTop: '4px' }}>{pushNotification}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-primary)' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'white' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'white', marginTop: '0.5rem' }}>Gestión Academia</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-tertiary)' }}>Asistencia y Herramientas Admin</p>
        
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => { setPendingRoute('/admin/contabilidad'); setIsAdminAuthOpen(true); }}
            style={{ 
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', 
              alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap'
            }}
          >
            <BarChart3 size={16} />
            Contabilidad
          </button>
          <button 
            onClick={() => navigate('/admin/maestras')}
            style={{ 
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', 
              alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap'
            }}
          >
            <Users2 size={16} />
            Maestras
          </button>
          <button 
            onClick={() => navigate('/admin/evolucion')}
            style={{ 
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', 
              alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap'
            }}
          >
            <LineChart size={16} />
            Evolución
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>Alumnos del día</h3>

        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--color-gray-400)' }}>
            <Loader2 size={40} className="animate-spin" />
            <p>Cargando alumnos...</p>
          </div>
        ) : alumnos.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--color-gray-400)', textAlign: 'center' }}>
            <Users2 size={48} />
            <p>No hay alumnos registrados aún.<br/>Usa la Ficha de Inscripción para empezar.</p>
          </div>
        ) : (
          <div className="flex-col gap-4">
            {alumnos.map(alumno => (
            <div key={alumno.id} style={{ 
              border: '1px solid var(--color-gray-300)', borderRadius: '12px', padding: '1.2rem',
              background: alumno.estado === 'Retirado' ? '#F9FAFB' : 'white',
              opacity: alumno.estado === 'Retirado' ? 0.8 : 1
            }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem' }}>{alumno.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Turno: {alumno.turno}</p>
                </div>
                <span style={{ 
                  display: 'inline-block', padding: '0.3rem 0.6rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold',
                  background: alumno.estado === 'Presente' ? '#D1FAE5' : alumno.estado === 'Retirado' ? '#E5E7EB' : '#FEF3C7',
                  color: alumno.estado === 'Presente' ? '#065F46' : alumno.estado === 'Retirado' ? '#374151' : '#92400E',
                }}>
                  {alumno.estado}
                </span>
              </div>

              {/* Botones de Acción */}
              {alumno.estado === 'Pendiente' && (
                <button 
                  className="btn btn-block" 
                  style={{ background: '#10B981', color: 'white', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                  onClick={() => handleIngreso(alumno.id)}
                >
                  <UserCheck size={18} />
                  Marcar Ingreso
                </button>
              )}

              {alumno.estado === 'Presente' && (
                <button 
                  className="btn btn-outline btn-block" 
                  style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', borderColor: '#EF4444', color: '#EF4444' }}
                  onClick={() => openRetiroModal(alumno.id)}
                >
                  <UserMinus size={18} />
                  Marcar Retiro
                </button>
              )}

              {alumno.estado === 'Retirado' && (
                <div style={{ background: '#F3F4F6', padding: '0.8rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
                    <b>Retiro:</b> {alumno.horaRetiro}hs <br/>
                    <b>Obs:</b> {alumno.observaciones}
                  </p>
                </div>
              )}
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Modal de Retiro y Observaciones */}
      {activeModalId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end'
        }}>
          <div style={{ 
            background: 'white', width: '100%', padding: '2rem 1.5rem', 
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            animation: 'slideUp 0.3s'
          }}>
            <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileEdit size={20} />
              Observaciones de la Maestra
            </h3>

            {/* Alerta de Autorizados para Retiro */}
            {(() => {
              const alumno = alumnos.find(a => a.id === activeModalId);
              if (alumno?.autorizados) {
                return (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#B45309', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '4px' }}>⚠️ Autorizados para retirar:</p>
                    <p style={{ margin: 0, color: '#92400E', fontSize: '0.95rem' }}>{alumno.autorizados}</p>
                  </div>
                );
              }
              return null;
            })()}

            <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: '1rem' }}>
              Escribe qué tareas se realizaron o si hay alguna novedad. Esto se guardará en la ficha histórica del alumno y se enviará por notificación a los padres.
            </p>
            
            <textarea 
              className="input-field" 
              rows={4} 
              placeholder="Ej: Terminamos la tarea de matemáticas de fracciones. ¡Trabajó excelente!"
              value={observacionTemp}
              onChange={(e) => setObservacionTemp(e.target.value)}
              style={{ marginBottom: '1.5rem' }}
            />

            <div className="flex gap-4">
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setActiveModalId(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={handleConfirmarRetiro}>
                <Check size={18} />
                Guardar y Notificar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Autenticación Admin */}
      <AdminAuthModal 
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        onSuccess={() => {
          if (pendingRoute) navigate(pendingRoute);
        }}
      />

      <HealthAlertModal 
        isOpen={!!healthAlertAlumno}
        onClose={() => {
          if (healthAlertAlumno) handleIngreso(healthAlertAlumno.id);
        }}
        alumnoNombre={healthAlertAlumno?.nombre || ''}
        saludInfo={healthAlertAlumno?.salud || ''}
      />

      {/* Agregar animación slideUp a CSS inline para el modal (Hack para mockup) */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default AsistenciaAdmin;
