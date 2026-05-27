import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, User, HeartPulse, Brain, BookOpen, Phone, ShieldCheck, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Ficha: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentState = location.state as { plan: string, childrenCount: number, total: number, telefono?: string, metodo?: string, codigo_efectivo?: string } | null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sinProblemasSalud, setSinProblemasSalud] = useState(false);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const [familiaId, setFamiliaId] = useState<string | null>(null);
  const [nombresAlumnos, setNombresAlumnos] = useState<string[]>([]);
  const totalChildren = Number(paymentState?.childrenCount) || 1;
  
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

  const [existingAlumnos, setExistingAlumnos] = useState<any[]>([]);
  const [familyData, setFamilyData] = useState<any>(null);
  const [hasSearchedFamily, setHasSearchedFamily] = useState(false);
  const [selectedSiblingIds, setSelectedSiblingIds] = useState<string[]>([]);
  const [prefillMode, setPrefillMode] = useState<'confirm_all' | 'new_sibling' | 'selector' | 'none'>('none');
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  useEffect(() => {
    const fetchFamilyAndAlumnos = async () => {
      if (!paymentState?.telefono || hasSearchedFamily) return;
      setIsLoadingFamily(true);
      try {
        const { data: fams, error: famError } = await supabase
          .from('familias')
          .select('*')
          .eq('telefono', paymentState.telefono);

        if (famError) throw famError;

        if (fams && fams.length > 0) {
          const fam = fams[0];
          setFamiliaId(fam.id);
          setFamilyData(fam);

          const { data: alums, error: alumsError } = await supabase
            .from('alumnos')
            .select('*')
            .eq('familia_id', fam.id);

          if (alumsError) throw alumsError;

          if (alums && alums.length > 0) {
            setExistingAlumnos(alums);

            if (alums.length === totalChildren) {
              setPrefillMode('confirm_all');
            } else if (alums.length < totalChildren) {
              setPrefillMode('new_sibling');
            } else {
              setPrefillMode('selector');
            }
          }
        }
      } catch (err) {
        console.error("Error al buscar ficha familiar:", err);
      } finally {
        setHasSearchedFamily(true);
        setIsLoadingFamily(false);
      }
    };

    fetchFamilyAndAlumnos();
  }, [paymentState?.telefono, hasSearchedFamily, totalChildren]);

  const handleQuickConfirm = async () => {
    setIsSubmitting(true);
    try {
      const nuevosNombres = existingAlumnos.map(a => a.nombre);
      
      for (let i = 0; i < existingAlumnos.length; i++) {
        const alum = existingAlumnos[i];
        if (paymentState) {
          if (paymentState.metodo === 'Efectivo' && paymentState.codigo_efectivo) {
            if (i === 0) {
              await supabase
                .from('transacciones')
                .update({ alumno_id: alum.id })
                .eq('codigo_efectivo', paymentState.codigo_efectivo);
            }
          } else {
            await supabase
              .from('transacciones')
              .insert([{
                alumno_id: alum.id,
                monto: paymentState.total / totalChildren,
                metodo: paymentState.metodo || 'Mercado Pago',
                codigo_efectivo: paymentState.codigo_efectivo || null,
                fecha: getLocalDateString()
              }]);
          }
        }
      }
      alert('¡Fichas confirmadas exitosamente para este período! Redireccionando a la agenda...');
      navigate('/agenda', { state: { ...paymentState, nombres: nuevosNombres } });
    } catch (err: any) {
      alert("Error al confirmar fichas: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewSibling = () => {
    setNombresAlumnos(existingAlumnos.map(a => a.nombre));
    setCurrentChildIndex(existingAlumnos.length);
    setFormData(prev => ({
      ...prev,
      emergencia: familyData?.emergencia_contacto || '',
      autorizados: familyData?.autorizados_retiro || '',
      obraSocial: familyData?.obra_social || ''
    }));
    setPrefillMode('none');
  };

  const handleSiblingCheckboxChange = (id: string) => {
    if (selectedSiblingIds.includes(id)) {
      setSelectedSiblingIds(prev => prev.filter(x => x !== id));
    } else {
      if (selectedSiblingIds.length >= totalChildren) {
        setSelectedSiblingIds(prev => [...prev.slice(1), id]);
      } else {
        setSelectedSiblingIds(prev => [...prev, id]);
      }
    }
  };

  const handleConfirmSelectedSiblings = async () => {
    setIsSubmitting(true);
    try {
      const selectedAlums = existingAlumnos.filter(a => selectedSiblingIds.includes(a.id));
      const nuevosNombres = selectedAlums.map(a => a.nombre);

      for (let i = 0; i < selectedAlums.length; i++) {
        const alum = selectedAlums[i];
        if (paymentState) {
          if (paymentState.metodo === 'Efectivo' && paymentState.codigo_efectivo) {
            if (i === 0) {
              await supabase
                .from('transacciones')
                .update({ alumno_id: alum.id })
                .eq('codigo_efectivo', paymentState.codigo_efectivo);
            }
          } else {
            await supabase
              .from('transacciones')
              .insert([{
                alumno_id: alum.id,
                monto: paymentState.total / totalChildren,
                metodo: paymentState.metodo || 'Mercado Pago',
                codigo_efectivo: paymentState.codigo_efectivo || null,
                fecha: getLocalDateString()
              }]);
          }
        }
      }

      alert('¡Fichas confirmadas exitosamente! Redireccionando a la agenda...');
      navigate('/agenda', { state: { ...paymentState, nombres: nuevosNombres } });
    } catch (err: any) {
      alert("Error al confirmar datos: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      let currentFamiliaId = familiaId;
      
      // 1. Guardar Familia si no existe en este ciclo
      if (!currentFamiliaId && paymentState?.telefono) {
        const { data: famData, error: famError } = await supabase
          .from('familias')
          .upsert([{
            telefono: paymentState.telefono,
            emergencia_contacto: formData.emergencia,
            autorizados_retiro: formData.autorizados,
            obra_social: formData.obraSocial
          }], { onConflict: 'telefono' })
          .select();
          
        if (famError) throw famError;
        if (famData && famData.length > 0) {
          currentFamiliaId = famData[0].id;
          setFamiliaId(currentFamiliaId);
        }
      }

      // 2. Guardar Alumno
      const { data: alumData, error: alumError } = await supabase
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
          foto_url: photoPreview,
          desempeno: formData.desempeno,
          familia_id: currentFamiliaId
        }], { onConflict: 'dni' })
        .select();

      if (alumError) throw alumError;

      // 3. Registrar Pago
      if (paymentState && alumData && alumData.length > 0) {
        if (paymentState.metodo === 'Efectivo' && paymentState.codigo_efectivo) {
          if (currentChildIndex === 0) {
            // Actualizar la transacción que ya creó la admin
            const { error: pagoError } = await supabase
              .from('transacciones')
              .update({ alumno_id: alumData[0].id })
              .eq('codigo_efectivo', paymentState.codigo_efectivo);
            if (pagoError) console.error('Error registrando pago efectivo:', pagoError);
          }
        } else {
          // Mercado Pago
          const { error: pagoError } = await supabase
            .from('transacciones')
            .insert([{
              alumno_id: alumData[0].id,
              monto: paymentState.total / totalChildren,
              metodo: paymentState.metodo || 'Mercado Pago',
              codigo_efectivo: paymentState.codigo_efectivo || null,
              fecha: (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              })()
            }]);
          if (pagoError) console.error('Error registrando pago:', pagoError);
        }
      }

      // Si finalizamos y había alumnos pre-confirmados, registrar sus transacciones
      if (currentChildIndex === totalChildren - 1 && existingAlumnos.length > 0) {
        for (let i = 0; i < existingAlumnos.length; i++) {
          const alum = existingAlumnos[i];
          if (paymentState) {
            if (!(paymentState.metodo === 'Efectivo' && paymentState.codigo_efectivo && i === 0)) {
              await supabase
                .from('transacciones')
                .insert([{
                  alumno_id: alum.id,
                  monto: paymentState.total / totalChildren,
                  metodo: paymentState.metodo || 'Mercado Pago',
                  codigo_efectivo: paymentState.codigo_efectivo || null,
                  fecha: getLocalDateString()
                }]);
            }
          }
        }
      }

      const nuevosNombres = [...nombresAlumnos, formData.nombre];
      setNombresAlumnos(nuevosNombres);

      // 4. Lógica de Hermanos (Ciclo)
      if (currentChildIndex < totalChildren - 1) {
        alert(`¡Ficha ${currentChildIndex + 1} guardada exitosamente! Ahora completa los datos del siguiente niño.`);
        setFormData(prev => ({
          ...prev,
          nombre: '',
          dni: '',
          nacimiento: '',
          edad: '',
          grado: '',
          turno: '',
          escuela: '',
          maestra: '',
          salud: '',
          desempeno: '',
          asignaturas: ''
        }));
        setPhotoPreview(null);
        setSinProblemasSalud(false);
        setCurrentChildIndex(prev => prev + 1);
        window.scrollTo(0, 0);
        return;
      }

      alert('¡Inscripción completada y guardada en la base de datos! Ahora puedes agendar tus turnos.');
      navigate('/agenda', { state: { ...paymentState, nombres: nuevosNombres } });
    } catch (error: any) {
      console.error('Error guardando ficha:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingFamily) {
    return (
      <div className="auth-layout" style={{ background: 'var(--color-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-primary)' }}>
          <span style={{ display: 'inline-block', fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>🔄</span>
          <p style={{ fontWeight: 'bold' }}>Buscando historial familiar...</p>
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (prefillMode === 'confirm_all') {
    return (
      <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
        <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-background)' }}>
          <button 
            type="button"
            onClick={() => navigate('/pago')} 
            style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
          >
            <ChevronLeft size={28} />
          </button>
          <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Perfil Familiar</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>Historial Encontrado</p>
        </div>

        <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
          <div style={{
            background: 'var(--color-background)',
            border: '2px solid var(--color-secondary)',
            borderRadius: '20px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.05)'
          }}>
            <span style={{ fontSize: '3rem' }}>👋</span>
            <h3 style={{ color: 'var(--color-primary)', margin: '1rem 0 0.5rem' }}>¡Hola de nuevo!</h3>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Hemos detectado que ya has completado la ficha de inscripción anteriormente.
            </p>
          </div>

          <div style={{
            border: '1px solid var(--color-gray-200)',
            borderRadius: '16px',
            padding: '1.2rem',
            background: '#F9FAFB'
          }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.8rem', fontSize: '0.95rem' }}>
              Niños registrados en tu familia:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {existingAlumnos.map((alum, idx) => (
                <div key={alum.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid var(--color-gray-200)'
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 'bold'
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--color-primary)' }}>{alum.nombre}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>DNI: {alum.dni} | Grado: {alum.grado}°</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FCD34D',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            color: '#B45309',
            lineHeight: '1.4'
          }}>
            👉 Si los datos de tus hijos y contactos siguen siendo los mismos, puedes omitir la carga manual y continuar directo a reservar los turnos del mes.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto' }}>
            <button 
              type="button"
              onClick={handleQuickConfirm}
              disabled={isSubmitting}
              className="btn btn-primary btn-block"
              style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              {isSubmitting ? 'Confirmando...' : 'Sí, los datos siguen siendo los mismos'}
            </button>
            
            <button 
              type="button"
              onClick={() => setPrefillMode('none')}
              className="btn btn-outline btn-block"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              No, quiero revisar o modificar las fichas
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (prefillMode === 'new_sibling') {
    return (
      <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
        <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-background)' }}>
          <button 
            type="button"
            onClick={() => navigate('/pago')} 
            style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
          >
            <ChevronLeft size={28} />
          </button>
          <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Perfil Familiar</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>Inscripción de Hermano</p>
        </div>

        <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
          <div style={{
            background: 'var(--color-background)',
            border: '2px solid var(--color-secondary)',
            borderRadius: '20px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.05)'
          }}>
            <span style={{ fontSize: '3rem' }}>👦👧</span>
            <h3 style={{ color: 'var(--color-primary)', margin: '1rem 0 0.5rem' }}>¡Hola de nuevo!</h3>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Encontramos tu cuenta familiar. Tienes registrado/a a: <strong>{existingAlumnos.map(a => a.nombre).join(', ')}</strong>.
            </p>
          </div>

          <div style={{
            border: '1px solid var(--color-gray-200)',
            borderRadius: '16px',
            padding: '1.2rem',
            background: '#F9FAFB'
          }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.8rem', fontSize: '0.95rem' }}>
              ¿Qué haremos ahora?
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--color-gray-600)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Confirmaremos automáticamente la ficha de {existingAlumnos.map(a => a.nombre).join(' y ')}.</li>
              <li>Pre-completaremos los datos familiares compartidos (contacto de emergencia, autorizados de retiro y obra social).</li>
              <li>Solo tendrás que completar los datos específicos (personales, escuela y salud) del nuevo hermano/a.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto' }}>
            <button 
              type="button"
              onClick={handleStartNewSibling}
              className="btn btn-primary btn-block"
              style={{ padding: '1rem' }}
            >
              Completar Ficha del Hermano/a
            </button>
            
            <button 
              type="button"
              onClick={() => setPrefillMode('none')}
              className="btn btn-outline btn-block"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              Quiero llenar todas las fichas desde cero
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (prefillMode === 'selector') {
    return (
      <div className="auth-layout" style={{ background: 'var(--color-white)' }}>
        <div className="auth-header" style={{ paddingBottom: '1rem', background: 'var(--color-background)' }}>
          <button 
            type="button"
            onClick={() => navigate('/pago')} 
            style={{ background: 'none', border: 'none', position: 'absolute', left: '1rem', top: '2rem', cursor: 'pointer', color: 'var(--color-primary)' }}
          >
            <ChevronLeft size={28} />
          </button>
          <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>Perfil Familiar</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>Selección de Alumnos</p>
        </div>

        <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
          <div style={{
            background: 'var(--color-background)',
            border: '2px solid var(--color-secondary)',
            borderRadius: '20px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.05)'
          }}>
            <span style={{ fontSize: '3rem' }}>🤔</span>
            <h3 style={{ color: 'var(--color-primary)', margin: '1rem 0 0.5rem' }}>¿Quiénes asistirán?</h3>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Tienes <strong>{existingAlumnos.length} niños</strong> registrados, pero contrataste el servicio para <strong>{totalChildren} niño/s</strong> este mes.
            </p>
            <p style={{ color: 'var(--color-secondary)', fontWeight: 'bold', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
              Selecciona exactamente {totalChildren} {totalChildren === 1 ? 'niño' : 'niños'}:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {existingAlumnos.map((alum) => {
              const isChecked = selectedSiblingIds.includes(alum.id);
              return (
                <div 
                  key={alum.id}
                  onClick={() => handleSiblingCheckboxChange(alum.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: isChecked ? 'var(--color-background)' : 'white',
                    borderRadius: '16px',
                    border: `2px solid ${isChecked ? 'var(--color-secondary)' : 'var(--color-gray-200)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} 
                    style={{ width: '20px', height: '20px', pointerEvents: 'none' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--color-primary)' }}>{alum.nombre}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>DNI: {alum.dni} | Grado: {alum.grado}°</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto' }}>
            <button 
              type="button"
              onClick={handleConfirmSelectedSiblings}
              disabled={selectedSiblingIds.length !== totalChildren || isSubmitting}
              className="btn btn-primary btn-block"
              style={{
                padding: '1rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: selectedSiblingIds.length !== totalChildren ? 0.5 : 1
              }}
            >
              {isSubmitting ? 'Confirmando...' : `Confirmar y Continuar a Reservar`}
            </button>
            
            <button 
              type="button"
              onClick={() => setPrefillMode('none')}
              className="btn btn-outline btn-block"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              Registrar un niño nuevo en la familia
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        {totalChildren > 1 && (
          <span style={{
            position: 'absolute',
            right: '1rem',
            top: '2rem',
            background: 'var(--color-secondary)',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '100px',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            Ficha {currentChildIndex + 1} de {totalChildren}
          </span>
        )}
        <h2 style={{ color: 'var(--color-primary)', marginTop: '0.5rem' }}>
          Ficha del Alumno
        </h2>
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
