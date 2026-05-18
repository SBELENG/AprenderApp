import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, Save, CalendarOff, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ConfiguracionAdmin: React.FC = () => {
  const navigate = useNavigate();
  
  const [cupo, setCupo] = useState('12');
  const [feriados, setFeriados] = useState('2026-05-25, 2026-06-20');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Cargar fallback de localStorage primero
        const localCupo = localStorage.getItem('config_cupo');
        const localFeriados = localStorage.getItem('config_feriados');
        if (localCupo) setCupo(localCupo);
        if (localFeriados) setFeriados(localFeriados);

        // Intentar cargar desde Supabase
        const { data, error } = await supabase.from('configuracion').select('*');
        if (error) throw error;
        
        if (data) {
          const cupoItem = data.find(item => item.clave === 'cupo_maximo');
          const feriadosItem = data.find(item => item.clave === 'feriados');
          if (cupoItem) {
            setCupo(cupoItem.valor);
            localStorage.setItem('config_cupo', cupoItem.valor);
          }
          if (feriadosItem) {
            setFeriados(feriadosItem.valor);
            localStorage.setItem('config_feriados', feriadosItem.valor);
          }
        }
      } catch (err) {
        console.warn("Usando fallback de configuración local:", err);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    // Guardar en localStorage como fallback inmediato
    localStorage.setItem('config_cupo', cupo);
    localStorage.setItem('config_feriados', feriados);

    try {
      // Intentar guardar en Supabase
      const { error } = await supabase.from('configuracion').upsert([
        { clave: 'cupo_maximo', valor: cupo },
        { clave: 'feriados', valor: feriados }
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
    <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
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
        
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
            <Users size={20} />
            Cupo por Turno
          </h3>
          <div className="input-group">
            <label className="input-label">Cantidad máxima de alumnos por horario</label>
            <input 
              type="number" 
              className="input-field" 
              value={cupo}
              onChange={(e) => setCupo(e.target.value)}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '4px' }}>
              Define cuántos niños pueden agendarse en un mismo horario.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
            <CalendarOff size={20} />
            Días Feriados / Cerrados
          </h3>
          <div className="input-group">
            <label className="input-label">Fechas (formato AAAA-MM-DD separadas por coma)</label>
            <textarea 
              className="input-field" 
              rows={3}
              value={feriados}
              onChange={(e) => setFeriados(e.target.value)}
            ></textarea>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '4px' }}>
              Ejemplo: 2026-05-25, 2026-06-20. Estos días no podrán ser seleccionados por los padres.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <button 
            className="btn btn-secondary btn-block" 
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
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
