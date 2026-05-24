import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, Save, CalendarOff, Users, Sparkles, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SHIFTS = [
  { id: '09:00 hs', label: '09:00 a 10:00 hs' },
  { id: '10:00 hs', label: '10:00 a 11:00 hs' },
  { id: '11:00 hs', label: '11:00 a 12:00 hs' },
  { id: '14:00 hs', label: '14:00 a 15:00 hs' },
  { id: '15:00 hs', label: '15:00 a 16:00 hs' },
  { id: '16:00 hs', label: '16:00 a 17:00 hs' }
];

interface ShiftConfig {
  [day: string]: {
    [shiftId: string]: number;
  };
}

// Convierte YYYY-MM-DD a DD-MM-YYYY
const toLatinFormat = (isoString: string): string => {
  if (!isoString) return '';
  return isoString.split(',').map(s => {
    const parts = s.trim().split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return s.trim();
  }).join(', ');
};

// Convierte DD-MM-YYYY a YYYY-MM-DD
const toIsoFormat = (latinString: string): string => {
  if (!latinString) return '';
  return latinString.split(',').map(s => {
    const parts = s.trim().split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return s.trim();
  }).join(', ');
};

const ConfiguracionAdmin: React.FC = () => {
  const navigate = useNavigate();
  
  const [cupo, setCupo] = useState('4');
  const [feriados, setFeriados] = useState('25-05-2026, 20-06-2026');
  const [isSaving, setIsSaving] = useState(false);
  const [cuposDetallados, setCuposDetallados] = useState<ShiftConfig>(() => {
    const initial: ShiftConfig = {};
    DAYS.forEach(day => {
      initial[day] = {};
      SHIFTS.forEach(shift => {
        if (day === 'Sábado' && ['14:00 hs', '15:00 hs', '16:00 hs'].includes(shift.id)) {
          initial[day][shift.id] = 0;
        } else {
          initial[day][shift.id] = 4;
        }
      });
    });
    return initial;
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Cargar fallback de localStorage primero
        const localCupo = localStorage.getItem('config_cupo');
        const localFeriados = localStorage.getItem('config_feriados');
        const localDetallados = localStorage.getItem('config_cupos_detallados');

        if (localCupo) setCupo(localCupo);
        if (localFeriados) setFeriados(toLatinFormat(localFeriados));
        if (localDetallados) {
          try {
            setCuposDetallados(JSON.parse(localDetallados));
          } catch {}
        }

        // Intentar cargar desde Supabase
        const { data, error } = await supabase.from('configuracion').select('*');
        if (error) throw error;
        
        if (data) {
          const cupoItem = data.find(item => item.clave === 'cupo_maximo');
          const feriadosItem = data.find(item => item.clave === 'feriados');
          const cuposDetalladosItem = data.find(item => item.clave === 'cupos_detallados');

          if (cupoItem) {
            setCupo(cupoItem.valor);
            localStorage.setItem('config_cupo', cupoItem.valor);
          }
          if (feriadosItem) {
            setFeriados(toLatinFormat(feriadosItem.valor));
            localStorage.setItem('config_feriados', feriadosItem.valor);
          }
          if (cuposDetalladosItem) {
            try {
              const parsed = JSON.parse(cuposDetalladosItem.valor);
              setCuposDetallados(parsed);
              localStorage.setItem('config_cupos_detallados', cuposDetalladosItem.valor);
            } catch (e) {
              console.error("Error parsing cupos_detallados:", e);
            }
          } else if (cupoItem) {
            // Inicializar grid si no existía el registro detallado en Supabase
            const legacyVal = Number(cupoItem.valor) || 4;
            const initial: ShiftConfig = {};
            DAYS.forEach(day => {
              initial[day] = {};
              SHIFTS.forEach(shift => {
                if (day === 'Sábado' && ['14:00 hs', '15:00 hs', '16:00 hs'].includes(shift.id)) {
                  initial[day][shift.id] = 0;
                } else {
                  initial[day][shift.id] = legacyVal;
                }
              });
            });
            setCuposDetallados(initial);
          }
        }
      } catch (err) {
        console.warn("Usando fallback de configuración local:", err);
      }
    };
    fetchConfig();
  }, []);

  const handleCellChange = (day: string, shiftId: string, val: number) => {
    setCuposDetallados(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [shiftId]: Math.max(0, val)
      }
    }));
  };

  const applyGeneralCupoToGrid = () => {
    const val = Number(cupo) || 0;
    const updated: ShiftConfig = {};
    DAYS.forEach(day => {
      updated[day] = {};
      SHIFTS.forEach(shift => {
        if (day === 'Sábado' && ['14:00 hs', '15:00 hs', '16:00 hs'].includes(shift.id)) {
          updated[day][shift.id] = 0;
        } else {
          updated[day][shift.id] = val;
        }
      });
    });
    setCuposDetallados(updated);
    alert(`Se ha establecido el cupo de ${val} para todos los horarios activos.`);
  };

  const handleSave = async () => {
    setIsSaving(true);

    const cleanLatin = feriados.split(',').map(s => s.trim()).filter(Boolean);
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    const hasInvalidDate = cleanLatin.some(date => !dateRegex.test(date));
    
    if (hasInvalidDate && cleanLatin.length > 0) {
      alert('Por favor, asegúrate de ingresar los feriados en formato latino DD-MM-AAAA (ej. 25-05-2026) separados por coma.');
      setIsSaving(false);
      return;
    }

    const isoFeriados = toIsoFormat(feriados);

    // Guardar en localStorage como fallback inmediato
    localStorage.setItem('config_cupo', cupo);
    localStorage.setItem('config_feriados', isoFeriados);
    localStorage.setItem('config_cupos_detallados', JSON.stringify(cuposDetallados));

    try {
      // Guardar en Supabase
      const { error } = await supabase.from('configuracion').upsert([
        { clave: 'cupo_maximo', valor: cupo },
        { clave: 'feriados', valor: isoFeriados },
        { clave: 'cupos_detallados', valor: JSON.stringify(cuposDetallados) }
      ]);
      
      if (error) throw error;
      alert('¡Configuración guardada exitosamente en Supabase!');
    } catch (err: any) {
      console.error("Error guardando en Supabase:", err);
      alert('Configuración guardada localmente. Para que funcione en todos los dispositivos de los padres, recuerda crear la tabla "configuracion" en Supabase con las columnas "clave" y "valor" (text).');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="auth-layout" style={{ background: 'var(--color-white)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-primary)' }}>
        <button 
          onClick={() => navigate('/admin/asistencia')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'white' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'white', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <Settings size={24} />
          Configuración
        </h2>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Cupo General */}
        <div style={{ marginBottom: '2.5rem', background: '#F8FAFC', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            <Users size={20} />
            Cupo General por Defecto
          </h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
              <label className="input-label">Cantidad máxima predeterminada</label>
              <input 
                type="number" 
                className="input-field" 
                value={cupo}
                onChange={(e) => setCupo(e.target.value)}
                style={{ background: 'white' }}
              />
            </div>
            <button 
              type="button"
              className="btn btn-outline"
              onClick={applyGeneralCupoToGrid}
              style={{ height: '46px', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
            >
              <Sparkles size={16} />
              Aplicar a toda la grilla
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '8px' }}>
            Establece un número general aquí y haz click en "Aplicar a toda la grilla" para rellenar automáticamente la matriz inferior.
          </p>
        </div>

        {/* Cupo Detallado por Día/Hora */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
            <Sparkles size={20} color="var(--color-secondary)" />
            Cupos por Día y Horario
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: '1.25rem' }}>
            Modifica la capacidad de alumnos en cada celda según la disponibilidad de maestras por día y hora. Sábados de tarde se encuentran inactivos.
          </p>

          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', background: 'white' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary)', color: 'white' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600' }}>Horario</th>
                  {DAYS.map(day => (
                    <th key={day} style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', minWidth: '90px' }}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map((shift, idx) => (
                  <tr key={shift.id} style={{ borderBottom: idx === SHIFTS.length - 1 ? 'none' : '1px solid #E2E8F0', background: idx % 2 === 0 ? 'white' : '#F8FAFC' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {shift.label}
                    </td>
                    {DAYS.map(day => {
                      const isSatAfternoon = day === 'Sábado' && ['14:00 hs', '15:00 hs', '16:00 hs'].includes(shift.id);
                      const currentVal = cuposDetallados[day]?.[shift.id] !== undefined ? cuposDetallados[day][shift.id] : 4;
                      
                      return (
                        <td key={day} style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                          {isSatAfternoon ? (
                            <div style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--color-gray-400)', fontWeight: 'bold', background: '#F1F5F9', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                              Cerrado
                            </div>
                          ) : (
                            <input 
                              type="number"
                              min={0}
                              value={currentVal}
                              onChange={(e) => handleCellChange(day, shift.id, parseInt(e.target.value) || 0)}
                              style={{
                                width: '55px',
                                padding: '6px',
                                textAlign: 'center',
                                borderRadius: '8px',
                                border: '1px solid #CBD5E1',
                                outline: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                color: 'var(--color-primary)',
                                background: 'white',
                                WebkitAppearance: 'none',
                                margin: 0
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feriados en Formato Latino */}
        <div style={{ marginBottom: '2.5rem', background: '#F8FAFC', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            <CalendarOff size={20} />
            Días Feriados / Cerrados
          </h3>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Fechas (formato DD-MM-AAAA separadas por coma)</label>
            <textarea 
              className="input-field" 
              rows={3}
              value={feriados}
              onChange={(e) => setFeriados(e.target.value)}
              placeholder="ej. 25-05-2026, 20-06-2026"
              style={{ background: 'white' }}
            ></textarea>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'flex-start', color: 'var(--color-gray-500)' }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.8rem', margin: 0 }}>
                Ejemplo: <b>25-05-2026, 20-06-2026</b>. Estos días se deshabilitarán de forma automática para que los padres no puedan agendar turnos.
              </p>
            </div>
          </div>
        </div>

        {/* Botón de Guardar */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <button 
            className="btn btn-secondary btn-block" 
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', height: '48px', alignItems: 'center', fontSize: '1rem' }}
          >
            {isSaving ? 'Guardando...' : (
              <>
                <Save size={20} /> Guardar Configuración
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ConfiguracionAdmin;
