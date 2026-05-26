// server.js — Головний сервер Express
// Підключає REST-маршрути (doctors, appointments, auth) та GraphQL endpoint

const express    = require('express');
const cors       = require('cors');
const { graphqlHTTP } = require('express-graphql');
const schema     = require('./graphql/schema');
const doctorsRouter      = require('./routes/doctors');
const appointmentsRouter = require('./routes/appointments');
const authRouter         = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Привітальний маршрут ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🏥 Doctor Appointment API',
    rest_docs:    `http://localhost:${PORT}/api`,
    graphiql_url: `http://localhost:${PORT}/graphql`,
    endpoints: {
      REST: {
        login:        'POST /api/login',
        register:     'POST /api/register',
        doctors:      'GET/POST  /api/doctors',
        doctor:       'GET/PUT/DELETE /api/doctors/:id',
        appointments: 'GET/POST  /api/appointments',
        appointment:  'GET/PATCH/DELETE /api/appointments/:id',
        appt_status:  'PATCH /api/appointments/:id/status',
      },
      GraphQL: 'POST /graphql  (GraphiQL доступний у браузері)',
    },
  });
});

// ─── REST API ─────────────────────────────────────────────────────────────────
app.use('/api',              authRouter);          // /api/login, /api/register
app.use('/api/doctors',      doctorsRouter);
app.use('/api/appointments', appointmentsRouter);

// ─── GraphQL ──────────────────────────────────────────────────────────────────
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    graphiql: true,
    customFormatErrorFn: (err) => ({
      message:   err.message,
      locations: err.locations,
      path:      err.path,
    }),
  })
);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Маршрут ${req.originalUrl} не знайдено` });
});

// ─── Глобальний обробник помилок ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: 'Внутрішня помилка сервера' });
});

// ─── Запуск сервера ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('─────────────────────────────────────────────────');
  console.log(`🚀 REST API    → http://localhost:${PORT}/api`);
  console.log(`🔍 GraphiQL    → http://localhost:${PORT}/graphql`);
  console.log(`👤 Тест логін  → doctor1 / 1234  (лікар)`);
  console.log(`👤 Тест логін  → patient / 1234  (пацієнт)`);
  console.log('─────────────────────────────────────────────────');
});

module.exports = app;
