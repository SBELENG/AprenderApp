import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, CreditCard, Banknote, BarChart, Loader2, Plus, X, ArrowDownCircle, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

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

type Transaccion = {
  id: string;
  fecha: string;
  alumno: string;
  monto: number;
  metodo: 'Efectivo' | 'Mercado Pago' | 'Retiro de Caja';
  codigo_efectivo?: string;
  descripcion?: string;
};

type Alumno = {
  id: string;
  nombre: string;
};

const Contabilidad: React.FC = () => {
  const navigate = useNavigate();
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generadorCodigo, setGeneradorCodigo] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState<'Todos' | 'Efectivo' | 'Mercado Pago' | 'Retiro de Caja'>('Todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // State for new payment modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPago, setNewPago] = useState({
    alumno_id: '',
    monto: 7000,
    metodo: 'Efectivo' as 'Efectivo' | 'Mercado Pago'
  });

  // State for retiro de caja modal
  const [isRetiroModalOpen, setIsRetiroModalOpen] = useState(false);
  const [newRetiro, setNewRetiro] = useState({
    monto: 0,
    descripcion: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch payments joined with alumnos
      const { data: pagosData, error: pagosError } = await supabase
        .from('transacciones')
        .select(`
          *,
          alumnos (nombre)
        `)
        .order('fecha', { ascending: false });

      if (pagosError) throw pagosError;

      const mapped: Transaccion[] = (pagosData || []).map(p => ({
        id: p.id,
        fecha: p.fecha,
        alumno: p.metodo === 'Retiro de Caja'
          ? (p.descripcion || 'Retiro de Caja')
          : (p.alumnos?.nombre ? p.alumnos.nombre : (p.alumno_id ? 'Alumno eliminado' : 'Inscripción Pendiente')),
        monto: p.monto,
        metodo: p.metodo,
        codigo_efectivo: p.codigo_efectivo,
        descripcion: p.descripcion
      }));

      setTransacciones(mapped);

      // Fetch alumnos for the selection dropdown
      const { data: alumnosData, error: alumnosError } = await supabase
        .from('alumnos')
        .select('id, nombre')
        .order('nombre');

      if (alumnosError) throw alumnosError;
      setAlumnos(alumnosData || []);

    } catch (error) {
      console.error('Error fetching accounting data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneradorCodigo(code);
  };

  const handleAddPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPago.alumno_id) {
      alert('Selecciona un alumno o marca como nuevo ingreso');
      return;
    }

    try {
      const { error } = await supabase
        .from('transacciones')
        .insert([{
          alumno_id: newPago.alumno_id === 'nuevo' ? null : newPago.alumno_id,
          monto: newPago.monto,
          metodo: newPago.metodo,
          fecha: getLocalDateString(),
          codigo_efectivo: newPago.metodo === 'Efectivo' ? generadorCodigo : null
        }]);

      if (error) throw error;

      setIsModalOpen(false);
      setGeneradorCodigo('');
      fetchData(); // Refresh list
    } catch (error: any) {
      alert('Error al registrar pago: ' + error.message);
    }
  };

  const handleAddRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRetiro.monto || newRetiro.monto <= 0) {
      alert('Ingresá un monto válido');
      return;
    }
    try {
      const { error } = await supabase
        .from('transacciones')
        .insert([{
          alumno_id: null,
          monto: newRetiro.monto,
          metodo: 'Retiro de Caja',
          fecha: getLocalDateString(),
          descripcion: newRetiro.descripcion || 'Retiro de Caja'
        }]);
      if (error) throw error;
      setIsRetiroModalOpen(false);
      setNewRetiro({ monto: 0, descripcion: '' });
      fetchData();
    } catch (error: any) {
      alert('Error al registrar retiro: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('transacciones').delete().eq('id', id);
      if (error) throw error;
      setTransacciones(prev => prev.filter(t => t.id !== id));
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredData = transacciones.filter(t =>
    filtroMetodo === 'Todos' || t.metodo === filtroMetodo
  );

  const totalMP = transacciones.filter(t => t.metodo === 'Mercado Pago').reduce((acc, t) => acc + t.monto, 0);
  const ingresosEfectivo = transacciones.filter(t => t.metodo === 'Efectivo').reduce((acc, t) => acc + t.monto, 0);
  const totalRetiros = transacciones.filter(t => t.metodo === 'Retiro de Caja').reduce((acc, t) => acc + t.monto, 0);
  const saldoEfectivo = ingresosEfectivo - totalRetiros;

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(transacciones);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transacciones");
    
    // Generar buffer XLSX manualmente y forzar descarga
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Contabilidad_Academia_Aprender.xlsx`;
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
        <h2 style={{ color: 'white', marginTop: '0.5rem' }}>Contabilidad</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-tertiary)' }}>Ingresos y Gestión de Pagos</p>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Resumen Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ background: '#E0F2FE', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369A1' }}>
              <CreditCard size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>MP</span>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0369A1' }}>
              ${isLoading ? '...' : totalMP.toLocaleString()}
            </span>
          </div>
          <div style={{ background: '#DCFCE7', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803D' }}>
              <Banknote size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>CAJA</span>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: saldoEfectivo < 0 ? '#DC2626' : '#15803D' }}>
              ${isLoading ? '...' : saldoEfectivo.toLocaleString()}
            </span>
            {totalRetiros > 0 && !isLoading && (
              <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                Ing. ${ingresosEfectivo.toLocaleString()} — Ret. ${totalRetiros.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.9rem' }}
          >
            <Plus size={18} />
            Registrar Pago
          </button>
          <button
            onClick={() => setIsRetiroModalOpen(true)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.9rem', borderRadius: '12px', border: '2px solid #DC2626',
              background: 'white', color: '#DC2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem'
            }}
          >
            <ArrowDownCircle size={18} />
            Retiro de Caja
          </button>
        </div>

        {/* Listado con Filtros */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>Transacciones</h4>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={filtroMetodo}
                onChange={(e) => setFiltroMetodo(e.target.value as any)}
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-gray-300)' }}
              >
                <option value="Todos">Todos</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Retiro de Caja">Retiros</option>
              </select>
              <button 
                onClick={exportToExcel}
                disabled={transacciones.length === 0}
                style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', padding: '0.2rem 0.5rem', opacity: transacciones.length === 0 ? 0.5 : 1 }}
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>
              <Loader2 className="animate-spin" style={{ margin: '0 auto 1rem' }} />
              <p>Cargando transacciones...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)', background: '#F9FAFB', borderRadius: '16px' }}>
              <BarChart size={40} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>No hay transacciones registradas.</p>
            </div>
          ) : (
            <div className="flex-col gap-3">
              {filteredData.map(t => {
                const esRetiro = t.metodo === 'Retiro de Caja';
                return (
                  <div key={t.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem', borderRadius: '12px', border: '1px solid',
                    background: esRetiro ? '#FEF2F2' : '#F9FAFB',
                    borderColor: esRetiro ? '#FECACA' : '#F3F4F6'
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: esRetiro ? '#DC2626' : 'var(--color-primary)' }}>
                        {esRetiro ? '↓ ' : ''}{t.alumno}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                        {formatDateStringAR(t.fecha)} • {t.metodo} {t.codigo_efectivo && `(${t.codigo_efectivo})`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 'bold', color: esRetiro ? '#DC2626' : (t.metodo === 'Efectivo' ? '#15803D' : '#0369A1') }}>
                        {esRetiro ? '-' : '+'}${t.monto.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#9CA3AF', padding: '0.25rem', borderRadius: '6px',
                          opacity: deletingId === t.id ? 0.4 : 1
                        }}
                        title="Eliminar"
                      >
                        {deletingId === t.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal para Nuevo Pago */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '24px', width: '90%', maxWidth: '400px',
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--color-gray-400)' }}
            >
              <X size={24} />
            </button>

            <h3 style={{ margin: '0 0 1.5rem', color: 'var(--color-primary)' }}>Registrar Pago</h3>

            <form onSubmit={handleAddPago} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Alumno</label>
                <select 
                  className="input-field"
                  value={newPago.alumno_id}
                  onChange={(e) => setNewPago({...newPago, alumno_id: e.target.value})}
                  required
                >
                  <option value="">Seleccionar alumno</option>
                  <option value="nuevo">--- NUEVO INGRESO (Solo generar código) ---</option>
                  {alumnos.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Monto ($)</label>
                <input 
                  type="number" 
                  className="input-field"
                  value={newPago.monto}
                  onChange={(e) => setNewPago({...newPago, monto: Number(e.target.value)})}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Método de Pago</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button"
                    onClick={() => setNewPago({...newPago, metodo: 'Efectivo'})}
                    style={{ 
                      flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--color-gray-300)',
                      background: newPago.metodo === 'Efectivo' ? '#DCFCE7' : 'white',
                      borderColor: newPago.metodo === 'Efectivo' ? '#15803D' : 'var(--color-gray-300)',
                      color: newPago.metodo === 'Efectivo' ? '#15803D' : 'var(--color-gray-500)',
                      fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                    }}
                  >
                    <Banknote size={18} />
                    Efectivo
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewPago({...newPago, metodo: 'Mercado Pago'})}
                    style={{ 
                      flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--color-gray-300)',
                      background: newPago.metodo === 'Mercado Pago' ? '#E0F2FE' : 'white',
                      borderColor: newPago.metodo === 'Mercado Pago' ? '#0369A1' : 'var(--color-gray-300)',
                      color: newPago.metodo === 'Mercado Pago' ? '#0369A1' : 'var(--color-gray-500)',
                      fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                    }}
                  >
                    <CreditCard size={18} />
                    MP
                  </button>
                </div>
              </div>

              {newPago.metodo === 'Efectivo' && (
                <div style={{ background: 'var(--color-background)', padding: '1rem', borderRadius: '16px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>Código de Comprobante</p>
                  <div style={{ 
                    background: 'white', border: '2px dashed var(--color-gray-300)', padding: '0.5rem', 
                    borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px',
                    color: 'var(--color-secondary)', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {generadorCodigo || '--------'}
                  </div>
                  <button 
                    type="button"
                    onClick={generateCode}
                    style={{ 
                      marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--color-primary)',
                      fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer'
                    }}
                  >
                    Generar Código
                  </button>
                </div>
              )}

              <button 
                type="submit"
                className="btn-primary"
                style={{ marginTop: '0.5rem', padding: '1rem' }}
              >
                Confirmar Registro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Retiro de Caja */}
      {isRetiroModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '24px', width: '90%', maxWidth: '400px',
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <button
              onClick={() => setIsRetiroModalOpen(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--color-gray-400)' }}
            >
              <X size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#FEE2E2', padding: '0.6rem', borderRadius: '12px' }}>
                <ArrowDownCircle size={24} color="#DC2626" />
              </div>
              <h3 style={{ margin: 0, color: '#DC2626' }}>Retiro de Caja</h3>
            </div>
            <form onSubmit={handleAddRetiro} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Monto a retirar ($)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0"
                  value={newRetiro.monto || ''}
                  onChange={(e) => setNewRetiro({...newRetiro, monto: Number(e.target.value)})}
                  required
                  min={1}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción (opcional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Pago de servicios, compra de materiales..."
                  value={newRetiro.descripcion}
                  onChange={(e) => setNewRetiro({...newRetiro, descripcion: e.target.value})}
                />
              </div>
              <div style={{ background: '#FEF2F2', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #FECACA' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#DC2626' }}>
                  ⚠️ Este retiro descontará del saldo de caja y quedará registrado en el historial.
                </p>
              </div>
              <button
                type="submit"
                style={{
                  marginTop: '0.5rem', padding: '1rem', borderRadius: '12px',
                  background: '#DC2626', color: 'white', border: 'none',
                  fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
                }}
              >
                Confirmar Retiro
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Contabilidad;

