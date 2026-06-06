import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Download, Info, X } from 'lucide-react';
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

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type Reservation = { date: Date, shiftId: string, shiftLabel: string };

const DAYS_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const AgendaPadres: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Recuperar sesión para evitar perderla al recargar
  const [sessionState] = useState<{ plan: string, childrenCount: number, durationCount?: number, total: number, nombres?: string[], telefono?: string } | null>(() => {
    if (location.state) {
      localStorage.setItem('parent_session', JSON.stringify(location.state));
      return location.state as any;
    }
    const saved = localStorage.getItem('parent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [cupoMaximo, setCupoMaximo] = useState(4);
  const [cuposDetallados, setCuposDetallados] = useState<Record<string, Record<string, number>> | null>(null);
  const [cuposEspecifcos, setCuposEspecifcos] = useState<Record<string, Record<string, number>> | null>(null);
  const [existingReservas, setExistingReservas] = useState<{ fecha: string, horario: string }[]>([]);
  const [existingUserReservas, setExistingUserReservas] = useState<{ id?: string, fecha: string, horario: string, alumno_nombre: string }[]>([]);
  const [feriadosList, setFeriadosList] = useState<string[]>(['2026-05-25', '2026-06-20']);

  // Estados para el correo de notificaciones
  const [familyEmail, setFamilyEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Turnos totales pagados según transacciones en DB
  const [dbAllowedShifts, setDbAllowedShifts] = useState<number | null>(null);


  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

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
    const fetchFamilyEmail = async () => {
      if (!sessionState?.telefono) return;
      try {
        const { data, error } = await supabase
          .from('familias')
          .select('email')
          .eq('telefono', sessionState.telefono)
          .single();
          
        if (error) throw error;
        if (data) {
          setFamilyEmail(data.email || '');
          setEmailInput(data.email || '');
        }
      } catch (err) {
        console.error("Error cargando correo de familia:", err);
      }
    };
    fetchFamilyEmail();
  }, [sessionState?.telefono]);

  React.useEffect(() => {
    const fetchExistingReservas = async () => {
      try {
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        
        // 1. Obtener todas las reservas de la academia para control de cupos
        const { data, error } = await supabase
          .from('reservas')
          .select('fecha, horario')
          .gte('fecha', startDate)
          .lte('fecha', endDate);
        
        if (error) throw error;
        if (data) {
          setExistingReservas(data);
        }

        // 2. Obtener las reservas específicas de esta familia para el mes
        if (sessionState?.nombres && sessionState.nombres.length > 0) {
          const { data: userRes, error: userResError } = await supabase
            .from('reservas')
            .select('*')
            .in('alumno_nombre', sessionState.nombres)
            .gte('fecha', startDate)
            .lte('fecha', endDate);
            
          if (userResError) throw userResError;
          if (userRes) {
            setExistingUserReservas(userRes);
          }
        }
      } catch (err) {
        console.error("Error cargando reservas existentes:", err);
      }
    };
    fetchExistingReservas();
  }, [currentMonth, currentYear, sessionState?.nombres]);

  // Calcular turnos pagados desde la DB de transacciones
  React.useEffect(() => {
    const fetchPaidShifts = async () => {
      if (!sessionState?.nombres || sessionState.nombres.length === 0) return;
      try {
        // Obtener transacciones de los alumnos de esta familia
        const { data: alumnosData } = await supabase
          .from('alumnos')
          .select('id, nombre')
          .in('nombre', sessionState.nombres);

        if (!alumnosData || alumnosData.length === 0) return;

        const alumnoIds = alumnosData.map(a => a.id);
        const { data: transData } = await supabase
          .from('transacciones')
          .select('monto, metodo')
          .in('alumno_id', alumnoIds);

        if (!transData || transData.length === 0) return;

        // Calcular turnos totales en base a los montos pagados
        // Plan hora = $7000, semana = $35000 (5 turnos), mes = $130000 (20 turnos)
        let totalShifts = 0;
        transData.forEach(t => {
          const monto = Number(t.monto) || 0;
          if (monto <= 0) return;
          // Detectar tipo de plan por monto aproximado
          if (monto % 130000 === 0 || (monto >= 117000 && monto % (130000 * 0.9) < 1000)) {
            totalShifts += 20 * Math.round(monto / 117000);
          } else if (monto % 35000 === 0 || (monto >= 31500 && monto % (35000 * 0.9) < 500)) {
            totalShifts += 5 * Math.round(monto / 31500);
          } else {
            // Plan hora: $7000 por hora (o $6300 con descuento)
            totalShifts += Math.max(1, Math.round(monto / 7000));
          }
        });

        if (totalShifts > 0) {
          setDbAllowedShifts(totalShifts);
        }
      } catch (err) {
        console.warn('No se pudo calcular turnos desde DB:', err);
      }
    };
    fetchPaidShifts();
  }, [sessionState?.nombres]);

  // Calcular turnos permitidos: primero desde DB (más confiable), luego desde sesión
  const sessionAllowedShifts = sessionState 
    ? (sessionState.plan === 'hora' 
        ? (sessionState.durationCount || 1) * (sessionState.childrenCount || 1)
        : sessionState.plan === 'semana' 
          ? 5 * (sessionState.durationCount || 1) * (sessionState.childrenCount || 1)
          : 20 * (sessionState.durationCount || 1) * (sessionState.childrenCount || 1))
    : 100;
  // Usar DB si disponible; sino usar sesión; sino 100 (admin fallback)
  const allowedShifts = dbAllowedShifts ?? sessionAllowedShifts;

  const alreadyBookedCount = existingUserReservas.length;
  const remainingShifts = Math.max(0, allowedShifts - alreadyBookedCount);

  const handleSaveEmail = async () => {
    if (!sessionState?.telefono) return;
    if (!emailInput.trim() || !emailInput.includes('@')) {
      alert("Por favor ingresa un correo electrónico válido.");
      return;
    }
    setIsSavingEmail(true);
    try {
      const { error } = await supabase
        .from('familias')
        .update({ email: emailInput.trim() })
        .eq('telefono', sessionState.telefono);
        
      if (error) throw error;
      setFamilyEmail(emailInput.trim());
      setIsEditingEmail(false);
      alert("Correo de notificaciones guardado correctamente.");
    } catch (err: any) {
      console.error("Error guardando correo:", err);
      alert("Error al guardar el correo: " + err.message);
    } finally {
      setIsSavingEmail(false);
    }
  };
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

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

    // Si ya no quedan turnos disponibles en el plan, redirigir a comprar más
    if (remainingShifts <= 0) {
      navigate('/contratar', { state: { telefono: sessionState?.telefono } });
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
    if (reservations.length >= remainingShifts) {
      alert(`Tu plan actual te permite agendar hasta ${allowedShifts} turno(s) en total, y ya tienes ${alreadyBookedCount} reservado(s). Te quedan ${remainingShifts} por agendar.`);
      return;
    }

    // Check limit per shift (cannot exceed children count)
    const countInThisShift = reservations.filter(r => r.date.getTime() === selectedDate.getTime() && r.shiftId === shiftId).length;
    const maxPerShift = sessionState?.childrenCount || 1;
    
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
          if (sessionState?.nombres && sessionState.nombres.length > 0) {
            assignedName = sessionState.nombres[Math.min(nameIndex, sessionState.nombres.length - 1)];
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
    if (sessionState && sessionState.nombres && sessionState.nombres.length > 0) {
      doc.text(`Alumno/s: ${sessionState.nombres.join(', ')}`, 14, 40);
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
      if (sessionState?.nombres && sessionState.nombres.length > 0) {
        assignedName = sessionState.nombres[Math.min(nameIndex, sessionState.nombres.length - 1)];
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

  const hasUserReservation = (day: number) => {
    const dateString = getLocalDateStringFromDate(new Date(currentYear, currentMonth, day));
    return existingUserReservas.some(r => r.fecha === dateString);
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
    const d = new Date(currentYear, currentMonth, day);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d.getTime() <= t.getTime();
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <button 
            onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-primary)', minWidth: '120px', textAlign: 'center' }}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </p>
          <button 
            onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Banner de plan: muestra info o CTA para comprar más */}
        {remainingShifts > 0 ? (
          <div style={{ background: '#EFF6FF', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', border: '1px solid #BFDBFE' }}>
            <Info size={20} color="#1D4ED8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3A8A', fontWeight: 'bold' }}>
                Tu plan: {sessionState ? (sessionState.plan === 'hora' ? 'Por Hora' : sessionState.plan === 'semana' ? 'Semanal' : 'Mensual') : 'Registrado'}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3A8A' }}>
                Puedes agendar hasta <b>{allowedShifts} turno(s)</b>. Tienes <b>{alreadyBookedCount} reservado(s)</b> en este mes.
                {` Te quedan ${remainingShifts} por agendar.`}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ background: '#FFF7ED', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.5rem', border: '2px solid #FD8A00', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#92400E', fontWeight: 'bold' }}>
                  ¡Usaste todos los turnos de tu plan!
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350F', marginTop: '4px' }}>
                  Tienes <b>{alreadyBookedCount} turno(s)</b> reservados de los <b>{allowedShifts}</b> que contrataste.
                  Para seguir agendando, comprá más horas.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/contratar', { state: { telefono: sessionState?.telefono } })}
              style={{
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                color: 'white',
                border: 'none',
                padding: '0.85rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(234,88,12,0.3)'
              }}
            >
              🛒 Comprar más horas
            </button>
          </div>
        )}

        {/* Notificaciones de correo */}
        <div style={{ 
          background: '#F0FDF4', 
          padding: '1rem', 
          borderRadius: '12px', 
          marginBottom: '1.5rem', 
          border: '1px solid #BBF7D0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>📧</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', fontWeight: 'bold' }}>
                Notificaciones de Ingreso/Retiro por Correo
              </p>
              {isEditingEmail ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input 
                    type="email" 
                    value={emailInput} 
                    onChange={(e) => setEmailInput(e.target.value)} 
                    placeholder="ejemplo@correo.com"
                    style={{ 
                      flex: 1, 
                      padding: '0.4rem 0.6rem', 
                      borderRadius: '8px', 
                      border: '1px solid #A7F3D0',
                      fontSize: '0.85rem' 
                    }}
                  />
                  <button 
                    onClick={handleSaveEmail} 
                    disabled={isSavingEmail}
                    style={{ 
                      background: '#166534', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer' 
                    }}
                  >
                    {isSavingEmail ? '...' : 'Guardar'}
                  </button>
                  <button 
                    onClick={() => { setIsEditingEmail(false); setEmailInput(familyEmail); }}
                    style={{ 
                      background: 'none', 
                      border: '1px solid #166534', 
                      color: '#166534', 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem',
                      cursor: 'pointer' 
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', marginTop: '2px' }}>
                  {familyEmail ? (
                    <>
                      Recibirás avisos en: <strong>{familyEmail}</strong>{' '}
                      <button 
                        onClick={() => setIsEditingEmail(true)} 
                        style={{ background: 'none', border: 'none', color: '#15803d', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontWeight: 'bold', marginLeft: '6px' }}
                      >
                        (Editar)
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#991B1B', fontWeight: 'bold' }}>⚠️ No has registrado un correo para recibir avisos.</span>{' '}
                      <button 
                        onClick={() => setIsEditingEmail(true)} 
                        style={{ background: 'none', border: 'none', color: '#166534', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        (Registrar correo aquí)
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
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
          
          {/* Espacios vacíos antes del 1 del mes */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {daysArray.map(day => {
            const disabled = isDomingo(day) || isFeriado(day) || isPastOrToday(day);
            const reserved = hasReservation(day);
            const userReserved = hasUserReservation(day);
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
            } else if (userReserved) {
              bg = '#D1FAE5'; // Soft green for already confirmed reservations
              color = '#065F46';
              border = '1px solid #10B981';
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
              <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>Turnos - {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}</h3>
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

                // Verificar si ya tiene reservas confirmadas en la DB para este día/horario
                const userAlreadyBooked = existingUserReservas.filter(r => r.fecha === dateString && r.horario === shift.label);
                const isUserAlreadyBooked = userAlreadyBooked.length > 0;

                const freeSlots = Math.max(0, capacity - dbCount - countSelected);
                const isFull = freeSlots === 0 && !isSelected;
                
                if (isUserAlreadyBooked) {
                  return (
                    <div 
                      key={shift.id}
                      style={{ 
                        border: '2px solid #86EFAC',
                        borderRadius: '12px', padding: '1rem', 
                        background: '#F0FDF4',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#166534' }}>{shift.label}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#15803d', fontWeight: 'bold' }}>
                          ✓ Reservado para {userAlreadyBooked.map(u => u.alumno_nombre).join(', ')}
                        </p>
                      </div>
                      <CheckCircle2 size={24} color="#10B981" />
                    </div>
                  );
                }

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
