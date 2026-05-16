import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Calendar, Clock, ArrowRight } from 'lucide-react';

const Contratar: React.FC = () => {
  const navigate = useNavigate();
  const [childrenCount, setChildrenCount] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<'hora' | 'semana' | 'mes' | null>(null);

  const plans = [
    { id: 'hora', title: 'Por Hora (3hs)', price: 7000, icon: <Clock size={24} /> },
    { id: 'semana', title: 'Semanal', price: 32000, icon: <Calendar size={24} /> },
    { id: 'mes', title: 'Mensual', price: 120000, icon: <Calendar size={24} /> }
  ];

  // Calcular descuento (10% si hay 2 o más niños)
  const hasDiscount = childrenCount >= 2;
  const discountMultiplier = hasDiscount ? 0.9 : 1;

  const getPrice = (basePrice: number) => {
    return basePrice * childrenCount * discountMultiplier;
  };

  const handleNext = () => {
    if (selectedPlan) {
      navigate('/pago', { state: { plan: selectedPlan, childrenCount, total: getPrice(plans.find(p => p.id === selectedPlan)!.price) } });
    }
  };

  return (
    <div className="auth-layout">
      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem' }}>
        <button 
          onClick={() => navigate('/auth')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Contratación</h2>
      </div>

      <div className="auth-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h3 className="auth-title" style={{ fontSize: '1.2rem' }}>1. ¿Cuántos niños asistirán?</h3>
          <div className="flex items-center gap-4 mt-4">
            <button 
              onClick={() => setChildrenCount(Math.max(1, childrenCount - 1))}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--color-gray-300)', background: 'white' }}
            >-</button>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{childrenCount}</span>
            <button 
              onClick={() => setChildrenCount(childrenCount + 1)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--color-gray-300)', background: 'white' }}
            >+</button>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: hasDiscount ? 'var(--color-secondary)' : 'var(--color-gray-500)' }}>
              <Users size={20} />
              <span style={{ fontSize: '0.9rem', fontWeight: hasDiscount ? 'bold' : 'normal' }}>
                {hasDiscount ? '¡10% de descuento aplicado!' : '10% off desde 2 niños'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem', flex: 1 }}>
          <h3 className="auth-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>2. Selecciona la modalidad</h3>
          
          <div className="flex-col gap-4">
            {plans.map((plan) => (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id as any)}
                style={{ 
                  border: `2px solid ${selectedPlan === plan.id ? 'var(--color-secondary)' : 'var(--color-gray-300)'}`,
                  borderRadius: '12px',
                  padding: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: selectedPlan === plan.id ? 'var(--color-background)' : 'white',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ color: selectedPlan === plan.id ? 'var(--color-secondary)' : 'var(--color-gray-500)' }}>
                  {plan.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>{plan.title}</h4>
                  <p style={{ margin: 0, color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>Base: ${plan.price.toLocaleString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                    ${getPrice(plan.price).toLocaleString()}
                  </h4>
                  {hasDiscount && <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', textDecoration: 'line-through' }}>
                    ${(plan.price * childrenCount).toLocaleString()}
                  </span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          className="btn btn-primary btn-block" 
          disabled={!selectedPlan}
          onClick={handleNext}
          style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}
        >
          Continuar al Pago
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default Contratar;
