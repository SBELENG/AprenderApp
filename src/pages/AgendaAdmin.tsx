import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Loader2, Plus, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import emailjs from '@emailjs/browser';
import { supabase } from '../lib/supabase';

type AsistenciaRecord = {
  nombre: string;
  grado: string;
  turno: string;
  maestra: string;
  estado: string;
  salud: string;
  desempeno: string;
  alumno_id?: string;
  observaciones?: string;
  horaRetiro?: string;
  email?: string;
};

const formatDateStringAR = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AgendaAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [asistencia, setAsistencia] = useState<AsistenciaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [observacionTemp, setObservacionTemp] = useState('');

  // Estado para reserva manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualRes, setManualRes] = useState({ alumno_nombre: '', horario: '09:00 hs' });
  const [isSavingManual, setIsSavingManual] = useState(false);

  const TURNOS = [
    '09:00 hs', '10:00 hs', '11:00 hs',
    '14:00 hs', '15:00 hs', '16:00 hs', '17:00 hs'
  ];

  const [allAlumnos, setAllAlumnos] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    fetchAsistencia();
  }, [selectedDate]);

  useEffect(() => {
    const loadAlumnos = async () => {
      const { data } = await supabase.from('alumnos').select('id, nombre').order('nombre');
      if (data) setAllAlumnos(data);
    };
    loadAlumnos();
  }, []);

  const handleAddManualReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRes.alumno_nombre.trim()) {
      alert('Seleccioná un alumno');
      return;
    }
    setIsSavingManual(true);
    try {
      const { error } = await supabase.from('reservas').insert([{
        alumno_nombre: manualRes.alumno_nombre,
        fecha: selectedDate,
        horario: manualRes.horario
      }]);
      if (error) throw error;
      setIsManualModalOpen(false);
      setManualRes({ alumno_nombre: '', horario: '09:00 hs' });
      fetchAsistencia();
    } catch (err: any) {
      alert('Error al guardar reserva: ' + err.message);
    } finally {
      setIsSavingManual(false);
    }
  };

  const fetchAsistencia = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch reservas para el día
      const { data: reservasData, error: reservasError } = await supabase
        .from('reservas')
        .select('*')
        .eq('fecha', selectedDate)
        .order('horario');

      if (reservasError) throw reservasError;

      // 2. Fetch alumnos para cruzar datos (grado, maestra fija si la hay) y correo (familias)
      const { data: alumnosData } = await supabase.from('alumnos').select('nombre, grado, maestra_grado, id, salud_info, desempeno, familias(email)');
      
      // 3. Fetch asistencia real para ver si ya llegaron
      const { data: asistenciaData } = await supabase
        .from('asistencia')
        .select('*')
        .eq('fecha', selectedDate);

      // Filtrar defensivamente en memoria por fecha
      const reservasDelDia = (reservasData || []).filter(r => r.fecha === selectedDate);
      const asistenciaDelDia = (asistenciaData || []).filter(as => as.fecha === selectedDate);

      // 4. Mapear
      const mapped: AsistenciaRecord[] = reservasDelDia.map(r => {
        // Buscar el alumno por nombre (ya que la reserva guarda el nombre por el array)
        const alumnoInfo = alumnosData?.find(a => a.nombre === r.alumno_nombre);
        
        // Buscar si ya marcó ingreso/retiro
        let estado = 'Pendiente';
        let observaciones = '';
        let horaRetiro = '';
        if (alumnoInfo) {
          const asis = asistenciaDelDia.find(as => as.alumno_id === alumnoInfo.id);
          if (asis) {
            estado = asis.hora_retiro ? 'Retirado' : 'Presente';
            observaciones = asis.observaciones || '';
            horaRetiro = asis.hora_retiro || '';
          }
        }

        return {
          alumno_id: alumnoInfo?.id,
          nombre: r.alumno_nombre,
          grado: alumnoInfo?.grado || 'S/D',
          turno: r.horario, // AHORA MOSTRAMOS EL HORARIO REAL DE LA RESERVA
          maestra: alumnoInfo?.maestra_grado || 'S/D',
          estado,
          salud: alumnoInfo?.salud_info || '-',
          desempeno: alumnoInfo?.desempeno || '-',
          observaciones,
          horaRetiro,
          email: alumnoInfo ? ((alumnoInfo as any).familias?.email || ((alumnoInfo as any).familias && Array.isArray((alumnoInfo as any).familias) ? (alumnoInfo as any).familias[0]?.email : undefined)) : undefined
        };
      });

      setAsistencia(mapped);
    } catch (error) {
      console.error('Error fetching agenda:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openRetiroModal = (alumno_id: string | undefined, existingObs: string | undefined) => {
    if (!alumno_id) return;
    setActiveModalId(alumno_id);
    setObservacionTemp(existingObs || '');
  };

  const handleConfirmarRetiro = async () => {
    if (!activeModalId) return;
    if (observacionTemp.trim().length === 0) {
      alert("Debes ingresar una observación.");
      return;
    }
    const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    try {
      const { error } = await supabase
        .from('asistencia')
        .update({ hora_retiro: horaActual, observaciones: observacionTemp })
        .eq('alumno_id', activeModalId)
        .eq('fecha', selectedDate);
        
      if (error) throw error;
      
      const alumno = asistencia.find(a => a.alumno_id === activeModalId);
      
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

      setAsistencia(prev => prev.map(a => 
        a.alumno_id === activeModalId ? { ...a, estado: 'Retirado', observaciones: observacionTemp, horaRetiro: horaActual } : a
      ));
    } catch (err: any) {
      alert('Error al registrar retiro: ' + err.message);
    } finally {
      setActiveModalId(null);
    }
  };

  const handleExportPDF = () => {
    if (asistencia.length === 0) return;
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 95); // var(--color-primary)
    doc.text('ACADEMIA APRENDER', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Informe de Asistencia - ${formatDateStringAR(selectedDate)}`, 14, 32);

    // Tabla
    const tableColumn = ["Alumno", "Horario", "Grado", "Docente", "Salud", "Dificultad"];
    const tableRows = asistencia.map(record => [
      record.nombre,
      record.turno,
      record.grado,
      record.maestra,
      record.salud,
      record.desempeno
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    // Guardar en dispositivo
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Asistencia_${selectedDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-primary)' }}>
        <button 
          onClick={() => navigate('/admin/asistencia')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'white' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'white', marginTop: '0.5rem' }}>Panel Administración</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-tertiary)' }}>Gestión de Agenda</p>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Filtros */}
        <div style={{ background: 'var(--color-background)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Día de consulta</label>
          <input 
            type="date" 
            className="input-field" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', margin: 0 }}>
            Listado del Día ({asistencia.length})
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setManualRes({ alumno_nombre: '', horario: '09:00 hs' });
                setIsManualModalOpen(true);
              }}
              className="btn"
              style={{
                background: 'var(--color-primary)', color: 'white',
                padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center'
              }}
            >
              <Plus size={16} />
              Reserva manual
            </button>
            <button 
              onClick={handleExportPDF}
              disabled={asistencia.length === 0 || isLoading}
              className="btn"
              style={{ 
                background: 'var(--color-secondary)', color: 'white', 
                padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem',
                opacity: (asistencia.length === 0 || isLoading) ? 0.5 : 1
              }}
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>

        {/* Lista de Alumnos */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 1rem' }} />
            <p>Cargando asistencia...</p>
          </div>
        ) : asistencia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)', background: '#F9FAFB', borderRadius: '16px' }}>
            <p>No hay alumnos registrados.</p>
          </div>
        ) : (
          <div className="flex-col gap-3" style={{ marginBottom: '2rem' }}>
            {asistencia.map((alumno, idx) => (
              <div key={idx} style={{ 
                border: '1px solid var(--color-gray-300)', 
                borderRadius: '12px', padding: '1rem', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)' }}>{alumno.nombre}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                    ⏰ Horario: {alumno.turno}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
                    📚 Grado Escolar: {alumno.grado} | 👩‍🏫 Maestra: {alumno.maestra}
                  </p>
                  {(alumno.salud !== '-' || alumno.desempeno !== '-') && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#FEF2F2', borderRadius: '8px', fontSize: '0.75rem' }}>
                      {alumno.salud !== '-' && <p style={{ margin: 0, color: '#991B1B' }}><strong>Salud:</strong> {alumno.salud}</p>}
                      {alumno.desempeno !== '-' && <p style={{ margin: '4px 0 0', color: '#92400E' }}><strong>Académico:</strong> {alumno.desempeno}</p>}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span 
                    onClick={() => {
                      if (alumno.estado === 'Retirado' || alumno.estado === 'Presente') {
                        openRetiroModal(alumno.alumno_id, alumno.observaciones);
                      }
                    }}
                    style={{ 
                      display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: alumno.estado === 'Presente' ? '#D1FAE5' : alumno.estado === 'Pendiente' ? '#FEE2E2' : alumno.estado === 'Retirado' ? '#E5E7EB' : '#FEF3C7',
                      color: alumno.estado === 'Presente' ? '#065F46' : alumno.estado === 'Pendiente' ? '#991B1B' : alumno.estado === 'Retirado' ? '#374151' : '#92400E',
                      cursor: (alumno.estado === 'Retirado' || alumno.estado === 'Presente') ? 'pointer' : 'default',
                    }}
                    title={(alumno.estado === 'Retirado' || alumno.estado === 'Presente') ? "Clic para editar devolución" : ""}
                  >
                    {alumno.estado}
                    {alumno.estado === 'Retirado' && ' ✏️'}
                  </span>
                </div>
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
            <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--color-primary)' }}>
              Observaciones de la Maestra
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: '1rem' }}>
              Escribe qué tareas se realizaron o si hay alguna novedad.
            </p>
            <textarea 
              className="input-field" 
              rows={4} 
              placeholder="Ej: Terminamos la tarea..."
              value={observacionTemp}
              onChange={(e) => setObservacionTemp(e.target.value)}
              style={{ marginBottom: '1.5rem', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setActiveModalId(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirmarRetiro}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reserva Manual (Admin) */}
      {isManualModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '24px',
            width: '90%', maxWidth: '400px', position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <button
              onClick={() => setIsManualModalOpen(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--color-gray-400)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 0.25rem', color: 'var(--color-primary)' }}>Reserva Manual</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
              Registrar turno para: <strong>{formatDateStringAR(selectedDate)}</strong>
            </p>
            <form onSubmit={handleAddManualReserva} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Alumno</label>
                <select
                  className="input-field"
                  value={manualRes.alumno_nombre}
                  onChange={(e) => setManualRes({ ...manualRes, alumno_nombre: e.target.value })}
                  required
                >
                  <option value="">Seleccionar alumno</option>
                  {allAlumnos.map(a => (
                    <option key={a.id} value={a.nombre}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Horario</label>
                <select
                  className="input-field"
                  value={manualRes.horario}
                  onChange={(e) => setManualRes({ ...manualRes, horario: e.target.value })}
                >
                  {TURNOS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSavingManual}
                style={{ padding: '1rem', opacity: isSavingManual ? 0.6 : 1 }}
              >
                {isSavingManual ? 'Guardando...' : 'Confirmar Reserva'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AgendaAdmin;
