import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar as CalendarIcon, Clock, AlertCircle } from 'lucide-react';

// Feriados simulados (formato YYYY-MM-DD)
const FERIADOS = ['2026-05-25', '2026-06-20'];

const AgendaPadres: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);

  // Generar días del mes actual (simplificado para el mockup)
  const today = new Date('2026-05-16T10:00:00'); // Usamos la fecha actual simulada
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Días del mes (1 al 31 para mayo 2026)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDayClick = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    
    // No permitir domingos o feriados
    if (dayOfWeek === 0) {
      alert('La academia está cerrada los domingos.');
      return;
    }
    if (FERIADOS.includes(dateString)) {
      alert('La academia está cerrada por feriado.');
      return;
    }

    setSelectedDate(date);
    setSelectedShift(null); // Reset shift al cambiar de día
  };

  const handleReserve = () => {
    if (selectedDate && selectedShift) {
      alert(`¡Turno reservado con éxito para el ${selectedDate.toLocaleDateString()} a las ${selectedShift}!`);
      navigate('/');
    }
  };

  const isDaySelected = (day: number) => {
    return selectedDate && selectedDate.getDate() === day;
  };

  const isFeriado = (day: number) => {
    const dateString = new Date(currentYear, currentMonth, day).toISOString().split('T')[0];
    return FERIADOS.includes(dateString);
  };

  const isDomingo = (day: number) => {
    return new Date(currentYear, currentMonth, day).getDay() === 0;
  };

  const isPastOrToday = (day: number) => {
    // Si estamos en un mes futuro, no bloquea días por ser "pasados" respecto al día actual del mes,
    // pero para este mockup donde solo vemos el mes actual:
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
        { id: '16:00 hs', label: '16:00 a 17:00 hs', disabled: false }
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
        
        <div style={{ background: '#FFFBEB', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', border: '1px solid #FDE68A' }}>
          <AlertCircle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400E' }}>
            Recuerda que para reservar debes tener un plan activo y pago confirmado.
          </p>
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
            const selected = isDaySelected(day);
            return (
              <div 
                key={day}
                onClick={() => handleDayClick(day)}
                style={{ 
                  aspectRatio: '1', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  borderRadius: '8px',
                  background: selected ? 'var(--color-secondary)' : disabled ? 'var(--color-gray-100)' : 'white',
                  border: `1px solid ${selected ? 'var(--color-secondary)' : disabled ? 'transparent' : 'var(--color-gray-300)'}`,
                  color: selected ? 'white' : disabled ? 'var(--color-gray-300)' : 'var(--color-gray-800)',
                  fontWeight: selected ? 'bold' : 'normal',
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

        {selectedDate && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--color-secondary)" />
              2. Horarios disponibles
            </h3>
            
            <div className="flex-col gap-4">
              {availableShifts().map(shift => (
                <div 
                  key={shift.id}
                  onClick={() => setSelectedShift(shift.id as 'manana' | 'tarde')}
                  style={{ 
                    border: `2px solid ${selectedShift === shift.id ? 'var(--color-secondary)' : 'var(--color-gray-300)'}`,
                    borderRadius: '12px', padding: '1rem', cursor: 'pointer',
                    background: selectedShift === shift.id ? 'var(--color-background)' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)' }}>{shift.label}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Cupos disponibles: 12</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <button 
            className="btn btn-primary btn-block" 
            disabled={!selectedDate || !selectedShift}
            onClick={handleReserve}
          >
            Confirmar Reserva
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgendaPadres;
