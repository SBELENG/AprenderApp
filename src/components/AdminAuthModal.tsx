import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Contraseña genérica por ahora
    if (password === 'admin123') {
      setError(false);
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--color-white)',
        padding: '2rem',
        borderRadius: '1.5rem',
        width: '90%',
        maxWidth: '400px',
        position: 'relative',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-gray-500)'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            backgroundColor: 'var(--color-tertiary)',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Lock size={30} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            Acceso Restringido
          </h3>
          <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Ingresa la contraseña para acceder a la contabilidad.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <input 
              type="password" 
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: error ? '2px solid #ef4444' : '1px solid var(--color-gray-300)',
                outline: 'none',
                textAlign: 'center',
                fontSize: '1.1rem'
              }}
              autoFocus
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
                Contraseña incorrecta. Intenta de nuevo.
              </p>
            )}
          </div>

          <button 
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '1rem' }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminAuthModal;
