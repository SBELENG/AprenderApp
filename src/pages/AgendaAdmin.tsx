import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

type AsistenciaRecord = {
  nombre: string;
  grado: string;
  turno: string;
  maestra: string;
  estado: string;
  salud: string;
  desempeno: string;
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

  useEffect(() => {
    fetchAsistencia();
  }, [selectedDate]);

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

      // 2. Fetch alumnos para cruzar datos (grado, maestra fija si la hay)
      const { data: alumnosData } = await supabase.from('alumnos').select('nombre, grado, maestra_grado, id, salud_info, desempeno');
      
      // 3. Fetch asistencia real para ver si ya llegaron
      const { data: asistenciaData } = await supabase
        .from('asistencia')
        .select('*')
        .eq('fecha', selectedDate);

      // 4. Mapear
      const mapped: AsistenciaRecord[] = (reservasData || []).map(r => {
        // Buscar el alumno por nombre (ya que la reserva guarda el nombre por el array)
        const alumnoInfo = alumnosData?.find(a => a.nombre === r.alumno_nombre);
        
        // Buscar si ya marcó ingreso/retiro
        let estado = 'Pendiente';
        if (alumnoInfo && asistenciaData) {
          const asis = asistenciaData.find(as => as.alumno_id === alumnoInfo.id);
          if (asis) {
            estado = asis.hora_retiro ? 'Retirado' : 'Presente';
          }
        }

        return {
          nombre: r.alumno_nombre,
          grado: alumnoInfo?.grado || 'S/D',
          turno: r.horario, // AHORA MOSTRAMOS EL HORARIO REAL DE LA RESERVA
          maestra: alumnoInfo?.maestra_grado || 'S/D',
          estado,
          salud: alumnoInfo?.salud_info || '-',
          desempeno: alumnoInfo?.desempeno || '-'
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
    doc.text(`Informe de Asistencia - ${formatDateStringAR(selectedDate)}`, 14, 32);

    // Tabla
    const tableColumn = ["Alumno", "Horario", "Grado", "Maestra", "Salud", "Dificultad"];
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
                  <span style={{ 
                    display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold',
                    background: alumno.estado === 'Presente' ? '#D1FAE5' : alumno.estado === 'Pendiente' ? '#FEE2E2' : alumno.estado === 'Retirado' ? '#E5E7EB' : '#FEF3C7',
                    color: alumno.estado === 'Presente' ? '#065F46' : alumno.estado === 'Pendiente' ? '#991B1B' : alumno.estado === 'Retirado' ? '#374151' : '#92400E',
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
