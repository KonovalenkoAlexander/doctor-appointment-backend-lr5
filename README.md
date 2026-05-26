# 🏥 Doctor Appointment, REST + GraphQL Backend
> ЛР5 - Інженерія вебзастосунків

## Запуск

```bash
npm install
npm start          # або npm run dev (з auto-reload через nodemon)
```

Сервер запускається на **http://localhost:4000**

---

## REST API - Приклади запитів

### Лікарі

```
GET    http://localhost:4000/api/doctors              # Всі лікарі
GET    http://localhost:4000/api/doctors?available=1  # Тільки доступні
GET    http://localhost:4000/api/doctors/1            # Лікар з ID=1

POST   http://localhost:4000/api/doctors
Body:  { "name": "Петро Коваль", "specialty": "Хірург" }

PUT    http://localhost:4000/api/doctors/1
Body:  { "available": 0 }

DELETE http://localhost:4000/api/doctors/1
```

### Записи на прийом

```
GET    http://localhost:4000/api/appointments
GET    http://localhost:4000/api/appointments?status=pending
GET    http://localhost:4000/api/appointments/1

POST   http://localhost:4000/api/appointments
Body:  {
  "patient_name": "Іван Петренко",
  "doctor_id": 1,
  "date": "2026-06-15",
  "time": "10:00"
}

PATCH  http://localhost:4000/api/appointments/1/status
Body:  { "status": "confirmed" }

DELETE http://localhost:4000/api/appointments/1
```

---

## GraphQL - Приклади запитів

Відкрий **http://localhost:4000/graphql** у браузері - там доступний GraphiQL.

### Query: Отримати всіх лікарів

```graphql
query {
  doctors {
    id
    name
    specialty
    available
  }
}
```

### Query: Тільки доступні лікарі

```graphql
query {
  doctors(available: true) {
    id
    name
    specialty
  }
}
```

### Query: Лікар з його записами (вкладені дані)

```graphql
query {
  doctor(id: "1") {
    name
    specialty
    available
    appointments {
      id
      patient_name
      date
      time
      status
    }
  }
}
```

### Query: Всі записи з даними лікаря

```graphql
query {
  appointments {
    id
    patient_name
    date
    time
    status
    doctor {
      name
      specialty
    }
  }
}
```

### Query: Фільтрація записів за статусом

```graphql
query {
  appointments(status: "pending") {
    id
    patient_name
    date
    time
    doctor {
      name
    }
  }
}
```

### Mutation: Записати пацієнта

```graphql
mutation {
  createAppointment(
    patient_name: "Марія Іваненко"
    doctor_id: "1"
    date: "2026-06-20"
    time: "14:00"
  ) {
    id
    patient_name
    date
    time
    status
    doctor {
      name
    }
  }
}
```

### Mutation: Підтвердити запис

```graphql
mutation {
  updateAppointmentStatus(id: "1", status: "confirmed") {
    id
    status
    patient_name
  }
}
```

### Mutation: Видалити запис

```graphql
mutation {
  deleteAppointment(id: "1")
}
```

### Mutation: Додати лікаря

```graphql
mutation {
  addDoctor(
    name: "Сергій Мельник"
    specialty: "Офтальмолог"
    available: true
  ) {
    id
    name
    specialty
  }
}
```

---

## Структура проекту

```
doctor-appointment-backend/
├── index.js              # Точка входу
├── server.js             # Express-сервер (REST + GraphQL)
├── db.js                 # Ініціалізація SQLite бази даних
├── routes/
│   ├── doctors.js        # REST маршрути /api/doctors
│   └── appointments.js   # REST маршрути /api/appointments
├── graphql/
│   └── schema.js         # GraphQL схема (типи, Query, Mutation)
├── database.sqlite       # Файл бази даних (створюється автоматично)
└── package.json
```

## Залежності

| Пакет | Призначення |
|-------|------------|
| `express` | HTTP-сервер та маршрутизація |
| `express-graphql` | GraphQL middleware для Express |
| `graphql` | Ядро GraphQL (схема, типи, виконання) |
| `better-sqlite3` | Синхронний SQLite клієнт |
| `cors` | Cross-Origin Resource Sharing |
