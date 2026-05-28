import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../lib/firebase';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Sanitizar el número de teléfono ingresado
      let cleanPhone = phone.replace(/\D/g, ''); // Quedarse solo con números
      
      // Quitar prefijo de país si lo ingresaron
      if (cleanPhone.startsWith('549')) {
        cleanPhone = cleanPhone.substring(3);
      } else if (cleanPhone.startsWith('54')) {
        cleanPhone = cleanPhone.substring(2);
      }
      
      // Quitar el 0 inicial si lo ingresaron (código de salida)
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }
      
      // Quitar el 15 si lo ingresaron (ej: prefijo 15 de celulares en Argentina)
      if (cleanPhone.length === 12 && cleanPhone.substring(3, 5) === '15') {
        cleanPhone = cleanPhone.substring(0, 3) + cleanPhone.substring(5);
      } else if (cleanPhone.length === 11 && cleanPhone.substring(2, 4) === '15') {
        cleanPhone = cleanPhone.substring(0, 2) + cleanPhone.substring(4);
      }

      // Validar longitud final (deben ser 10 dígitos: código de área + número local)
      if (cleanPhone.length !== 10) {
        throw new Error('El número debe tener 10 dígitos (ej: 3584858343). Por favor verifica si tiene el código de área sin el 0 y sin el 15.');
      }

      // 2. Limpiar reCAPTCHA previo si existe en el objeto global
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {
          console.warn("Error al limpiar recaptcha previo:", e);
        }
      }

      // 3. Inicializar reCAPTCHA de Firebase de forma invisible
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA resuelto automáticamente
        }
      });

      const phoneFormatted = `+549${cleanPhone}`;
      const appVerifier = (window as any).recaptchaVerifier;

      // 4. Enviar SMS real mediante Google Firebase
      const confirmation = await signInWithPhoneNumber(auth, phoneFormatted, appVerifier);
      
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (err: any) {
      console.error('Error al enviar SMS OTP con Firebase:', err);
      const currentDomain = window.location.hostname;
      const cleanPhone = phone.replace(/\D/g, '');
      const phoneFormatted = `+549${cleanPhone}`;
      alert(`[DIAGNÓSTICO DE ERROR DE SMS]\n\n• Dominio desde el que entras: ${currentDomain}\n• Teléfono enviado: ${phoneFormatted}\n\n• Detalle del error: ${err.message || err.code || JSON.stringify(err)}\n\n(Usa este detalle para verificar si falta habilitar el dominio en Firebase, o si hay un error en las claves en Vercel)`);
      if ((window as any).recaptchaVerifier) {
        try { (window as any).recaptchaVerifier.clear(); } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6 || !confirmationResult) return;
    setIsLoading(true);
    
    try {
      // 1. Confirmar el código OTP ingresado mediante Firebase
      const result = await confirmationResult.confirm(otp);
      
      if (!result.user) {
        throw new Error('No se pudo verificar el usuario en Firebase.');
      }

      // 2. Una vez verificado el celular real, buscar si la familia ya existe en Supabase
      const { data: families, error: famError } = await supabase
        .from('familias')
        .select('*')
        .eq('telefono', phone);
        
      if (famError) throw famError;
      
      if (families && families.length > 0) {
        const family = families[0];
        
        // Buscar si ya tiene alumnos (hijos) registrados
        const { data: alumnos, error: alumsError } = await supabase
          .from('alumnos')
          .select('nombre')
          .eq('familia_id', family.id);
          
        if (alumsError) throw alumsError;
        
        if (alumnos && alumnos.length > 0) {
          // Ya tiene alumnos registrados. Iniciamos sesión y vamos directo a la agenda.
          const nombres = alumnos.map(a => a.nombre);
          alert(`¡Ingreso exitoso! Bienvenido de nuevo a la familia de: ${nombres.join(', ')}.`);
          navigate('/agenda', { state: { telefono: phone, nombres, plan: 'mensual', childrenCount: nombres.length } });
        } else {
          // Familia existe pero sin niños, ir a la Ficha
          alert('¡Ingreso exitoso! Por favor completa la ficha de tus hijos para agendar.');
          navigate('/ficha', { state: { telefono: phone, plan: 'mensual', childrenCount: 1, total: 0 } });
        }
      } else {
        // Nueva familia verificada, ir al flujo normal de elegir plan (contratar)
        navigate('/contratar', { state: { telefono: phone } });
      }
    } catch (err: any) {
      console.error('Error al verificar OTP con Firebase:', err);
      alert('El código ingresado es incorrecto o ha vencido. Por favor verifica e intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
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
        <img 
          src="/recursos/Diseño sin título (4).png" 
          alt="Aprender Logo" 
          className="auth-logo" 
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/admin/asistencia')}
        />
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
            <p className="auth-subtitle">Hemos enviado un código SMS de verificación real al número <b>{phone}</b></p>

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
      <div id="recaptcha-container"></div>
    </div>
  );
};

export default Auth;
