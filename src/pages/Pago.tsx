import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, CreditCard, Banknote, ShieldCheck } from 'lucide-react';

const Pago: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { plan: string, childrenCount: number, total: number } | null;

  const [paymentMethod, setPaymentMethod] = useState<'mp' | 'efectivo' | null>(null);
  const [code, setCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!state) {
    navigate('/contratar');
    return null;
  }

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    if (paymentMethod === 'mp') {
      // Simular redirección a Mercado Pago
      setTimeout(() => {
        setIsProcessing(false);
        alert('Simulación: Pago completado por Mercado Pago. Redirigiendo a ficha del alumno...');
        navigate('/ficha', { state: { ...state, metodo: 'Mercado Pago' } });
      }, 2000);
    } else {
      // Validar código de efectivo (8 caracteres)
      if (code.length !== 8) {
        alert('El código debe tener 8 caracteres.');
        setIsProcessing(false);
        return;
      }
      setTimeout(() => {
        setIsProcessing(false);
        alert('¡Código validado exitosamente! Pago registrado.');
        navigate('/ficha', { state: { ...state, metodo: 'Efectivo', codigo_efectivo: code } });
      }, 1500);
    }
  };

  return (
    <div className="auth-layout">
      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem' }}>
        <button 
          onClick={() => navigate('/contratar')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Pago Seguro</h2>
      </div>

      <div className="auth-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Resumen */}
        <div style={{ background: 'var(--color-background)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>Resumen de contratación:</p>
          <div className="flex justify-between items-center mt-2">
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)' }}>
                Plan {state.plan === 'hora' ? 'Por Hora' : state.plan === 'semana' ? 'Semanal' : 'Mensual'}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>{state.childrenCount} niño(s)</p>
            </div>
            <h3 style={{ margin: 0, color: 'var(--color-secondary)' }}>${state.total.toLocaleString()}</h3>
          </div>
        </div>

        <h3 className="auth-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Selecciona el método de pago</h3>
        
        <form onSubmit={handlePayment} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="flex-col gap-4 mb-6">
            <div 
              onClick={() => setPaymentMethod('mp')}
              style={{ 
                border: `2px solid ${paymentMethod === 'mp' ? '#009EE3' : 'var(--color-gray-300)'}`,
                borderRadius: '12px', padding: '1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '1rem',
                background: paymentMethod === 'mp' ? '#F2FAFD' : 'white',
                transition: 'all 0.2s'
              }}
            >
              <CreditCard size={24} color={paymentMethod === 'mp' ? '#009EE3' : 'var(--color-gray-500)'} />
              <div>
                <h4 style={{ margin: 0, color: paymentMethod === 'mp' ? '#009EE3' : 'var(--color-primary)' }}>Mercado Pago</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Tarjetas, dinero en cuenta o cuotas</p>
              </div>
            </div>

            <div 
              onClick={() => setPaymentMethod('efectivo')}
              style={{ 
                border: `2px solid ${paymentMethod === 'efectivo' ? 'var(--color-secondary)' : 'var(--color-gray-300)'}`,
                borderRadius: '12px', padding: '1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '1rem',
                background: paymentMethod === 'efectivo' ? 'var(--color-background)' : 'white',
                transition: 'all 0.2s'
              }}
            >
              <Banknote size={24} color={paymentMethod === 'efectivo' ? 'var(--color-secondary)' : 'var(--color-gray-500)'} />
              <div>
                <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>Efectivo (Código)</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Abonar en la academia y usar código</p>
              </div>
            </div>
          </div>

          {paymentMethod === 'efectivo' && (
            <div className="input-group" style={{ marginBottom: '2rem', animation: 'fadeIn 0.3s' }}>
              <label className="input-label">Código de Habilitación</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={20} color="var(--color-gray-500)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ej: A1B2C3D4" 
                  style={{ paddingLeft: '40px', textTransform: 'uppercase', letterSpacing: '2px' }}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  required
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                Ingresa el código de 8 caracteres que te entregaron al pagar.
              </p>
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button 
              type="submit" 
              className="btn btn-primary btn-block" 
              disabled={!paymentMethod || isProcessing || (paymentMethod === 'efectivo' && code.length !== 8)}
              style={{ background: paymentMethod === 'mp' ? '#009EE3' : 'var(--color-primary)' }}
            >
              {isProcessing 
                ? 'Procesando...' 
                : paymentMethod === 'mp' 
                  ? 'Ya realicé el pago' 
                  : 'Validar y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Pago;
