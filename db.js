// db.js — База даних на основі alasql (чистий JavaScript, без нативної компіляції)

const alasql = require('alasql');
const fs     = require('fs');
const path   = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// ─── Лічильники для автоінкременту ID ────────────────────────────────────────
const seq = { doctors: 0, appointments: 0, users: 0 };

// ─── Створення таблиць в пам'яті ─────────────────────────────────────────────
alasql('CREATE TABLE doctors      (id INT, name STRING, specialty STRING, available INT)');
alasql('CREATE TABLE appointments (id INT, patient_name STRING, doctor_id INT, date STRING, time STRING, status STRING)');
alasql('CREATE TABLE users        (id INT, name STRING, login STRING, password STRING, role STRING, doctor_id INT)');

// ─── Завантаження даних з JSON-файлу ─────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DB_FILE)) return;
  try {
    const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (Array.isArray(saved.doctors) && saved.doctors.length) {
      alasql.tables.doctors.data = saved.doctors;
      seq.doctors = Math.max(...saved.doctors.map(d => d.id), 0);
    }
    if (Array.isArray(saved.appointments) && saved.appointments.length) {
      alasql.tables.appointments.data = saved.appointments;
      seq.appointments = Math.max(...saved.appointments.map(a => a.id), 0);
    }
    if (Array.isArray(saved.users) && saved.users.length) {
      alasql.tables.users.data = saved.users;
      seq.users = Math.max(...saved.users.map(u => u.id), 0);
    }
  } catch (e) {
    console.error('[DB] Помилка завантаження:', e.message);
  }
}

// ─── Збереження даних у JSON-файл ────────────────────────────────────────────
function saveData() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      doctors:      alasql.tables.doctors.data,
      appointments: alasql.tables.appointments.data,
      users:        alasql.tables.users.data,
    }, null, 2));
  } catch (e) {
    console.error('[DB] Помилка збереження:', e.message);
  }
}

loadData();

// ─── Початкові дані для лікарів ───────────────────────────────────────────────
if (!alasql.tables.doctors.data.length) {
  const seedDoctors = [
    { name: 'Олена Іванівна Ковальчук',   specialty: 'Терапевт',  available: 1 },
    { name: 'Микола Петрович Бойко',      specialty: 'Хірург',    available: 1 },
    { name: 'Наталія Сергіївна Мороз',    specialty: 'Педіатр',   available: 1 },
    { name: 'Андрій Васильович Шевченко', specialty: 'Кардіолог', available: 0 },
    { name: 'Ірина Олексіївна Гриценко',  specialty: 'Невролог',  available: 1 },
  ];
  seedDoctors.forEach(d => {
    seq.doctors++;
    alasql('INSERT INTO doctors VALUES ?', [{ id: seq.doctors, ...d }]);
  });
  console.log('[DB] Початкові дані лікарів завантажено.');
}

// ─── Початкові дані для користувачів ─────────────────────────────────────────
if (!alasql.tables.users.data.length) {
  // Лікарі-акаунти (прив'язані до записів у таблиці doctors)
  const seedUsers = [
    { name: 'Олена Іванівна Ковальчук',   login: 'doctor1', password: '1234', role: 'doctor',  doctor_id: 1 },
    { name: 'Микола Петрович Бойко',      login: 'doctor2', password: '1234', role: 'doctor',  doctor_id: 2 },
    { name: 'Наталія Сергіївна Мороз',    login: 'doctor3', password: '1234', role: 'doctor',  doctor_id: 3 },
    { name: 'Ірина Олексіївна Гриценко',  login: 'doctor5', password: '1234', role: 'doctor',  doctor_id: 5 },
    // Тестовий пацієнт
    { name: 'Тестовий Пацієнт',          login: 'patient',  password: '1234', role: 'patient', doctor_id: 0 },
  ];
  seedUsers.forEach(u => {
    seq.users++;
    alasql('INSERT INTO users VALUES ?', [{ id: seq.users, ...u }]);
  });
  saveData();
  console.log('[DB] Початкові дані користувачів завантажено.');
}

// ─── Конвертація параметрів ───────────────────────────────────────────────────
// ✅ ВИПРАВЛЕННЯ: НЕ конвертуємо рядки у числа автоматично.
// Причина: '1234' (пароль) → 1234 (число) ламало логін, бо alasql порівнює
// збережений рядок '1234' з числом 1234 як false (строга рівність).
// alasql сам коректно обробляє числові ID, передані як рядки ('1' → 1 у INT-полі).
function coerceParams(params) {
  return params; // Залишаємо типи без змін — alasql впорається сам
}

// ─── Перехоплення INSERT для автоінкременту ───────────────────────────────────
function patchInsert(sql, params) {
  const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (!match) return { sql, params, lastId: null };

  const table = match[1].toLowerCase();
  if (!(table in seq)) return { sql, params, lastId: null };

  seq[table]++;
  const lastId   = seq[table];
  const cols     = match[2];
  const qCount   = (sql.match(/\?/g) || []).length;
  const newMarks = Array(qCount + 1).fill('?').join(', ');
  const newSql   = `INSERT INTO ${match[1]} (id, ${cols}) VALUES (${newMarks})`;

  return { sql: newSql, params: [lastId, ...params], lastId };
}

// ─── API сумісний з better-sqlite3 ───────────────────────────────────────────
function prepare(sql) {
  return {
    all(...args) {
      const flatArgs = coerceParams(args.flat());
      try {
        return alasql(sql, flatArgs) || [];
      } catch (e) {
        console.error('[DB] all() error:', e.message, '\nSQL:', sql);
        return [];
      }
    },

    get(...args) {
      const flatArgs = coerceParams(args.flat());
      try {
        const results = alasql(sql, flatArgs);
        return (results && results[0]) ? results[0] : undefined;
      } catch (e) {
        console.error('[DB] get() error:', e.message, '\nSQL:', sql);
        return undefined;
      }
    },

    run(...args) {
      const flatArgs    = coerceParams(args.flat());
      const isInsert    = /^\s*INSERT/i.test(sql);
      let   finalSql    = sql;
      let   finalArgs   = flatArgs;
      let   lastId      = null;

      if (isInsert) {
        const patched = patchInsert(sql, flatArgs);
        finalSql  = patched.sql;
        finalArgs = patched.params;
        lastId    = patched.lastId;
      }

      try {
        alasql(finalSql, finalArgs);
        saveData();
        return { lastInsertRowid: lastId, changes: 1 };
      } catch (e) {
        console.error('[DB] run() error:', e.message, '\nSQL:', finalSql);
        return { lastInsertRowid: null, changes: 0 };
      }
    },
  };
}

function exec() {}

module.exports = { prepare, exec };
