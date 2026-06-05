const https = require('https');

const data = JSON.stringify({
  service_id: "service_3m8e6jr",
  template_id: "template_nvvkbjv",
  user_id: "jacwOgaxd2h-yic2Q",
  template_params: {
    to_email: "academia.aprender.lh@gmail.com",
    nombre_alumno: "Test Alumno",
    hora: "19:30",
    estado: "Presente",
    observaciones: "Prueba de funcionamiento"
  }
});

const options = {
  hostname: 'api.emailjs.com',
  port: 443,
  path: '/api/v1.0/email/send',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  console.log('statusCode:', res.statusCode);
  
  let body = '';
  res.on('data', (d) => {
    body += d;
  });
  
  res.on('end', () => {
    console.log('Response body:', body);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
