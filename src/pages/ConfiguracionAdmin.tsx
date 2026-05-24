import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, Save, CalendarOff, Users, Sparkles, Info, Calendar, RotateCcw, Download, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const DAYS_ENGLISH_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface ShiftConfig {
  [day: string]: {
    [shiftId: string]: number;
  };
}

interface DateOverrideConfig {
  [dateString: string]: {
    [shiftId: string]: number;
  };
}

// Helper local de fecha local YYYY-MM-DD
const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  
  // Matriz semanal predeterminada (Lunes a Sábado)
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

  // Ajustes específicos por Fecha de Calendario
  const [cuposEspecifcos, setCuposEspecifcos] = useState<DateOverrideConfig>({});
  const [exceptionDate, setExceptionDate] = useState(getLocalDateString());

  // Estados para la vista previa mensual interactiva
  const todayObj = new Date();
  const [previewMonth, setPreviewMonth] = useState(todayObj.getMonth());
  const [previewYear, setPreviewYear] = useState(todayObj.getFullYear());
  const [selectedPreviewDay, setSelectedPreviewDay] = useState<number | null>(todayObj.getDate());

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Cargar fallback de localStorage primero
        const localCupo = localStorage.getItem('config_cupo');
        const localFeriados = localStorage.getItem('config_feriados');
        const localDetallados = localStorage.getItem('config_cupos_detallados');
        const localEspecifcos = localStorage.getItem('config_cupos_especificos');

        if (localCupo) setCupo(localCupo);
        if (localFeriados) setFeriados(toLatinFormat(localFeriados));
        if (localDetallados) {
          try {
            setCuposDetallados(JSON.parse(localDetallados));
          } catch {}
        }
        if (localEspecifcos) {
          try {
            setCuposEspecifcos(JSON.parse(localEspecifcos));
          } catch {}
        }

        // Intentar cargar desde Supabase
        const { data, error } = await supabase.from('configuracion').select('*');
        if (error) throw error;
        
        if (data) {
          const cupoItem = data.find(item => item.clave === 'cupo_maximo');
          const feriadosItem = data.find(item => item.clave === 'feriados');
          const cuposDetalladosItem = data.find(item => item.clave === 'cupos_detallados');
          const cuposEspecifcosItem = data.find(item => item.clave === 'cupos_especificos');

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
          }
          if (cuposEspecifcosItem) {
            try {
              const parsed = JSON.parse(cuposEspecifcosItem.valor);
              setCuposEspecifcos(parsed);
              localStorage.setItem('config_cupos_especificos', cuposEspecifcosItem.valor);
            } catch {}
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

  const handleExceptionCellChange = (shiftId: string, val: number) => {
    setCuposEspecifcos(prev => {
      const dayConfig = prev[exceptionDate] || {};
      return {
        ...prev,
        [exceptionDate]: {
          ...dayConfig,
          [shiftId]: Math.max(0, val)
        }
      };
    });
  };

  const resetExceptionCell = (shiftId: string) => {
    setCuposEspecifcos(prev => {
      const dayConfig = { ...(prev[exceptionDate] || {}) };
      delete dayConfig[shiftId];
      
      const newConfig = { ...prev };
      if (Object.keys(dayConfig).length === 0) {
        delete newConfig[exceptionDate];
      } else {
        newConfig[exceptionDate] = dayConfig;
      }
      return newConfig;
    });
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

    // Guardar en localStorage
    localStorage.setItem('config_cupo', cupo);
    localStorage.setItem('config_feriados', isoFeriados);
    localStorage.setItem('config_cupos_detallados', JSON.stringify(cuposDetallados));
    localStorage.setItem('config_cupos_especificos', JSON.stringify(cuposEspecifcos));

    try {
      // Guardar en Supabase
      const { error } = await supabase.from('configuracion').upsert([
        { clave: 'cupo_maximo', valor: cupo },
        { clave: 'feriados', valor: isoFeriados },
        { clave: 'cupos_detallados', valor: JSON.stringify(cuposDetallados) },
        { clave: 'cupos_especificos', valor: JSON.stringify(cuposEspecifcos) }
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

  const getExceptionDayName = (): string => {
    if (!exceptionDate) return 'Lunes';
    const dateParts = exceptionDate.split('-');
    if (dateParts.length === 3) {
      const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
      return DAYS_ENGLISH_MAP[d.getDay()];
    }
    return 'Lunes';
  };

  const currentExceptionDayName = getExceptionDayName();
  const isSundayException = currentExceptionDayName === 'Domingo';

  // Obtener cupo específico de una celda/fecha dada
  const getSlotCapacityForDate = (date: Date, shiftId: string): number => {
    const yr = date.getFullYear();
    const mn = String(date.getMonth() + 1).padStart(2, '0');
    const dy = String(date.getDate()).padStart(2, '0');
    const dateString = `${yr}-${mn}-${dy}`;
    
    // 1. Priorizar override específico
    if (cuposEspecifcos && cuposEspecifcos[dateString] && cuposEspecifcos[dateString][shiftId] !== undefined) {
      return cuposEspecifcos[dateString][shiftId];
    }
    
    // 2. Fallback a la plantilla semanal
    const dayOfWeek = date.getDay();
    const dayName = DAYS_ENGLISH_MAP[dayOfWeek];
    if (cuposDetallados && cuposDetallados[dayName] && cuposDetallados[dayName][shiftId] !== undefined) {
      return cuposDetallados[dayName][shiftId];
    }
    
    // 3. Fallback a general
    return Number(cupo) || 4;
  };

  // Generador de PDF Mensual
  const exportMonthPDF = () => {
    const doc = new jsPDF();
    const monthName = MONTHS_NAMES[previewMonth];
    
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 95);
    doc.text(`Reporte de Cupos por Turnos - Academia Aprender`, 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Mes Calendario: ${monthName} de ${previewYear}`, 14, 30);
    
    doc.setFontSize(9);
    doc.text(`Fecha de emisión: ${toLatinFormat(getLocalDateString())}`, 14, 36);

    const daysInMonthCount = new Date(previewYear, previewMonth + 1, 0).getDate();
    
    const tableColumn = ["Fecha", "Día", "09:00-10:00", "10:00-11:00", "11:00-12:00", "14:00-15:00", "15:00-16:00", "16:00-17:00"];
    const tableRows: any[] = [];
    
    const cleanFeriadosList = feriados.split(',').map(s => toIsoFormat(s.trim()));

    for (let day = 1; day <= daysInMonthCount; day++) {
      const date = new Date(previewYear, previewMonth, day);
      const dayOfWeek = date.getDay();
      const dayName = DAYS_ENGLISH_MAP[dayOfWeek];
      const isSunday = dayOfWeek === 0;
      
      const dateString = `${previewYear}-${String(previewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isFeriadoDay = cleanFeriadosList.includes(dateString);
      const dateFormatted = `${String(day).padStart(2, '0')}-${String(previewMonth + 1).padStart(2, '0')}-${previewYear}`;
      
      if (isSunday) {
        tableRows.push([dateFormatted, dayName, "Cerrado", "Cerrado", "Cerrado", "Cerrado", "Cerrado", "Cerrado"]);
      } else if (isFeriadoDay) {
        tableRows.push([dateFormatted, dayName, "Feriado", "Feriado", "Feriado", "Feriado", "Feriado", "Feriado"]);
      } else {
        const row = [
          dateFormatted,
          dayName,
          getSlotCapacityForDate(date, '09:00 hs').toString(),
          getSlotCapacityForDate(date, '10:00 hs').toString(),
          getSlotCapacityForDate(date, '11:00 hs').toString(),
          dayOfWeek === 6 ? "Cerrado" : getSlotCapacityForDate(date, '14:00 hs').toString(),
          dayOfWeek === 6 ? "Cerrado" : getSlotCapacityForDate(date, '15:00 hs').toString(),
          dayOfWeek === 6 ? "Cerrado" : getSlotCapacityForDate(date, '16:00 hs').toString(),
        ];
        tableRows.push(row);
      }
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 42,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95], halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'left' }
      }
    });

    doc.save(`Reporte_Cupos_${monthName}_${previewYear}.pdf`);
  };

  // Lógica del Calendario de Vista Previa
  const daysInPreviewMonth = new Date(previewYear, previewMonth + 1, 0).getDate();
  const previewMonthArray = Array.from({ length: daysInPreviewMonth }, (_, i) => i + 1);
  const startDayOfWeek = new Date(previewYear, previewMonth, 1).getDay();

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
        
        {/* Sección de Vista Previa Mensual y Reporte PDF (¡NUEVO!) */}
        <div style={{ marginBottom: '2.5rem', background: '#F8FAFC', padding: '1.5rem', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', margin: 0, fontSize: '1.2rem' }}>
                <Eye size={22} color="var(--color-secondary)" />
                Visualización y Reporte Mensual de Cupos
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', margin: '4px 0 0' }}>
                Analiza cómo queda configurada la disponibilidad general de toda tu academia para cada día del mes.
              </p>
            </div>
            <button 
              type="button"
              className="btn"
              onClick={exportMonthPDF}
              style={{ background: 'var(--color-secondary)', color: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center', height: '42px', padding: '0 1.25rem', fontSize: '0.85rem' }}
            >
              <Download size={18} />
              Imprimir PDF del Mes
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            {/* Selector de Mes / Año y Calendario */}
            <div style={{ flex: '1.3', minWidth: '300px' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <select 
                  className="input-field" 
                  value={previewMonth} 
                  onChange={(e) => { setPreviewMonth(Number(e.target.value)); setSelectedPreviewDay(1); }}
                  style={{ padding: '0.5rem', background: 'white' }}
                >
                  {MONTHS_NAMES.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
                <select 
                  className="input-field" 
                  value={previewYear} 
                  onChange={(e) => { setPreviewYear(Number(e.target.value)); setSelectedPreviewDay(1); }}
                  style={{ padding: '0.5rem', background: 'white', width: '100px' }}
                >
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </select>
              </div>

              {/* Grid de Calendario Mini */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', background: 'white', padding: '1rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
                  <div key={d} style={{ fontWeight: 'bold', color: 'var(--color-gray-400)', fontSize: '0.8rem', paddingBottom: '4px' }}>{d}</div>
                ))}
                
                {/* Spacers */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`sp-${i}`} />)}

                {/* Days */}
                {previewMonthArray.map(day => {
                  const date = new Date(previewYear, previewMonth, day);
                  const dayOfWeek = date.getDay();
                  const dateString = `${previewYear}-${String(previewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  
                  const isSun = dayOfWeek === 0;
                  const isFeriadoDay = feriados.split(',').map(s => toIsoFormat(s.trim())).includes(dateString);
                  const hasCustomOverride = cuposEspecifcos && cuposEspecifcos[dateString] !== undefined;
                  const isSelected = selectedPreviewDay === day;

                  let bg = 'white';
                  let border = '1px solid #E2E8F0';
                  let color = 'var(--color-primary)';

                  if (isSun || isFeriadoDay) {
                    bg = '#F1F5F9';
                    color = '#94A3B8';
                  } else if (isSelected) {
                    bg = '#EFF6FF';
                    border = '2px solid var(--color-secondary)';
                    color = 'var(--color-secondary)';
                  }

                  return (
                    <div 
                      key={day}
                      onClick={() => setSelectedPreviewDay(day)}
                      style={{ 
                        aspectRatio: '1.2', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                        background: bg, border: border, color: color, borderRadius: '8px', cursor: 'pointer',
                        fontWeight: isSelected ? 'bold' : 'normal', fontSize: '0.85rem', position: 'relative'
                      }}
                    >
                      {day}
                      {hasCustomOverride && (
                        <div style={{ position: 'absolute', bottom: '2px', width: '4px', height: '4px', borderRadius: '50%', background: '#10B981' }} title="Tiene cupos personalizados" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalle del Día Seleccionado en Calendario */}
            <div style={{ flex: '1', minWidth: '260px', background: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedPreviewDay ? (
                (() => {
                  const date = new Date(previewYear, previewMonth, selectedPreviewDay);
                  const dayOfWeek = date.getDay();
                  const dayName = DAYS_ENGLISH_MAP[dayOfWeek];
                  
                  const dateString = `${previewYear}-${String(previewMonth + 1).padStart(2, '0')}-${String(selectedPreviewDay).padStart(2, '0')}`;
                  const cleanFeriadosList = feriados.split(',').map(s => toIsoFormat(s.trim()));
                  const isFeriadoDay = cleanFeriadosList.includes(dateString);
                  
                  const dateFormatted = `${String(selectedPreviewDay).padStart(2, '0')}-${String(previewMonth + 1).padStart(2, '0')}-${previewYear}`;

                  return (
                    <>
                      <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '0.95rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem', fontWeight: 'bold' }}>
                        Día: {dateFormatted} <span style={{ fontWeight: 'normal', color: 'var(--color-gray-500)' }}>({dayName})</span>
                      </h4>

                      {dayOfWeek === 0 ? (
                        <p style={{ margin: '1rem 0', color: '#EF4444', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center' }}>Cerrado (Domingo)</p>
                      ) : isFeriadoDay ? (
                        <p style={{ margin: '1rem 0', color: '#EF4444', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center' }}>Cerrado (Feriado)</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem', marginTop: '0.25rem' }}>
                          {SHIFTS.map(shift => {
                            const isSatAfternoon = dayOfWeek === 6 && ['14:00 hs', '15:00 hs', '16:00 hs'].includes(shift.id);
                            const capacity = isSatAfternoon ? 0 : getSlotCapacityForDate(date, shift.id);
                            const hasOverride = !isSatAfternoon && cuposEspecifcos && cuposEspecifcos[dateString] && cuposEspecifcos[dateString][shift.id] !== undefined;

                            return (
                              <div key={shift.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: hasOverride ? '#ECFDF5' : '#F8FAFC', borderRadius: '8px', border: `1px solid ${hasOverride ? '#A7F3D0' : '#E2E8F0'}`, fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--color-gray-600)' }}>{shift.label}</span>
                                <span style={{ fontWeight: 'bold', color: isSatAfternoon ? '#EF4444' : hasOverride ? '#047857' : 'var(--color-primary)' }}>
                                  {isSatAfternoon ? "Cerrado" : `${capacity} alumnos`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-400)', fontSize: '0.85rem' }}>
                  Selecciona un día del calendario para ver sus cupos.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Sección 1: Cupo General */}
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
              Aplicar a plantilla predeterminada
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '8px' }}>
            Establece un número general aquí y haz click en "Aplicar a plantilla" para rellenar de forma masiva la matriz semanal.
          </p>
        </div>

        {/* Sección 2: Ajuste de Cupos por Fecha Específica */}
        <div style={{ marginBottom: '2.5rem', background: '#F0F9FF', padding: '1.5rem', borderRadius: '20px', border: '1px solid #BAE6FD' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0369A1', marginBottom: '0.5rem', fontSize: '1.15rem' }}>
            <Calendar size={22} color="#0284C7" />
            Ajuste de Cupos por Fecha Específica (Excepciones)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#0369A1', marginBottom: '1.25rem' }}>
            ¿No todos los Lunes asiste la misma cantidad de maestras? Selecciona un <b>día específico del mes</b> para modificar individualmente su capacidad.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label className="input-label" style={{ color: '#0369A1', fontWeight: 'bold' }}>1. Selecciona la Fecha a Ajustar</label>
              <input 
                type="date"
                className="input-field"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                style={{ background: 'white', borderColor: '#0284C7' }}
              />
            </div>
            <div style={{ padding: '0.75rem 1rem', background: 'white', borderRadius: '12px', border: '1px solid #BAE6FD', minWidth: '220px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>Visualización Latina:</span>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#0369A1', fontSize: '1.1rem' }}>
                {toLatinFormat(exceptionDate)} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--color-gray-500)' }}>({currentExceptionDayName})</span>
              </p>
            </div>
          </div>

          {isSundayException ? (
            <div style={{ padding: '1.5rem', background: 'white', border: '1px dashed #FDA4AF', borderRadius: '12px', textAlign: 'center', color: '#E11D48' }}>
              La academia está cerrada los Domingos. No es necesario configurar cupos para esta fecha.
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1rem', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 1rem', color: 'var(--color-primary)', fontSize: '0.95rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                Configuración para el día {toLatinFormat(exceptionDate)}:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {SHIFTS.map(shift => {
                  const isSatAfternoon = currentExceptionDayName === 'Sábado' && ['14:00 hs', '15:00 hs', '16:00 hs'].includes(shift.id);
                  const defaultValue = cuposDetallados[currentExceptionDayName]?.[shift.id] !== undefined 
                    ? cuposDetallados[currentExceptionDayName][shift.id] 
                    : 4;

                  const hasOverride = cuposEspecifcos[exceptionDate]?.[shift.id] !== undefined;
                  const currentValue = hasOverride 
                    ? cuposEspecifcos[exceptionDate][shift.id] 
                    : defaultValue;

                  return (
                    <div 
                      key={shift.id} 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        padding: '0.5rem 0.75rem', borderRadius: '10px',
                        background: isSatAfternoon ? '#F8FAFC' : hasOverride ? '#ECFDF5' : 'white',
                        border: `1px solid ${hasOverride ? '#A7F3D0' : '#E2E8F0'}`
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{shift.label}</span>
                        {isSatAfternoon ? (
                          <span style={{ fontSize: '0.75rem', color: '#EF4444', marginLeft: '0.5rem', fontWeight: 'bold' }}>(Cerrado)</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginLeft: '0.5rem' }}>
                            {hasOverride ? `(Predeterminado: ${defaultValue})` : '(Usando plantilla predeterminada)'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isSatAfternoon ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>N/A</span>
                        ) : (
                          <>
                            <input 
                              type="number"
                              min={0}
                              value={currentValue}
                              onChange={(e) => handleExceptionCellChange(shift.id, parseInt(e.target.value) || 0)}
                              style={{
                                width: '60px',
                                padding: '6px',
                                textAlign: 'center',
                                borderRadius: '8px',
                                border: `1px solid ${hasOverride ? '#10B981' : '#CBD5E1'}`,
                                outline: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                color: hasOverride ? '#047857' : 'var(--color-primary)',
                                background: 'white'
                              }}
                            />
                            {hasOverride && (
                              <button 
                                type="button"
                                onClick={() => resetExceptionCell(shift.id)}
                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                title="Volver al valor predeterminado"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sección 3: Plantilla Semanal Predeterminada */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
            <Sparkles size={20} color="var(--color-secondary)" />
            Matriz Predeterminada (Plantilla Semanal Base)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: '1.25rem' }}>
            Define aquí la matriz semanal de cupos base. Cuando un día no tenga un "Ajuste específico" en la sección superior, heredará automáticamente estos valores.
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
                                background: 'white'
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

        {/* Sección 4: Feriados en Formato Latino */}
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
