import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, FileText, CheckCircle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '../lib/supabase';

type AsistenciaRecord = {
  nombre: string;
  grado: string;
  turno: string;
  maestra: string;
  estado: string;
};

const AgendaAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [asistencia, setAsistencia] = useState<AsistenciaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAsistencia();
  }, [selectedDate]);

  const fetchAsistencia = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch alumnos
      const { data: alumnosData, error: alumnosError } = await supabase
        .from('alumnos')
        .select('*')
        .order('nombre');

      if (alumnosError) throw alumnosError;

      // 2. Fetch assistance for selected date
      const { data: asistenciaData, error: asistenciaError } = await supabase
        .from('asistencia')
        .select('*')
        .eq('fecha', selectedDate);

      if (asistenciaError) throw asistenciaError;

      // 3. Map
      const mapped: AsistenciaRecord[] = alumnosData.map(a => {
        const asis = asistenciaData?.find(as => as.alumno_id === a.id);
        let estado = 'Ausente';
        if (asis) {
          estado = asis.hora_retiro ? 'Retirado' : 'Presente';
        }

        return {
          nombre: a.nombre,
          grado: a.grado || 'S/D',
          turno: 'Mañana', // Podríamos agregar turno a la tabla alumnos
          maestra: a.maestra_grado || 'S/D',
          estado
        };
      });

      setAsistencia(mapped);
    } catch (error) {
      console.error('Error fetching agenda:', error);
    } finally {
      setIsLoading(false);
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
    doc.text(`Informe de Asistencia - ${selectedDate}`, 14, 32);

    // Tabla
    const tableColumn = ["Nombre del Alumno", "Grado", "Turno", "Maestra", "Estado"];
    const tableRows = asistencia.map(record => [
      record.nombre,
      record.grado,
      record.turno,
      record.maestra,
      record.estado
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    // Guardar en dispositivo
    doc.save(`Asistencia_${selectedDate}.pdf`);
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
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)' }}>{alumno.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>{alumno.grado} | {alumno.maestra}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold',
                    background: alumno.estado === 'Presente' ? '#D1FAE5' : alumno.estado === 'Ausente' ? '#FEE2E2' : alumno.estado === 'Retirado' ? '#E5E7EB' : '#FEF3C7',
                    color: alumno.estado === 'Presente' ? '#065F46' : alumno.estado === 'Ausente' ? '#991B1B' : alumno.estado === 'Retirado' ? '#374151' : '#92400E',
                  }}>
                    {alumno.estado}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AgendaAdmin;
