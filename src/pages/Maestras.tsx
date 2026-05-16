import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, DollarSign, Clock, Users2, Save, Trash2, Loader2, X, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Maestra = {
  id: string;
  nombre: string;
  especialidad: string;
  valorHora: number;
  horasMes: number;
};

const Maestras: React.FC = () => {
  const navigate = useNavigate();
  const [maestras, setMaestras] = useState<Maestra[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [selectedMaestra, setSelectedMaestra] = useState<Maestra | null>(null);
  
  const [newMaestra, setNewMaestra] = useState({ nombre: '', especialidad: '', valorHora: 5000 });
  const [newHoras, setNewHoras] = useState({ horas: 1, observaciones: '' });

  useEffect(() => {
    fetchMaestras();
  }, []);

  const fetchMaestras = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch maestras
      const { data: maestrasData, error: maestrasError } = await supabase
        .from('maestras')
        .select('*')
        .order('nombre');

      if (maestrasError) throw maestrasError;

      // 2. Fetch jornales to sum hours for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startIso = startOfMonth.toISOString().split('T')[0];

      const { data: jornalesData, error: jornalesError } = await supabase
        .from('jornales')
        .select('*')
        .gte('fecha', startIso);

      if (jornalesError) throw jornalesError;

      const mapped: Maestra[] = (maestrasData || []).map(m => {
        const horas = (jornalesData || [])
          .filter(j => j.maestra_id === m.id)
          .reduce((acc, curr) => acc + Number(curr.horas), 0);

        return {
          id: m.id,
          nombre: m.nombre,
          especialidad: m.especialidad || '',
          valorHora: m.valor_hora,
          horasMes: horas
        };
      });

      setMaestras(mapped);
    } catch (error) {
      console.error('Error fetching maestras:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMaestra = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('maestras')
        .insert([{
          nombre: newMaestra.nombre,
          especialidad: newMaestra.especialidad,
          valor_hora: newMaestra.valorHora
        }]);

      if (error) throw error;
      setIsAddModalOpen(false);
      setNewMaestra({ nombre: '', especialidad: '', valorHora: 5000 });
      fetchMaestras();
    } catch (error: any) {
      alert('Error al agregar maestra: ' + error.message);
    }
  };

  const handleAddHoras = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaestra) return;

    try {
      const { error } = await supabase
        .from('jornales')
        .insert([{
          maestra_id: selectedMaestra.id,
          horas: newHoras.horas,
          observaciones: newHoras.observaciones,
          fecha: new Date().toISOString().split('T')[0]
        }]);

      if (error) throw error;
      setIsHoursModalOpen(false);
      setNewHoras({ horas: 1, observaciones: '' });
      fetchMaestras();
    } catch (error: any) {
      alert('Error al registrar horas: ' + error.message);
    }
  };

  const handleEditRate = (id: string, currentRate: number) => {
    setEditingId(id);
    setEditValue(currentRate);
  };

  const saveRate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('maestras')
        .update({ valor_hora: editValue })
        .eq('id', id);

      if (error) throw error;
      setMaestras(prev => prev.map(m => 
        m.id === id ? { ...m, valorHora: editValue } : m
      ));
      setEditingId(null);
    } catch (error: any) {
      alert('Error al actualizar valor hora: ' + error.message);
    }
  };

  const handleDeleteMaestra = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar a esta maestra? Se borrarán también sus registros de jornales.')) return;
    try {
      const { error } = await supabase
        .from('maestras')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMaestras(prev => prev.filter(m => m.id !== id));
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const calculateJornal = (horas: number, valor: number) => horas * valor;

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
        <h2 style={{ color: 'white', marginTop: '0.5rem' }}>Gestión de Maestras</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-tertiary)' }}>Jornales y Valor Hora</p>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', margin: 0 }}>Nómina Actual</h3>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{ 
              background: 'var(--color-secondary)', color: 'white', border: 'none', 
              borderRadius: '50%', width: '36px', height: '36px', display: 'flex', 
              alignItems: 'center', justifySelf: 'center', cursor: 'pointer' 
            }}
          >
            <Plus size={20} style={{ margin: '0 auto' }} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--color-gray-400)' }}>
            <Loader2 size={40} className="animate-spin" />
            <p>Cargando nómina...</p>
          </div>
        ) : maestras.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-400)', background: '#F9FAFB', borderRadius: '24px' }}>
            <Users2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No hay maestras registradas.</p>
          </div>
        ) : (
          <div className="flex-col gap-4">
            {maestras.map(maestra => (
              <div key={maestra.id} style={{ 
                border: '1px solid var(--color-gray-300)', borderRadius: '16px', padding: '1.2rem',
                background: 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>{maestra.nombre}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>{maestra.especialidad}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => { setSelectedMaestra(maestra); setIsHoursModalOpen(true); }}
                      style={{ background: 'var(--color-tertiary)', color: 'var(--color-primary)', border: 'none', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer' }}
                    >
                      <Clock size={18} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-gray-100)', padding: '0.75rem', borderRadius: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Valor Hora</p>
                    {editingId === maestra.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <input 
                          type="number" 
                          value={editValue} 
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          style={{ width: '70px', border: '1px solid var(--color-secondary)', borderRadius: '4px', padding: '2px' }}
                          autoFocus
                        />
                        <button onClick={() => saveRate(maestra.id)} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer' }}>
                          <Save size={18} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>${maestra.valorHora.toLocaleString()}</span>
                        <button onClick={() => handleEditRate(maestra.id, maestra.valorHora)} style={{ background: 'none', border: 'none', color: 'var(--color-gray-400)', cursor: 'pointer' }}>
                          <DollarSign size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'var(--color-gray-100)', padding: '0.75rem', borderRadius: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Horas Mes</p>
                    <p style={{ margin: '0.25rem 0 0', fontWeight: 'bold', color: 'var(--color-primary)' }}>{maestra.horasMes} hs</p>
                  </div>
                </div>

                <div style={{ 
                  borderTop: '1px dashed var(--color-gray-300)', paddingTop: '1rem', 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>Jornal Acumulado</p>
                    <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-secondary)' }}>
                      ${calculateJornal(maestra.horasMes, maestra.valorHora).toLocaleString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDeleteMaestra(maestra.id)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', opacity: 0.5, cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-gray-200)', background: '#F9FAFB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-gray-500)' }}>Total a Liquidar:</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
            ${maestras.reduce((acc, m) => acc + calculateJornal(m.horasMes, m.valorHora), 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Modal para Agregar Maestra */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', width: '90%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setIsAddModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--color-gray-400)' }}>
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 1.5rem', color: 'var(--color-primary)' }}>Nueva Maestra</h3>
            <form onSubmit={handleAddMaestra} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Nombre Completo</label>
                <input type="text" className="input-field" value={newMaestra.nombre} onChange={e => setNewMaestra({...newMaestra, nombre: e.target.value})} required />
              </div>
              <div className="input-group">
                <label className="input-label">Especialidad</label>
                <input type="text" className="input-field" value={newMaestra.especialidad} onChange={e => setNewMaestra({...newMaestra, especialidad: e.target.value})} placeholder="Ej: Apoyo Escolar" />
              </div>
              <div className="input-group">
                <label className="input-label">Valor Hora ($)</label>
                <input type="number" className="input-field" value={newMaestra.valorHora} onChange={e => setNewMaestra({...newMaestra, valorHora: Number(e.target.value)})} required />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '1rem', marginTop: '0.5rem' }}>Guardar Maestra</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Cargar Horas */}
      {isHoursModalOpen && selectedMaestra && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', width: '90%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setIsHoursModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--color-gray-400)' }}>
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-primary)' }}>Cargar Horas</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>{selectedMaestra.nombre}</p>
            <form onSubmit={handleAddHoras} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Cantidad de Horas</label>
                <input type="number" step="0.5" className="input-field" value={newHoras.horas} onChange={e => setNewHoras({...newHoras, horas: Number(e.target.value)})} required min="0.5" />
              </div>
              <div className="input-group">
                <label className="input-label">Observaciones / Tarea</label>
                <textarea className="input-field" rows={3} value={newHoras.observaciones} onChange={e => setNewHoras({...newHoras, observaciones: e.target.value})} placeholder="Ej: Apoyo en matemáticas 3ro..." />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '1rem', marginTop: '0.5rem' }}>Registrar Horas</button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Maestras;
