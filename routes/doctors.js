// routes/doctors.js — REST-маршрути для ресурсу "Лікарі"
//
// Endpoint          | Метод  | Опис
// ─────────────────────────────────────────────────────────────
// /api/doctors      | GET    | Отримати всіх лікарів
// /api/doctors/:id  | GET    | Отримати лікаря за ID
// /api/doctors      | POST   | Додати нового лікаря
// /api/doctors/:id  | PUT    | Оновити дані лікаря
// /api/doctors/:id  | DELETE | Видалити лікаря

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── GET /api/doctors ─────────────────────────────────────────────────────────
// Повертає список усіх лікарів. Фільтрація за ?available=1 або ?specialty=...
router.get('/', (req, res) => {
  const { available, specialty } = req.query;

  let query  = 'SELECT * FROM doctors WHERE 1=1';
  const args = [];

  if (available !== undefined) {
    query += ' AND available = ?';
    args.push(Number(available));
  }
  if (specialty) {
    query += ' AND specialty LIKE ?';
    args.push(`%${specialty}%`);
  }

  const doctors = db.prepare(query).all(...args);
  res.json({ success: true, data: doctors });
});

// ── GET /api/doctors/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Лікаря не знайдено' });
  }
  res.json({ success: true, data: doctor });
});

// ── POST /api/doctors ─────────────────────────────────────────────────────────
// Тіло запиту: { name, specialty, available }
router.post('/', (req, res) => {
  const { name, specialty, available = 1 } = req.body;

  if (!name || !specialty) {
    return res.status(400).json({
      success: false,
      message: 'Поля name та specialty є обов\'язковими',
    });
  }

  const result = db
    .prepare('INSERT INTO doctors (name, specialty, available) VALUES (?, ?, ?)')
    .run(name, specialty, available);

  const newDoctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: newDoctor });
});

// ── PUT /api/doctors/:id ──────────────────────────────────────────────────────
// Тіло запиту: { name?, specialty?, available? }
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Лікаря не знайдено' });
  }

  const name      = req.body.name      ?? existing.name;
  const specialty = req.body.specialty ?? existing.specialty;
  const available = req.body.available ?? existing.available;

  db.prepare('UPDATE doctors SET name=?, specialty=?, available=? WHERE id=?')
    .run(name, specialty, available, req.params.id);

  const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

// ── DELETE /api/doctors/:id ───────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Лікаря не знайдено' });
  }

  db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: `Лікаря з ID ${req.params.id} видалено` });
});

module.exports = router;
