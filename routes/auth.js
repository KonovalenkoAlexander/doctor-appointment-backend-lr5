// routes/auth.js — Маршрути автентифікації
//
// Endpoint         | Метод | Опис
// ─────────────────────────────────────────────────────────
// /api/login       | POST  | Вхід в систему
// /api/register    | POST  | Реєстрація нового пацієнта

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── POST /api/login ───────────────────────────────────────────────────────────
// Тіло: { login, password }
// Відповідь: { token, role, name, id, doctor_id }
router.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Логін та пароль є обов\'язковими' });
  }

  // ✅ ВИПРАВЛЕННЯ: шукаємо тільки по login, пароль порівнюємо в JS
  // Причина: coerceParams у db.js конвертує '1234' → 1234 (число),
  // а alasql порівнює рядок '1234' === 1234 як false → "невірний пароль".
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);

  if (!user) {
    return res.status(401).json({ error: 'Невірний логін або пароль' });
  }

  // Порівнюємо паролі як рядки (String → String), щоб уникнути проблеми типів
  if (String(user.password) !== String(password)) {
    return res.status(401).json({ error: 'Невірний логін або пароль' });
  }

  res.json({
    token:     `token-${user.id}-${Date.now()}`, // Простий токен (без JWT для простоти)
    role:      user.role,
    name:      user.name,
    id:        user.id,
    doctor_id: user.doctor_id || null,
  });
});

// ── POST /api/register ────────────────────────────────────────────────────────
// Тіло: { name, login, password }
// Відповідь: { success, message }
router.post('/register', (req, res) => {
  const { name, login, password } = req.body;

  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Всі поля є обов\'язковими: name, login, password' });
  }

  // Перевірка на дублікат логіну
  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (existing) {
    return res.status(409).json({ error: 'Такий логін вже існує. Оберіть інший.' });
  }

  db.prepare('INSERT INTO users (name, login, password, role, doctor_id) VALUES (?, ?, ?, ?, ?)')
    .run(name, login, password, 'patient', 0);

  res.status(201).json({ success: true, message: 'Реєстрація успішна!' });
});

module.exports = router;
