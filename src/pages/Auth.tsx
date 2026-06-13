import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RecaptchaVerifier, signInWithPhoneNumber, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Limpia completamente el reCAPTCHA anterior del DOM y del objeto global
const clearRecaptcha = () => {
  try {
    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
      (window as any).recaptchaVerifier = null;
    }
  } catch (e) {
    console.warn('Error al limpiar recaptchaVerifier:', e);
    (window as any).recaptchaVerifier = null;
  }
  // Limpiar también el contenido del div en el DOM
  const container = document.getElementById('recaptcha-container');
  if (container) container.innerHTML = '';
};

const RESEND_COOLDOWN = 60; // segundos de espera antes de poder reenviar

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp' | 'google-phone'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [codeSent, setCodeSent] = useState(false);          // bloquea reenvíos
  const [countdown, setCountdown] = useState(0);            // cuenta regresiva
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpia el intervalo al desmontar el componente
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setCodeSent(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

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

      // 2. Limpiar completamente el reCAPTCHA anterior (verifier + DOM)
      clearRecaptcha();

      // Bypass for testing phone number to prevent Firebase rate limits
      if (cleanPhone === '3584196880') {
        setConfirmationResult({
          confirm: async (code: string) => {
            if (code === '123456') {
              return { user: { uid: 'test-user-bypass', phoneNumber: '+5493584196880' } };
            }
            throw new Error('Código incorrecto');
          }
        });
        setStep('otp');
        setIsLoading(false);
        return;
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
      setCodeSent(true);     // bloquear reenvíos
      startCountdown();       // iniciar cuenta regresiva de 60s
      setStep('otp');
    } catch (err: any) {
      console.error('Error al enviar SMS OTP con Firebase:', err);
      const currentDomain = window.location.hostname;
      const cleanPhone = phone.replace(/\D/g, '');
      const phoneFormatted = `+549${cleanPhone}`;
      alert(`[DIAGNÓSTICO DE ERROR DE SMS]\n\n• Dominio desde el que entras: ${currentDomain}\n• Teléfono enviado: ${phoneFormatted}\n\n• Detalle del error: ${err.message || err.code || JSON.stringify(err)}\n\n(Usa este detalle para verificar si falta habilitar el dominio en Firebase, o si hay un error en las claves en Vercel)`);
      // Limpiar reCAPTCHA también en caso de error para permitir reintento limpio
      clearRecaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6 || !confirmationResult) return;
    setIsLoading(true);

    // ── PASO 1: Verificar el código con Firebase ──────────────────────────────
    let firebaseUser: any = null;
    try {
      const cleanOtp = otp.trim().replace(/\D/g, '').slice(0, 6);
      console.log('[OTP] Código limpio enviado a Firebase:', cleanOtp, '| len:', cleanOtp.length);
      const result = await confirmationResult.confirm(cleanOtp);
      firebaseUser = result?.user ?? null;
      if (!firebaseUser) throw new Error('Firebase no devolvió usuario tras confirm()');
    } catch (firebaseErr: any) {
      console.error('[OTP][Firebase Error]', firebaseErr);
      const code   = firebaseErr?.code    || 'sin-code';
      const msg    = firebaseErr?.message || 'sin-message';
      const name   = firebaseErr?.name    || 'sin-name';
      let friendlyMsg = `El código es incorrecto o venció. Volvé atrás y pedí uno nuevo.`;
      if (code === 'auth/session-expired')          friendlyMsg = 'El código expiró. Pedí un nuevo SMS.';
      if (code === 'auth/invalid-verification-code') friendlyMsg = 'El código es incorrecto. Revisá los 6 dígitos.';
      alert(`${friendlyMsg}\n\n[Firebase] code=${code} | name=${name}\n${msg}`);
      setIsLoading(false);
      return;
    }

    // ── PASO 2: Buscar la familia en Supabase ─────────────────────────────────
    await processFamilyLogin(phone);
  };

  const processFamilyLogin = async (loginPhone: string) => {
    try {
      // Buscar si la familia ya existe en Supabase
      const { data: families, error: famError } = await supabase
        .from('familias')
        .select('*')
        .eq('telefono', loginPhone);
        
      if (famError) throw famError;
      
      if (families && families.length > 0) {
        const family = families[0];
        
        // Buscar si ya tiene alumnos (hijos) registrados
        const { data: alumnos, error: alumsError } = await supabase
          .from('alumnos')
          .select('id, nombre')
          .eq('familia_id', family.id);
          
        if (alumsError) throw alumsError;
        
        if (alumnos && alumnos.length > 0) {
          // Ya tiene alumnos registrados. Iniciamos sesión y vamos directo a la agenda.
          const nombres = alumnos.map(a => a.nombre);
          
          let inferredPlan = 'mensual';
          let durationCount = 1;
          
          const { data: trans } = await supabase
            .from('transacciones')
            .select('monto')
            .eq('alumno_id', alumnos[0].id)
            .order('fecha', { ascending: false })
            .limit(1);
            
          if (trans && trans.length > 0) {
            const monto = trans[0].monto;
            if (monto < 30000) {
              inferredPlan = 'hora';
              durationCount = Math.max(1, Math.round(monto / (alumnos.length >= 2 ? 6300 : 7000)));
            } else if (monto < 100000) {
              inferredPlan = 'semana';
              durationCount = Math.max(1, Math.round(monto / (alumnos.length >= 2 ? 31500 : 35000)));
            } else {
              inferredPlan = 'mensual';
              durationCount = Math.max(1, Math.round(monto / (alumnos.length >= 2 ? 117000 : 130000)));
            }
          }

          alert(`¡Ingreso exitoso! Bienvenido de nuevo a la familia de: ${nombres.join(', ')}.`);
          navigate('/agenda', { state: { telefono: loginPhone, nombres, plan: inferredPlan, durationCount, childrenCount: nombres.length } });
        } else {
          // Familia existe pero sin niños (quizás se borraron en pruebas), debe comprar plan.
          navigate('/contratar', { state: { telefono: loginPhone } });
        }
      } else {
        // Nueva familia verificada, ir al flujo normal de elegir plan (contratar)
        navigate('/contratar', { state: { telefono: loginPhone } });
      }
    } catch (supabaseErr: any) {
      console.error('[OTP][Supabase Error]', supabaseErr);
      alert(`Firebase OK pero error al buscar tu familia.\n\n[Supabase] ${supabaseErr?.message || JSON.stringify(supabaseErr)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user?.email) {
        setGoogleEmail(result.user.email);
        setStep('google-phone');
      }
    } catch (err: any) {
      console.error('Error al iniciar con Google:', err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
         alert(`Error con Google: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('549')) cleanPhone = cleanPhone.substring(3);
    else if (cleanPhone.startsWith('54')) cleanPhone = cleanPhone.substring(2);
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length === 12 && cleanPhone.substring(3, 5) === '15') cleanPhone = cleanPhone.substring(0, 3) + cleanPhone.substring(5);
    else if (cleanPhone.length === 11 && cleanPhone.substring(2, 4) === '15') cleanPhone = cleanPhone.substring(0, 2) + cleanPhone.substring(4);

    if (cleanPhone.length !== 10) {
      alert('El número debe tener 10 dígitos (ej: 3584858343). Por favor verifica si tiene el código de área sin el 0 y sin el 15.');
      return;
    }

    setIsLoading(true);
    await processFamilyLogin(cleanPhone);
  };

  // Volver al paso de ingreso de teléfono y resetear todo el estado de envío
  const goBackToPhone = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setStep('phone');
    setOtp('');
    setCodeSent(false);
    setCountdown(0);
    setGoogleEmail('');
    setConfirmationResult(null);
    clearRecaptcha();
  };

  return (
    <div className="auth-layout">
      {/* Header */}
      <div className="auth-header">
        <button 
          onClick={() => step === 'otp' ? goBackToPhone() : navigate('/')} 
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
                  disabled={phone.length !== 10 || isLoading || codeSent}
                >
                  {isLoading
                    ? 'Enviando código...'
                    : codeSent
                    ? `Código enviado — reenviar en ${countdown}s`
                    : 'Recibir código por SMS'}
                </button>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-gray-200)' }}></div>
                <span style={{ margin: '0 10px', color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>o prueba con</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-gray-200)' }}></div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  onClick={handleGoogleSignIn}
                  className="btn btn-block" 
                  style={{ 
                    backgroundColor: 'white', 
                    color: '#333', 
                    border: '1px solid #ccc', 
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  disabled={isLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22px" height="22px">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  Ingresar con Google
                </button>
              </div>
            </form>
          </>
        ) : step === 'otp' ? (
          <>
            <h2 className="auth-title">Verifica tu código</h2>
            <p className="auth-subtitle">
              Hemos enviado un código SMS al número <b>{phone}</b>.<br/>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Ingresá el código del SMS más reciente.</span>
            </p>

            <form onSubmit={handleVerifyOtp}>
              <div className="input-group">
                <label className="input-label">Código de 6 dígitos</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={20} color="var(--color-gray-500)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    className="input-field" 
                    placeholder="123456" 
                    style={{ paddingLeft: '40px', letterSpacing: '8px', fontSize: '1.2rem', textAlign: 'center' }}
                    value={otp}
                    onChange={(e) => {
                      // Solo permitir dígitos, máximo 6
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                    }}
                    maxLength={6}
                    autoComplete="one-time-code"
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
                  onClick={goBackToPhone} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Modificar número
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="auth-title">Casi listo</h2>
            <p className="auth-subtitle">
              Iniciaste sesión con <b>{googleEmail}</b>.<br/>
              Para vincular tu cuenta y ver tu agenda, por favor ingresa tu número de celular.
            </p>

            <form onSubmit={handleLinkPhone}>
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
                  Igual que antes: 10 dígitos, sin 0 y sin 15.
                </p>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-block" 
                  disabled={phone.length < 10 || isLoading}
                >
                  {isLoading ? 'Verificando...' : 'Guardar y Continuar'}
                </button>
              </div>
              
              <div className="text-center mt-4">
                <button 
                  type="button" 
                  onClick={goBackToPhone} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Volver al inicio
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
