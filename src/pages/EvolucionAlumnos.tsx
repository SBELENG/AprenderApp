import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, User, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Nota = {
  id: string;
  fecha: string;
  maestra: string;
  contenido: string;
  etiqueta: 'Progreso' | 'Observación' | 'Novedad';
};

type Alumno = {
  id: string;
  nombre: string;
  grado: string;
  escuela: string;
  dni: string;
  nacimiento: string;
  emergencia: string;
  autorizados: string;
  obraSocial?: string;
  historial: Nota[];
};

// Los datos vendrán de Supabase

const EvolucionAlumnos: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlumnos();
  }, []);

  const fetchAlumnos = async () => {
    setIsLoading(true);
    setError(null);

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const { data: alumnosData, error: alumnosError } = await supabase
          .from('alumnos')
          .select('id, nombre, grado, escuela, dni, fecha_nacimiento, emergencia_contacto, autorizados_retiro, obra_social')
          .order('nombre');

        if (alumnosError) throw alumnosError;

        // Obtener todas las asistencias con observaciones para el historial
        const { data: asistenciaData, error: asistenciaError } = await supabase
          .from('asistencia')
          .select('*')
          .not('observaciones', 'is', null)
          .order('fecha', { ascending: false });

        if (asistenciaError) throw asistenciaError;

        const mapped: Alumno[] = alumnosData.map(a => ({
          id: a.id,
          nombre: a.nombre,
          grado: a.grado || '',
          escuela: a.escuela || '',
          dni: a.dni || '',
          nacimiento: a.fecha_nacimiento || '',
          emergencia: a.emergencia_contacto || '',
          autorizados: a.autorizados_retiro || '',
          obraSocial: a.obra_social,
          historial: (asistenciaData || [])
            .filter(as => as.alumno_id === a.id)
            .map(as => ({
              id: as.id,
              fecha: as.fecha,
              maestra: 'Maestra', // Podríamos vincular con tabla maestras después
              contenido: as.observaciones,
              etiqueta: 'Observación'
            }))
        }));

        setAlumnos(mapped);
        setIsLoading(false);
        return; // Success, exit retry loop
      } catch (err: any) {
        attempt++;
        console.error(`Intento ${attempt} de carga de alumnos fallido:`, err);
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

  const filteredAlumnos = alumnos.filter(a => 
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h2 style={{ color: 'white', marginTop: '0.5rem' }}>Evolución Alumnos</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-tertiary)' }}>Historial y Seguimiento</p>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selectedAlumno ? (
          <>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={20} color="var(--color-gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar alumno..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 3rem', borderRadius: '12px', border: '1px solid var(--color-gray-300)' }}
                />
              </div>
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
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--color-gray-400)', marginTop: '2rem' }}>
                <Loader2 size={40} className="animate-spin" />
                <p>Cargando alumnos...</p>
              </div>
            ) : filteredAlumnos.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-gray-400)', marginTop: '2rem' }}>
                <p>No se encontraron alumnos registrados.</p>
              </div>
            ) : (
              <div className="flex-col gap-3">
                {filteredAlumnos.map(alumno => (
                  <div 
                    key={alumno.id} 
                    onClick={() => setSelectedAlumno(alumno)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', 
                      background: '#F9FAFB', borderRadius: '16px', cursor: 'pointer', border: '1px solid #F3F4F6'
                    }}
                  >
                    <div style={{ 
                      width: '45px', height: '45px', borderRadius: '50%', background: 'var(--color-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)'
                    }}>
                      <User size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)' }}>{alumno.nombre}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>{alumno.grado} - {alumno.escuela}</p>
                    </div>
                    <ChevronRight size={20} color="var(--color-gray-300)" />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <button 
              onClick={() => setSelectedAlumno(null)}
              style={{ background: 'none', border: 'none', color: 'var(--color-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1.5rem', cursor: 'pointer' }}
            >
              <ChevronLeft size={20} />
              Volver al listado
            </button>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-background)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)',
                margin: '0 auto 1rem'
              }}>
                <User size={40} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>{selectedAlumno.nombre}</h3>
              <p style={{ margin: 0, color: 'var(--color-gray-500)' }}>{selectedAlumno.grado} Grado | {selectedAlumno.escuela}</p>
              
              <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', background: 'var(--color-gray-100)', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>
                  DNI: {selectedAlumno.dni}
                </span>
                <span style={{ fontSize: '0.75rem', background: 'var(--color-gray-100)', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>
                  Emergencia: {selectedAlumno.emergencia}
                </span>
                {selectedAlumno.obraSocial && (
                  <span style={{ fontSize: '0.75rem', background: 'var(--color-gray-100)', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>
                    OS: {selectedAlumno.obraSocial}
                  </span>
                )}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                Autorizados: {selectedAlumno.autorizados}
              </div>
            </div>

            <h4 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--color-gray-200)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              Línea de Tiempo
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              {/* Línea vertical decorativa */}
              <div style={{ position: 'absolute', left: '11px', top: 0, bottom: 0, width: '2px', background: 'var(--color-gray-200)', zIndex: 0 }}></div>

              {selectedAlumno.historial.map(nota => (
                <div key={nota.id} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-secondary)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid white'
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }}></div>
                  </div>
                  <div style={{ flex: 1, background: '#F9FAFB', padding: '1rem', borderRadius: '16px', border: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} />
                        {nota.fecha}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>Por {nota.maestra}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-primary)', lineHeight: '1.4' }}>
                      {nota.contenido}
                    </p>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '100px', background: '#DBEAFE', color: '#1E40AF' }}>
                        {nota.etiqueta}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default EvolucionAlumnos;
