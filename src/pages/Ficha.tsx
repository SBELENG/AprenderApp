import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, User, HeartPulse, Brain, BookOpen, Phone, ShieldCheck, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Ficha: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentState = location.state as { plan: string, childrenCount: number, total: number } | null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sinProblemasSalud, setSinProblemasSalud] = useState(false);
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    dni: '',
    nacimiento: '',
    edad: '',
    grado: '',
    turno: '',
    escuela: '',
    maestra: '',
    salud: '',
    obraSocial: '',
    emergencia: '',
    autorizados: '',
    desempeno: '',
    asignaturas: ''
  });

  useEffect(() => {
    if (formData.nacimiento) {
      const birthDate = new Date(formData.nacimiento);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, edad: age.toString() }));
    }
  }, [formData.nacimiento]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPreview) {
      alert('Por favor, toma una foto del alumno por seguridad.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase
        .from('alumnos')
        .upsert([{
          nombre: formData.nombre,
          dni: formData.dni,
          fecha_nacimiento: formData.nacimiento,
          grado: formData.grado,
          escuela: formData.escuela,
          maestra_grado: formData.maestra,
          salud_info: formData.salud,
          obra_social: formData.obraSocial,
          emergencia_contacto: formData.emergencia,
          autorizados_retiro: formData.autorizados,
          foto_url: photoPreview
        }], { onConflict: 'dni' })
        .select();

      if (error) throw error;

      if (paymentState && data && data.length > 0) {
        // Registrar el pago
        const alumnoId = data[0].id;
        const { error: pagoError } = await supabase
          .from('transacciones')
          .insert([{
            alumno_id: alumnoId,
            monto: paymentState.total / paymentState.childrenCount, // Si inscriben a varios en la misma PC
            metodo: 'Mercado Pago', // Simplificado
            fecha: new Date().toISOString().split('T')[0]
          }]);
        if (pagoError) console.error('Error registrando pago:', pagoError);
      }

      alert('¡Inscripción completada y guardada en la base de datos! Ahora puedes agendar tus turnos.');
      navigate('/agenda');
    } catch (error: any) {
      console.error('Error guardando ficha:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
      {/* Header */}
      <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-background)' }}>
        <button 
          onClick={() => navigate('/pago')} 
          style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
        >
          <ChevronLeft size={28} />
        </button>
        <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Ficha del Alumno</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>Paso final de inscripción</p>
      </div>

      <div style={{ padding: '1.5rem', flex: 1 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Foto Identificatoria (Seguridad) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div 
              style={{ 
                width: '120px', height: '120px', 
                borderRadius: '50%', 
                background: 'var(--color-gray-100)',
                border: '2px dashed var(--color-gray-300)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                overflow: 'hidden', position: 'relative'
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={48} color="var(--color-gray-300)" />
              )}
            </div>
            
            {/* Input oculto que fuerza la cámara en dispositivos móviles */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handlePhotoCapture}
            />
            
            <button 
              type="button"
              onClick={triggerCamera}
              className="btn btn-outline"
              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', gap: '0.5rem' }}
            >
              <Camera size={18} />
              Tomar Foto Identificatoria
            </button>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-gray-500)', textAlign: 'center' }}>
              Requerido por seguridad para control de ingreso/retiro.
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-gray-100)' }} />

          {/* Datos Personales */}
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={20} color="var(--color-secondary)" />
              Datos Personales
            </h3>
            
            <div className="input-group">
              <label className="input-label">Nombre Completo del Niño/a</label>
              <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} className="input-field" required />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">DNI / ID</label>
                <input type="text" name="dni" value={formData.dni} onChange={handleInputChange} className="input-field" required />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Fecha de Nacimiento</label>
                <input type="date" name="nacimiento" value={formData.nacimiento} onChange={handleInputChange} className="input-field" required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Edad (años)</label>
                <input type="number" name="edad" value={formData.edad} onChange={handleInputChange} className="input-field" readOnly style={{ background: 'var(--color-gray-100)' }} />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Grado Escolar</label>
                <select name="grado" value={formData.grado} onChange={handleInputChange} className="input-field" required>
                  <option value="">Seleccionar</option>
                  <option value="1">1er Grado</option>
                  <option value="2">2do Grado</option>
                  <option value="3">3er Grado</option>
                  <option value="4">4to Grado</option>
                  <option value="5">5to Grado</option>
                  <option value="6">6to Grado</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Turno Escolar</label>
                <select name="turno" value={formData.turno} onChange={handleInputChange} className="input-field" required>
                  <option value="">Seleccionar</option>
                  <option value="Manana">Mañana</option>
                  <option value="Tarde">Tarde</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Establecimiento Educativo</label>
                <input type="text" name="escuela" value={formData.escuela} onChange={handleInputChange} className="input-field" placeholder="Nombre de la escuela" required />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Maestra del Grado</label>
                <input type="text" name="maestra" value={formData.maestra} onChange={handleInputChange} className="input-field" placeholder="Nombre" required />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-gray-100)' }} />

          {/* Contactos y Seguridad */}
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="var(--color-secondary)" />
              Seguridad y Contactos
            </h3>

            <div className="input-group">
              <label className="input-label">
                <Phone size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Contacto de Emergencia Alternativo
              </label>
              <input 
                type="text" name="emergencia" value={formData.emergencia} onChange={handleInputChange} 
                className="input-field" placeholder="Nombre y Teléfono (ej: Abuela Marta - 3584112233)" required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <User size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Personas Autorizadas para Retirar
              </label>
              <textarea 
                name="autorizados" value={formData.autorizados} onChange={handleInputChange} 
                className="input-field" rows={2} placeholder="Nombres y DNI de quienes pueden retirar al alumno..." 
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <CreditCard size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Obra Social / Prepaga
              </label>
              <input 
                type="text" name="obraSocial" value={formData.obraSocial} onChange={handleInputChange} 
                className="input-field" placeholder="Nombre y N° de Carnet" 
              />
            </div>
          </div>

          {/* Información de Apoyo */}
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={20} color="var(--color-secondary)" />
              Información de Apoyo
            </h3>
            
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={sinProblemasSalud} 
                  onChange={(e) => {
                    setSinProblemasSalud(e.target.checked);
                    if (e.target.checked) setFormData(prev => ({ ...prev, salud: 'Ningún problema de salud' }));
                    else setFormData(prev => ({ ...prev, salud: '' }));
                  }} 
                  style={{ width: '18px', height: '18px' }}
                />
                Ningún problema de salud conocido
              </label>
              {!sinProblemasSalud && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="input-label">
                    <HeartPulse size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Estado de Salud / Alergias
                  </label>
                  <textarea name="salud" value={formData.salud} onChange={handleInputChange} className="input-field" rows={2} placeholder="Indique si tiene alguna condición médica, alergia o medicación..."></textarea>
                </div>
              )}
            </div>
            
            <div className="input-group">
              <label className="input-label">
                <BookOpen size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Asignaturas Prioritarias
              </label>
              <input type="text" name="asignaturas" value={formData.asignaturas} onChange={handleInputChange} className="input-field" placeholder="Ej: Matemática, Lengua..." required />
            </div>

            <div className="input-group">
              <label className="input-label">Desempeño / Observaciones previas</label>
              <textarea name="desempeno" value={formData.desempeno} onChange={handleInputChange} className="input-field" rows={3} placeholder="Breve descripción de cómo le va en la escuela o qué le cuesta más..."></textarea>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            style={{ marginTop: '1rem', marginBottom: '2rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Ficha y Finalizar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Ficha;
