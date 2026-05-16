import React from 'react';
import { AlertTriangle, X, HeartPulse } from 'lucide-react';

interface HealthAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alumnoNombre: string;
  saludInfo: string;
}

const HealthAlertModal: React.FC<HealthAlertModalProps> = ({ isOpen, onClose, alumnoNombre, saludInfo }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(5px)',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        width: '100%',
        maxWidth: '400px',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <div style={{ 
          backgroundColor: '#FEE2E2', 
          padding: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          borderBottom: '1px solid #FECACA'
        }}>
          <div style={{
            backgroundColor: '#EF4444',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#991B1B', fontSize: '1.1rem', fontWeight: 'bold' }}>
              Alerta de Salud
            </h3>
            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.85rem' }}>
              Información crítica para el ingreso
            </p>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>Alumno:</p>
            <p style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem', fontWeight: 'bold' }}>
              {alumnoNombre}
            </p>
          </div>

          <div style={{ 
            backgroundColor: '#FFF7ED', 
            border: '1px solid #FFEDD5', 
            padding: '1rem', 
            borderRadius: '16px',
            display: 'flex',
            gap: '0.75rem'
          }}>
            <HeartPulse size={20} color="#EA580C" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, color: '#9A3412', fontSize: '1rem', lineHeight: '1.5' }}>
              {saludInfo}
            </p>
          </div>

          <button 
            onClick={onClose}
            style={{ 
              width: '100%', 
              marginTop: '1.5rem', 
              backgroundColor: 'var(--color-primary)', 
              color: 'white', 
              border: 'none', 
              padding: '1rem', 
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Entendido, registrar ingreso
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default HealthAlertModal;
