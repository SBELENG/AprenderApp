import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, UserCheck, UserMinus, FileEdit, Check, BarChart3, Users2, LineChart, Loader2, Settings, Calendar, User } from 'lucide-react';
import AdminAuthModal from '../components/AdminAuthModal';
import HealthAlertModal from '../components/HealthAlertModal';
import { supabase } from '../lib/supabase';
import emailjs from '@emailjs/browser';

type Alumno = {
  id: string;
  nombre: string;
  turno: string;
  grado?: string;
  estado: 'Pendiente' | 'Presente' | 'Retirado';
  horaIngreso?: string;
  horaRetiro?: string;
  observaciones?: string;
  salud?: string;
  dni?: string;
  emergencia?: string;
  autorizados?: string;
  maestraNombre?: string;
  fotoUrl?: string;
  email?: string;
};

type Maestra = {
  id: string;
  nombre: string;
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AsistenciaAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [maestras, setMaestras] = useState<Maestra[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [activeIngresoModalId, setActiveIngresoModalId] = useState<string | null>(null);
  const [selectedMaestraId, setSelectedMaestraId] = useState('');
  const [observacionTemp, setObservacionTemp] = useState('');
  const [pushNotification, setPushNotification] = useState<string | null>(null);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [healthAlertAlumno, setHealthAlertAlumno] = useState<Alumno | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlumnos();
  }, [selectedDate]);

  const fetchAlumnos = async () => {
    setIsLoading(true);
    setError(null);

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // 1. Obtener todos los alumnos
        const { data: alumnosData, error: alumnosError } = await supabase
          .from('alumnos')
          .select('id, nombre, grado, salud_info, dni, emergencia_contacto, autorizados_retiro, familias(email)')
          .order('nombre');

        if (alumnosError) throw alumnosError;

        const { data: maestrasData } = await supabase.from('maestras').select('id, nombre').order('nombre');
        if (maestrasData) setMaestras(maestrasData);

        // 2. Obtener asistencia
        const { data: asistenciaData, error: asistenciaError } = await supabase
          .from('asistencia')
          .select('*')
          .eq('fecha', selectedDate);

        if (asistenciaError) throw asistenciaError;

        // 2.5 Obtener reservas del día
        const { data: reservasData } = await supabase
          .from('reservas')
          .select('*')
          .eq('fecha', selectedDate);

        // Filtrar en memoria defensivamente por fecha seleccionada
        const reservasDelDia = (reservasData || []).filter(r => r.fecha === selectedDate);
        const asistenciaDelDia = (asistenciaData || []).filter(as => as.fecha === selectedDate);

        // Filtrar alumnos que tengan reserva para este día O que ya tengan registro de asistencia
        const bookedNames = new Set(reservasDelDia.map(r => r.alumno_nombre.trim().toLowerCase()));
        const attendedIds = new Set(asistenciaDelDia.map(as => as.alumno_id));

        const filteredAlumnos = alumnosData.filter(a => 
          bookedNames.has(a.nombre.trim().toLowerCase()) || attendedIds.has(a.id)
        );

        // 2.6 Obtener fotos únicamente para los alumnos activos del día (evita timeouts)
        const activeIds = filteredAlumnos.map(a => a.id);
        let fotosMap: Record<string, string> = {};
        if (activeIds.length > 0) {
          const { data: fotosData } = await supabase
            .from('alumnos')
            .select('id, foto_url')
            .in('id', activeIds);
          
          if (fotosData) {
            fotosData.forEach(f => {
              if (f.foto_url) {
                fotosMap[f.id] = f.foto_url;
              }
            });
          }
        }

        // 3. Mapear datos
        const mappedAlumnos: Alumno[] = filteredAlumnos.map(a => {
          const asistencia = asistenciaDelDia.find(as => as.alumno_id === a.id);
          const reserva = reservasDelDia.find(r => r.alumno_nombre.trim().toLowerCase() === a.nombre.trim().toLowerCase());
          let estado: 'Pendiente' | 'Presente' | 'Retirado' = 'Pendiente';
          if (asistencia) {
            estado = asistencia.hora_retiro ? 'Retirado' : 'Presente';
          }

          return {
            id: a.id,
            nombre: a.nombre,
            turno: reserva?.horario || 'S/D', // AHORA turno ES EL HORARIO DE RESERVA
            grado: a.grado || 'S/D', // AHORA grado ES EL GRADO ESCOLAR REAL
            estado,
            horaIngreso: asistencia?.hora_ingreso,
            horaRetiro: asistencia?.hora_retiro,
            observaciones: asistencia?.observaciones,
            salud: a.salud_info,
            dni: a.dni,
            emergencia: a.emergencia_contacto,
            autorizados: a.autorizados_retiro,
            maestraNombre: maestrasData?.find(m => m.id === asistencia?.maestra_id)?.nombre,
            fotoUrl: fotosMap[a.id] || undefined,
            email: (a as any).familias?.email || ((a as any).familias && Array.isArray((a as any).familias) ? (a as any).familias[0]?.email : undefined)
          };
        });

        mappedAlumnos.sort((a, b) => {
          // Handle 'S/D' to always be at the end, otherwise sort by turno (hour)
          if (a.turno === 'S/D') return 1;
          if (b.turno === 'S/D') return -1;
          return a.turno.localeCompare(b.turno);
        });

        setAlumnos(mappedAlumnos);
        setIsLoading(false);
        return; // Success, exit retry loop
      } catch (err: any) {
        attempt++;
        console.error(`Intento ${attempt} de carga de asistencia fallido:`, err);
        if (attempt > maxRetries) {
          const dbMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          setError(`Error de Base de Datos: ${dbMessage}`);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } finally {
        if (attempt > maxRetries) {
          setIsLoading(false);
        }
      }
    }
  };

  const showPush = (message: string) => {
    setPushNotification(message);
    setTimeout(() => setPushNotification(null), 4000);
  };

  const openIngresoModal = (id: string) => {
    const alumno = alumnos.find(a => a.id === id);
    if (alumno?.salud && !healthAlertAlumno) {
      setHealthAlertAlumno(alumno);
      return;
    }
    setActiveIngresoModalId(id);
    setSelectedMaestraId('');
  };

  const handleConfirmarIngreso = async () => {
    if (!activeIngresoModalId) return;
    if (!selectedMaestraId) {
      alert("Debes seleccionar una maestra a cargo.");
      return;
    }

    const id = activeIngresoModalId;
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;

    const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    try {
      const { error } = await supabase
        .from('asistencia')
        .insert([{
          alumno_id: id,
          fecha: selectedDate,
          hora_ingreso: horaActual,
          maestra_id: selectedMaestraId
        }]);

      if (error) throw error;

      const maestraName = maestras.find(m => m.id === selectedMaestraId)?.nombre;

      setAlumnos(prev => prev.map(a => 
        a.id === id ? { ...a, estado: 'Presente', horaIngreso: horaActual, maestraNombre: maestraName } : a
      ));
      
      showPush(`Notificación en pantalla: ¡${alumno.nombre} ingresó a la academia a las ${horaActual}!`);
      
      if (alumno.email) {
        emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_id',
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_id',
          {
            to_email: alumno.email,
            nombre_alumno: alumno.nombre,
            hora: horaActual,
            estado: 'Ingresado/Presente',
            observaciones: ''
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key'
        ).catch(e => console.error("Error enviando email:", e));
      }

      setActiveIngresoModalId(null);
    } catch (error: any) {
      alert('Error al registrar ingreso (Asegúrate de agregar la columna maestra_id en Supabase): ' + error.message);
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
    const alumno = alumnos.find(a => a.id === activeModalId);
    
    try {
      // 1. Obtener la hora de ingreso y maestra de la asistencia antes de actualizar
      const { data: asisData } = await supabase
        .from('asistencia')
        .select('hora_ingreso, maestra_id')
        .eq('alumno_id', activeModalId)
        .eq('fecha', selectedDate)
        .single();

      // 2. Registrar el retiro en la asistencia
      const { error } = await supabase
        .from('asistencia')
        .update({
          hora_retiro: horaActual,
          observaciones: observacionTemp
        })
        .eq('alumno_id', activeModalId)
        .eq('fecha', selectedDate);

      if (error) throw error;

      // 3. Si hay maestra y hora de ingreso, calcular horas y registrarlas en jornales
      if (asisData && asisData.maestra_id && asisData.hora_ingreso) {
        const parseTimeToMinutes = (timeStr: string): number => {
          const [hrs, mins] = timeStr.split(':').map(Number);
          return hrs * 60 + mins;
        };
        const minutesIngreso = parseTimeToMinutes(asisData.hora_ingreso);
        const minutesRetiro = parseTimeToMinutes(horaActual);
        // Calcular diferencia en horas, mínimo 1.0 horas, redondeado a 1 decimal
        const diffHours = Math.max(1.0, Math.round(((minutesRetiro - minutesIngreso) / 60) * 10) / 10);
        
        await supabase
          .from('jornales')
          .insert([{
            maestra_id: asisData.maestra_id,
            horas: diffHours,
            observaciones: `Clase con ${alumno?.nombre || 'Alumno'} (${asisData.hora_ingreso} a ${horaActual})`,
            fecha: selectedDate
          }]);
      }

      setAlumnos(prev => prev.map(a => 
        a.id === activeModalId ? { ...a, estado: 'Retirado', horaRetiro: horaActual, observaciones: observacionTemp } : a
      ));

      showPush(`Notificación en pantalla: ¡${alumno?.nombre} fue retirado a las ${horaActual}!`);

      if (alumno && alumno.email) {
        emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_id',
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_id',
          {
            to_email: alumno.email,
            nombre_alumno: alumno.nombre,
            hora: horaActual,
            estado: 'Retirado',
            observaciones: observacionTemp
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key'
        ).catch(e => console.error("Error enviando email:", e));
      }

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
            onClick={() => navigate('/admin/agenda')}
            style={{ 
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', 
              alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap'
            }}
          >
            <Calendar size={16} />
            Agenda Turnos
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
          <button 
            onClick={() => navigate('/admin/configuracion')}
            style={{ 
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', 
              alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap'
            }}
          >
            <Settings size={16} />
            Configuración
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', margin: 0 }}>Alumnos del día</h3>
          <input 
            type="date" 
            className="input-field" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem', fontSize: '0.85rem' }}
          />
        </div>

        {error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.25rem', color: 'var(--color-primary)', textAlign: 'center', marginTop: '2rem', background: '#FEF2F2', padding: '2rem', borderRadius: '16px', border: '1px solid #FEE2E2' }}>
            <p style={{ color: 'var(--color-secondary)', fontWeight: 'bold', margin: 0 }}>{error}</p>
            <button 
              className="btn btn-secondary" 
              onClick={fetchAlumnos} 
              style={{ padding: '0.6rem 1.5rem', background: 'var(--color-secondary)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🔄 Reintentar Conexión
            </button>
          </div>
        ) : isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--color-gray-400)' }}>
            <Loader2 size={40} className="animate-spin" />
            <p>Cargando alumnos...</p>
          </div>
        ) : alumnos.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--color-gray-400)', textAlign: 'center' }}>
            <Users2 size={48} />
            <p>No hay alumnos reservados ni ingresados para este día.<br/>Usa la Ficha de Inscripción o Agenda para registrar turnos.</p>
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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {/* Foto de Perfil del Alumno */}
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    overflow: 'hidden', 
                    background: 'var(--color-gray-100)', 
                    border: '2px solid var(--color-gray-200)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0
                  }}>
                    {alumno.fotoUrl ? (
                      <img src={alumno.fotoUrl} alt={alumno.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={30} color="var(--color-gray-400)" />
                    )}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem' }}>{alumno.nombre}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                      ⏰ Horario Reservado: {alumno.turno}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
                      📚 Grado Escolar: {alumno.grado}
                    </p>
                    {alumno.maestraNombre && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#10B981', fontWeight: 'bold' }}>
                        <Users2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        A cargo de: {alumno.maestraNombre}
                      </p>
                    )}
                  </div>
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
                  onClick={() => openIngresoModal(alumno.id)}
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

      {/* Modal de Asignación de Maestra para Ingreso */}
      {activeIngresoModalId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ 
            background: 'white', width: '90%', maxWidth: '400px', padding: '2rem', 
            borderRadius: '24px', animation: 'fadeIn 0.2s'
          }}>
            <h3 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Asignar Maestra</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: '1.5rem' }}>
              Selecciona quién estará a cargo de este alumno durante el turno actual.
            </p>
            
            <select 
              className="input-field" 
              value={selectedMaestraId}
              onChange={(e) => setSelectedMaestraId(e.target.value)}
              style={{ marginBottom: '1.5rem' }}
            >
              <option value="">-- Seleccionar Maestra --</option>
              {maestras.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>

            <div className="flex gap-4">
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setActiveIngresoModalId(null)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, display: 'flex', gap: '0.5rem', justifyContent: 'center', background: '#10B981', borderColor: '#10B981' }} 
                onClick={handleConfirmarIngreso}
              >
                <UserCheck size={18} />
                Confirmar Ingreso
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
          const id = healthAlertAlumno?.id;
          setHealthAlertAlumno(null);
          if (id) {
            setActiveIngresoModalId(id);
            setSelectedMaestraId('');
          }
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
