// routes/appointments.js — REST-маршрути для ресурсу "Записи на прийом"
//
// Endpoint                     | Метод  | Опис
// ─────────────────────────────────────────────────────────────────────────────
// /api/appointments             | GET    | Отримати всі записи (з даними лікаря)
// /api/appointments/:id         | GET    | Отримати запис за ID
// /api/appointments             | POST   | Створити новий запис на прийом
// /api/appointments/:id/status  | PATCH  | Оновити статус запису
// /api/appointments/:id         | DELETE | Скасувати (видалити) запис

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── GET /api/appointments ─────────────────────────────────────────────────────
// Повертає всі записи разом з ім'ям та спеціальністю лікаря.
// Фільтрація: ?status=pending|confirmed|cancelled&doctor_id=1
router.get('/', (req, res) => {
  const { status, doctor_id } = req.query;

  let query = `
    SELECT a.id,
           a.patient_name,
           a.date,
           a.time,
           a.status,
           d.id        AS doctor_id,
           d.name      AS doctor_name,
           d.specialty AS doctor_specialty
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE 1=1
  `;
  const args = [];

  if (status) {
    query += ' AND a.status = ?';
    args.push(status);
  }
  if (doctor_id) {
    query += ' AND a.doctor_id = ?';
    args.push(Number(doctor_id));
  }

  query += ' ORDER BY a.date, a.time';

  const rows = db.prepare(query).all(...args);

  // Форматуємо відповідь — вкладений об'єкт doctor
  const appointments = rows.map(r => ({
    id:           r.id,
    patient_name: r.patient_name,
    date:         r.date,
    time:         r.time,
    status:       r.status,
    doctor: {
      id:        r.doctor_id,
      name:      r.doctor_name,
      specialty: r.doctor_specialty,
    },
  }));

  res.json({ success: true, data: appointments });
});

// ── GET /api/appointments/:id ─────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT a.id, a.patient_name, a.date, a.time, a.status,
           d.id AS doctor_id, d.name AS doctor_name, d.specialty AS doctor_specialty
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!row) {
    return res.status(404).json({ success: false, message: 'Запис не знайдено' });
  }

  res.json({
    success: true,
    data: {
      id:           row.id,
      patient_name: row.patient_name,
      date:         row.date,
      time:         row.time,
      status:       row.status,
      doctor: {
        id:        row.doctor_id,
        name:      row.doctor_name,
        specialty: row.doctor_specialty,
      },
    },
  });
});

// ── POST /api/appointments ────────────────────────────────────────────────────
// Тіло запиту: { patient_name, doctor_id, date, time }
// Приклад: { "patient_name":"Іван Петренко", "doctor_id":1, "date":"2026-06-01", "time":"10:00" }
router.post('/', (req, res) => {
  const { patient_name, doctor_id, date, time } = req.body;

  if (!patient_name || !doctor_id || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'Обов\'язкові поля: patient_name, doctor_id, date, time',
    });
  }

  // Перевіряємо чи лікар існує та доступний
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctor_id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Лікаря не знайдено' });
  }
  if (!doctor.available) {
    return res.status(409).json({ success: false, message: 'Лікар недоступний для запису' });
  }

  // Перевірка на дублікат: той самий лікар, та ж дата і час
  const conflict = db.prepare(
    'SELECT id FROM appointments WHERE doctor_id=? AND date=? AND time=? AND status != "cancelled"'
  ).get(doctor_id, date, time);

  if (conflict) {
    return res.status(409).json({
      success: false,
      message: 'Цей час вже зайнятий у вибраного лікаря',
    });
  }

  const result = db
    .prepare('INSERT INTO appointments (patient_name, doctor_id, date, time, status) VALUES (?,?,?,?,?)')
    .run(patient_name, doctor_id, date, time, 'pending');

  const newAppt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: { ...newAppt, doctor } });
});

// ── PATCH /api/appointments/:id/status ───────────────────────────────────────
// Тіло запиту: { status: "confirmed" | "cancelled" | "pending" }
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Статус має бути одним з: ${validStatuses.join(', ')}`,
    });
  }

  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Запис не знайдено' });
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

// ── DELETE /api/appointments/:id ──────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Запис не знайдено' });
  }

  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: `Запис з ID ${req.params.id} видалено` });
});

module.exports = router;
