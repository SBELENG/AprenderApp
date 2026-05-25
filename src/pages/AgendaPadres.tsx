import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Calendar as CalendarIcon, CheckCircle2, Download, Info, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

// Helper de formato de fecha en Argentina (dd-mm-aaaa)
const formatDateAR = (date: Date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getLocalDateStringFromDate = (d: Date): string => {
  const yr = d.getFullYear();
  const mn = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mn}-${dy}`;
};

type Reservation = { date: Date, shiftId: string, shiftLabel: string };

const DAYS_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const AgendaPadres: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentState = location.state as { plan: string, childrenCount: number, durationCount?: number, total: number, nombres?: string[] } | null;
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [cupoMaximo, setCupoMaximo] = useState(12);
  const [cuposDetallados, setCuposDetallados] = useState<Record<string, Record<string, number>> | null>(null);
  const [cuposEspecifcos, setCuposEspecifcos] = useState<Record<string, Record<string, number>> | null>(null);
  const [existingReservas, setExistingReservas] = useState<{ fecha: string, horario: string }[]>([]);
  const [feriadosList, setFeriadosList] = useState<string[]>(['2026-05-25', '2026-06-20']);

  // Generar días del mes actual (simplificado para el mockup)
  const today = new Date('2026-05-16T10:00:00'); // Usamos la fecha actual simulada
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        const localCupo = localStorage.getItem('config_cupo');
        const localFeriados = localStorage.getItem('config_feriados');
        const localDetallados = localStorage.getItem('config_cupos_detallados');
        const localEspecifcos = localStorage.getItem('config_cupos_especificos');
        
        if (localCupo) setCupoMaximo(Number(localCupo));
        if (localFeriados) setFeriadosList(localFeriados.split(',').map((s: string) => s.trim()));
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

        const { data } = await supabase.from('configuracion').select('*');
        if (data) {
          const cupoItem = data.find(item => item.clave === 'cupo_maximo');
          const feriadosItem = data.find(item => item.clave === 'feriados');
          const cuposDetalladosItem = data.find(item => item.clave === 'cupos_detallados');
          
          if (cupoItem) {
            setCupoMaximo(Number(cupoItem.valor));
            localStorage.setItem('config_cupo', cupoItem.valor);
          }
          if (feriadosItem) {
            const list = feriadosItem.valor.split(',').map((s: string) => s.trim());
            setFeriadosList(list);
            localStorage.setItem('config_feriados', feriadosItem.valor);
          }
          if (cuposDetalladosItem) {
            try {
              setCuposDetallados(JSON.parse(cuposDetalladosItem.valor));
              localStorage.setItem('config_cupos_detallados', cuposDetalladosItem.valor);
            } catch {}
          }
          
          const cuposEspecifcosItem = data.find(item => item.clave === 'cupos_especificos');
          if (cuposEspecifcosItem) {
            try {
              setCuposEspecifcos(JSON.parse(cuposEspecifcosItem.valor));
              localStorage.setItem('config_cupos_especificos', cuposEspecifcosItem.valor);
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Usando fallback local para configuración:", err);
      }
    };
    fetchConfig();
  }, []);

  React.useEffect(() => {
    const fetchExistingReservas = async () => {
      try {
        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;
        const { data, error } = await supabase
          .from('reservas')
          .select('fecha, horario')
          .gte('fecha', startDate)
          .lte('fecha', endDate);
        
        if (error) throw error;
        if (data) {
          setExistingReservas(data);
        }
      } catch (err) {
        console.error("Error cargando reservas existentes:", err);
      }
    };
    fetchExistingReservas();
  }, [currentMonth, currentYear]);

  // Calcular turnos permitidos basados en el pago (por defecto 1 si no hay state)
  const allowedShifts = paymentState 
    ? (paymentState.plan === 'hora' 
        ? (paymentState.durationCount || 1) * (paymentState.childrenCount || 1)
        : paymentState.plan === 'semana' 
          ? 5 * (paymentState.durationCount || 1) * (paymentState.childrenCount || 1)
          : 20 * (paymentState.durationCount || 1) * (paymentState.childrenCount || 1))
    : 100; // Si entran sin pago, sin límite o límite alto
  
  // Días del mes (1 al 31 para mayo 2026)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [showShiftModal, setShowShiftModal] = useState(false);

  const handleDayClick = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const dateString = getLocalDateStringFromDate(date);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    
    // No permitir domingos o feriados
    if (dayOfWeek === 0) {
      alert('La academia está cerrada los domingos.');
      return;
    }
    if (feriadosList.includes(dateString)) {
      alert('La academia está cerrada por feriado.');
      return;
    }

    setSelectedDate(date);
    setShowShiftModal(true);
  };

  const getSlotCapacity = (date: Date, shiftId: string): number => {
    const dateString = getLocalDateStringFromDate(date);
    
    // 1. Check specific date override first
    if (cuposEspecifcos && cuposEspecifcos[dateString] && cuposEspecifcos[dateString][shiftId] !== undefined) {
      return cuposEspecifcos[dateString][shiftId];
    }
    
    // 2. Fallback to weekly template
    const dayOfWeek = date.getDay();
    const dayName = DAYS_MAP[dayOfWeek];
    if (cuposDetallados && cuposDetallados[dayName] && cuposDetallados[dayName][shiftId] !== undefined) {
      return cuposDetallados[dayName][shiftId];
    }
    
    // 3. Fallback to general limit
    return cupoMaximo;
  };

  const handleAddShift = (shiftId: string, shiftLabel: string) => {
    if (!selectedDate) return;
    
    // Check global limit
    if (reservations.length >= allowedShifts) {
      alert(`Tu plan actual te permite agendar hasta ${allowedShifts} turno(s) en total.`);
      return;
    }

    // Check limit per shift (cannot exceed children count)
    const countInThisShift = reservations.filter(r => r.date.getTime() === selectedDate.getTime() && r.shiftId === shiftId).length;
    const maxPerShift = paymentState?.childrenCount || 1;
    
    if (countInThisShift >= maxPerShift) {
      alert(`No puedes reservar más de ${maxPerShift} cupo(s) para este mismo horario (corresponde a la cantidad de niños inscriptos).`);
      return;
    }

    // Verificar cupo dinámico por día/hora de la academia
    const capacity = getSlotCapacity(selectedDate, shiftId);
    const dateString = getLocalDateStringFromDate(selectedDate);
    const dbCount = existingReservas.filter(r => r.fecha === dateString && r.horario === shiftLabel).length;

    if (dbCount + countInThisShift >= capacity) {
      alert(`Lo sentimos, no hay más cupo disponible en la academia para este horario.`);
      return;
    }

    setReservations([...reservations, { date: selectedDate, shiftId, shiftLabel }]);
  };

  const handleRemoveShift = (shiftId: string) => {
    if (!selectedDate) return;
    const existingIndex = reservations.findIndex(r => r.date.getTime() === selectedDate.getTime() && r.shiftId === shiftId);
    
    if (existingIndex >= 0) {
      setReservations(reservations.filter((_, i) => i !== existingIndex));
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleReserve = async () => {
    if (reservations.length > 0) {
      setIsSaving(true);
      try {
        // Asignar nombres a los turnos para guardar en DB
        const sortedRes = [...reservations].sort((a,b) => a.date.getTime() - b.date.getTime());
        const shiftCounts: Record<string, number> = {};
        
        const reservasToInsert = sortedRes.map(r => {
          const key = `${r.date.getTime()}-${r.shiftId}`;
          const nameIndex = shiftCounts[key] || 0;
          shiftCounts[key] = nameIndex + 1;
          
          let assignedName = "Alumno";
          if (paymentState?.nombres && paymentState.nombres.length > 0) {
            assignedName = paymentState.nombres[Math.min(nameIndex, paymentState.nombres.length - 1)];
          }

          // Convertir la fecha a formato local YYYY-MM-DD correcto
          const fechaLocal = getLocalDateStringFromDate(r.date);

          return {
            alumno_nombre: assignedName,
            fecha: fechaLocal,
            horario: r.shiftLabel
          };
        });

        const { error } = await supabase.from('reservas').insert(reservasToInsert);
        
        if (error) {
          console.error('Error guardando reservas:', error);
          alert('Hubo un error guardando las reservas en la base de datos (asegúrate de haber creado la tabla "reservas").');
        }
        
        setIsConfirmed(true);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 95);
    doc.text("Comprobante de Reserva - Aprender", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Fecha de emisión: ${formatDateAR(new Date())}`, 14, 32);
    
    let tableStartY = 45;
    if (paymentState && paymentState.nombres && paymentState.nombres.length > 0) {
      doc.text(`Alumno/s: ${paymentState.nombres.join(', ')}`, 14, 40);
      doc.text("Detalle de turnos agendados:", 14, 50);
      tableStartY = 55;
    } else {
      doc.text("Detalle de turnos agendados:", 14, 45);
    }

    const sortedRes = [...reservations].sort((a,b) => a.date.getTime() - b.date.getTime());
    
    const tableData: any[] = [];
    const shiftCounts: Record<string, number> = {};

    sortedRes.forEach(r => {
      const key = `${r.date.getTime()}-${r.shiftId}`;
      const nameIndex = shiftCounts[key] || 0;
      shiftCounts[key] = nameIndex + 1;
      
      let assignedName = "";
      if (paymentState?.nombres && paymentState.nombres.length > 0) {
        assignedName = paymentState.nombres[Math.min(nameIndex, paymentState.nombres.length - 1)];
      }

      tableData.push([
        formatDateAR(r.date),
        r.shiftLabel,
        assignedName || "Alumno"
      ]);
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [['Fecha', 'Horario', 'Alumno']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] }
    });

    doc.save("Comprobante_Reserva_Aprender.pdf");
  };

  const hasReservation = (day: number) => {
    const d = new Date(currentYear, currentMonth, day).getTime();
    return reservations.some(r => r.date.getTime() === d);
  };

  const isCurrentViewed = (day: number) => {
    const d = new Date(currentYear, currentMonth, day).getTime();
    return selectedDate && selectedDate.getTime() === d;
  };

  const isFeriado = (day: number) => {
    const dateString = getLocalDateStringFromDate(new Date(currentYear, currentMonth, day));
    return feriadosList.includes(dateString);
  };

  const isDomingo = (day: number) => {
    return new Date(currentYear, currentMonth, day).getDay() === 0;
  };

  const isPastOrToday = (day: number) => {
    return day <= today.getDate();
  };

  // Turnos disponibles según el día seleccionado (por hora exacta)
  const availableShifts = () => {
    if (!selectedDate) return [];
    const dayOfWeek = selectedDate.getDay();
    
    const shifts = [
      { id: '09:00 hs', label: '09:00 a 10:00 hs', disabled: false },
      { id: '10:00 hs', label: '10:00 a 11:00 hs', disabled: false },
      { id: '11:00 hs', label: '11:00 a 12:00 hs', disabled: false }
    ];
    
    // Sábados solo tienen turno mañana (dayOfWeek === 6)
    if (dayOfWeek !== 6) {
      shifts.push(
        { id: '14:00 hs', label: '14:00 a 15:00 hs', disabled: false },
        { id: '15:00 hs', label: '15:00 a 16:00 hs', disabled: false },
        { id: '16:00 hs', label: '16:00 a 17:00 hs', disabled: false },
        { id: '17:00 hs', label: '17:00 a 18:00 hs', disabled: false }
      );
    }
    return shifts;
  };

  return (
    <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-background)' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Reserva de Turnos</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>Mayo 2026</p>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ background: '#EFF6FF', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', border: '1px solid #BFDBFE' }}>
          <Info size={20} color="#1D4ED8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3A8A', fontWeight: 'bold' }}>
              Tu plan: {paymentState ? (paymentState.plan === 'hora' ? 'Por Hora' : paymentState.plan === 'semana' ? 'Semanal' : 'Mensual') : 'Registrado'}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3A8A' }}>
              Puedes agendar hasta <b>{allowedShifts} turno(s)</b>. Llevas {reservations.length} agendados.
            </p>
          </div>
        </div>

        <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarIcon size={20} color="var(--color-secondary)" />
          1. Selecciona el día
        </h3>

        {/* Calendario Grid Simplificado */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '8px', 
          marginBottom: '2rem' 
        }}>
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>{d}</div>
          ))}
          
          {/* Espacios vacíos antes del 1 de mayo (Viernes = 5 espacios) */}
          {Array.from({ length: 5 }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {daysArray.map(day => {
            const disabled = isDomingo(day) || isFeriado(day) || isPastOrToday(day);
            const reserved = hasReservation(day);
            const viewed = isCurrentViewed(day);
            
            let bg = 'white';
            let color = 'var(--color-gray-800)';
            let border = '1px solid var(--color-gray-300)';
            
            if (disabled) {
              bg = 'var(--color-gray-100)';
              color = 'var(--color-gray-300)';
              border = '1px solid transparent';
            } else if (reserved) {
              bg = 'var(--color-secondary)';
              color = 'white';
              border = '1px solid var(--color-secondary)';
            } else if (viewed) {
              bg = '#E0F2FE';
              color = 'var(--color-primary)';
              border = '1px solid var(--color-primary)';
            }

            return (
              <div 
                key={day}
                onClick={() => !disabled && handleDayClick(day)}
                style={{ 
                  aspectRatio: '1', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  borderRadius: '8px',
                  background: bg,
                  border: border,
                  color: color,
                  fontWeight: reserved || viewed ? 'bold' : 'normal',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  position: 'relative'
                }}
              >
                {day}
                {isFeriado(day) && (
                  <div style={{ position: 'absolute', bottom: '2px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                )}
              </div>
            );
          })}
        </div>

        {!isConfirmed ? (
          <>
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <div style={{ marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>
                {reservations.length} turno(s) seleccionado(s)
              </div>
              <button 
                className="btn btn-primary btn-block" 
                disabled={reservations.length === 0 || isSaving}
                onClick={handleReserve}
              >
                {isSaving ? 'Guardando...' : 'Confirmar Reservas'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <CheckCircle2 size={40} color="#059669" />
            </div>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>¡Turnos Confirmados!</h2>
            <p style={{ color: 'var(--color-gray-500)', marginBottom: '2rem' }}>
              Has agendado exitosamente {reservations.length} turno(s).
            </p>
            
            <button 
              className="btn btn-secondary btn-block" 
              onClick={handleGeneratePDF}
              style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}
            >
              <Download size={20} />
              Descargar Comprobante PDF
            </button>

            <button 
              className="btn btn-outline btn-block" 
              onClick={() => navigate('/')}
            >
              Volver al inicio
            </button>
          </div>
        )}
      </div>

      {/* Modal de Selección de Turno */}
      {showShiftModal && selectedDate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', width: '100%', maxWidth: '400px',
            padding: '1.5rem', animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>Turnos - {selectedDate.getDate()} de Mayo</h3>
              <button onClick={() => setShowShiftModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} color="var(--color-gray-500)" />
              </button>
            </div>
            
            <div className="flex-col gap-3">
              {availableShifts().map(shift => {
                const countSelected = reservations.filter(r => r.date.getTime() === selectedDate.getTime() && r.shiftId === shift.id).length;
                const isSelected = countSelected > 0;
                
                const capacity = getSlotCapacity(selectedDate, shift.id);
                const dateString = getLocalDateStringFromDate(selectedDate);
                const dbCount = existingReservas.filter(r => r.fecha === dateString && r.horario === shift.label).length;
                const freeSlots = Math.max(0, capacity - dbCount - countSelected);
                const isFull = freeSlots === 0 && !isSelected;
                
                return (
                  <div 
                    key={shift.id}
                    onClick={() => {
                      if (countSelected === 0 && !isFull) handleAddShift(shift.id, shift.label);
                    }}
                    style={{ 
                      border: `2px solid ${isSelected ? 'var(--color-secondary)' : isFull ? 'var(--color-gray-200)' : 'var(--color-gray-300)'}`,
                      borderRadius: '12px', padding: '1rem', 
                      cursor: isFull ? 'not-allowed' : countSelected === 0 ? 'pointer' : 'default',
                      background: isSelected ? 'var(--color-background)' : isFull ? '#F8FAFC' : 'white',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      opacity: isFull ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold', color: isFull ? 'var(--color-gray-400)' : 'var(--color-primary)' }}>{shift.label}</p>
                      {isFull ? (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Sin cupos disponibles</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
                          Cupos libres en academia: <b>{freeSlots}</b> (de {capacity})
                        </p>
                      )}
                    </div>
                    
                    {isSelected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--color-gray-300)' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveShift(shift.id); }}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--color-gray-300)', background: 'white', color: 'var(--color-primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >-</button>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-secondary)', minWidth: '12px', textAlign: 'center' }}>{countSelected}</span>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (freeSlots > 0) {
                              handleAddShift(shift.id, shift.label);
                            } else {
                              alert("No hay más cupo disponible para este horario.");
                            }
                          }}
                          disabled={freeSlots <= 0}
                          style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '6px', 
                            border: 'none', 
                            background: freeSlots <= 0 ? 'var(--color-gray-300)' : 'var(--color-secondary)', 
                            color: 'white', 
                            fontWeight: 'bold', 
                            cursor: freeSlots <= 0 ? 'not-allowed' : 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}
                        >+</button>
                      </div>
                    ) : (
                      <CheckCircle2 size={24} color={isFull ? 'var(--color-gray-200)' : 'var(--color-gray-300)'} style={{ opacity: isFull ? 0.3 : 0.5 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AgendaPadres;
