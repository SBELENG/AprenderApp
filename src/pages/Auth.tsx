import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, ShieldCheck } from 'lucide-react';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) return;
    setIsLoading(true);
    // Simular llamada a Firebase Auth
    setTimeout(() => {
      setIsLoading(false);
      setStep('otp');
    }, 1500);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setIsLoading(true);
    // Simular verificación OTP
    setTimeout(() => {
      setIsLoading(false);
      navigate('/contratar');
    }, 1500);
  };

  return (
    <div className="auth-layout">
      {/* Header */}
      <div className="auth-header">
        <button 
          onClick={() => step === 'otp' ? setStep('phone') : navigate('/')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
        >
          <ChevronLeft size={28} />
        </button>
        <img src="/recursos/Diseño sin título (4).png" alt="Aprender Logo" className="auth-logo" />
      </div>

      {/* Content */}
      <div className="auth-content">
        {step === 'phone' ? (
          <>
            <h2 className="auth-title">Ingreso Familias</h2>
            <p className="auth-subtitle">Ingresa tu número de celular para recibir un código de acceso seguro por SMS.</p>

            <form onSubmit={handleSendCode}>
              <div className="input-group">
                <label className="input-label">Número de Celular</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={20} color="var(--color-gray-500)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  <input 
                    type="tel" 
                    className="input-field" 
                    placeholder="Ej: 3584858343" 
                    style={{ paddingLeft: '40px' }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={10}
                    required
                  />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', marginTop: '4px', margin: 0 }}>
                  Ingresa tu número con código de área (10 dígitos, sin 0 ni 15).
                </p>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-block" 
                  disabled={phone.length !== 10 || isLoading}
                >
                  {isLoading ? 'Enviando código...' : 'Recibir código por SMS'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="auth-title">Verifica tu código</h2>
            <p className="auth-subtitle">Hemos enviado un código SMS al número <b>{phone}</b></p>

            <form onSubmit={handleVerifyOtp}>
              <div className="input-group">
                <label className="input-label">Código de 6 dígitos</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={20} color="var(--color-gray-500)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="123456" 
                    style={{ paddingLeft: '40px', letterSpacing: '8px', fontSize: '1.2rem', textAlign: 'center' }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-secondary btn-block" 
                  disabled={otp.length < 6 || isLoading}
                >
                  {isLoading ? 'Verificando...' : 'Acceder al Portal'}
                </button>
              </div>
              
              <div className="text-center mt-4">
                <button 
                  type="button" 
                  onClick={() => setStep('phone')} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Modificar número
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;
