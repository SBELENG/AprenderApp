import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Clock } from 'lucide-react';

const Intro: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-layout" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Imagen principal estratégica usando el recurso gráfico provisto */}
        <div style={{ 
          height: '45vh', 
          width: '100%', 
          backgroundImage: 'url("/recursos/Key Visual APRENDER.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative'
        }}>
          {/* Overlay oscuro para legibilidad */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(to bottom, rgba(30,58,95,0.2), var(--color-primary))'
          }}></div>
        </div>

        {/* Contenido principal */}
        <div style={{ padding: '0 2rem', marginTop: '-2rem', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="flex items-center justify-center mb-6">
            <img 
              src="/recursos/letra A.png" 
              alt="Aprender Logo" 
              style={{ width: '60px', height: '60px', borderRadius: '12px', background: 'white', padding: '5px', cursor: 'pointer' }} 
              onClick={() => navigate('/admin/asistencia')}
            />
          </div>

          <h1 className="text-center" style={{ color: 'var(--color-secondary)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>
            APRENDER
          </h1>
          <p className="text-center" style={{ fontSize: '1.1rem', color: 'var(--color-tertiary)', marginBottom: '2rem' }}>
            Academia de Apoyo Escolar Primario
          </p>

          {/* Características */}
          <div className="flex-col gap-4 mb-8" style={{ marginTop: 'auto' }}>
            <div className="flex items-center gap-4">
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%' }}>
                <ShieldCheck size={24} color="var(--color-secondary)" />
              </div>
              <div>
                <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '2px' }}>Seguridad total</h3>
                <p style={{ color: 'var(--color-gray-300)', fontSize: '0.9rem', margin: 0 }}>Notificaciones de ingreso y retiro en tiempo real</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%' }}>
                <BookOpen size={24} color="var(--color-secondary)" />
              </div>
              <div>
                <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '2px' }}>Seguimiento personalizado</h3>
                <p style={{ color: 'var(--color-gray-300)', fontSize: '0.9rem', margin: 0 }}>Fichas de evolución y comunicación diaria</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%' }}>
                <Clock size={24} color="var(--color-secondary)" />
              </div>
              <div>
                <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '2px' }}>Gestión fácil</h3>
                <p style={{ color: 'var(--color-gray-300)', fontSize: '0.9rem', margin: 0 }}>Agenda online y pagos desde tu celular</p>
              </div>
            </div>
          </div>

          <div className="flex-col gap-3" style={{ marginBottom: '2rem' }}>
            <button 
              className="btn btn-secondary btn-block" 
              style={{ display: 'flex', justifyContent: 'center', gap: '10px', padding: '1rem' }}
              onClick={() => navigate('/auth')}
            >
              Nueva Inscripción y Pago
              <ArrowRight size={20} />
            </button>
            <button 
              className="btn btn-outline btn-block" 
              style={{ display: 'flex', justifyContent: 'center', gap: '10px', padding: '1rem', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
              onClick={() => navigate('/agenda')}
            >
              Agendar mis horas
              <Clock size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Intro;
