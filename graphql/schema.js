// graphql/schema.js — Визначення GraphQL-схеми
//
// Схема описує всі типи об'єктів, поля та операції (Query і Mutation),
// які підтримує наш GraphQL API.

const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLID,
} = require('graphql');

const db = require('../db');

// ─── Тип "Лікар" ─────────────────────────────────────────────────────────────

const DoctorType = new GraphQLObjectType({
  name: 'Doctor',
  description: 'Лікар, доступний для запису на прийом',
  fields: () => ({
    id:        { type: new GraphQLNonNull(GraphQLID),     description: 'Унікальний ідентифікатор' },
    name:      { type: new GraphQLNonNull(GraphQLString), description: 'ПІБ лікаря' },
    specialty: { type: new GraphQLNonNull(GraphQLString), description: 'Спеціальність лікаря' },
    available: { type: new GraphQLNonNull(GraphQLBoolean),description: 'Доступний для запису',
      // SQLite зберігає 0/1, GraphQL потребує Boolean
      resolve: (parent) => Boolean(parent.available),
    },
    // Пов'язані записи — наявність зворотного зв'язку
    appointments: {
      type:        new GraphQLList(AppointmentType),
      description: 'Усі записи до цього лікаря',
      resolve: (parent) =>
        db.prepare('SELECT * FROM appointments WHERE doctor_id = ?').all(parent.id),
    },
  }),
});

// ─── Тип "Запис на прийом" ────────────────────────────────────────────────────

const AppointmentType = new GraphQLObjectType({
  name: 'Appointment',
  description: 'Запис пацієнта на прийом до лікаря',
  fields: () => ({
    id:           { type: new GraphQLNonNull(GraphQLID),     description: 'Унікальний ідентифікатор' },
    patient_name: { type: new GraphQLNonNull(GraphQLString), description: 'Ім\'я пацієнта' },
    date:         { type: new GraphQLNonNull(GraphQLString), description: 'Дата прийому (YYYY-MM-DD)' },
    time:         { type: new GraphQLNonNull(GraphQLString), description: 'Час прийому (HH:MM)' },
    status:       { type: new GraphQLNonNull(GraphQLString), description: 'Статус: pending | confirmed | cancelled' },
    // Резолвер для вкладеного об'єкта Doctor
    doctor: {
      type:        new GraphQLNonNull(DoctorType),
      description: 'Лікар, до якого здійснено запис',
      resolve: (parent) =>
        db.prepare('SELECT * FROM doctors WHERE id = ?').get(parent.doctor_id),
    },
  }),
});

// ─── Кореневий тип Query ──────────────────────────────────────────────────────

const RootQuery = new GraphQLObjectType({
  name: 'Query',
  description: 'Кореневий тип для читання даних',
  fields: {
    // Отримати всіх лікарів
    doctors: {
      type:        new GraphQLList(DoctorType),
      description: 'Список усіх лікарів',
      args: {
        available: { type: GraphQLBoolean, description: 'Фільтр: тільки доступні лікарі' },
        specialty:  { type: GraphQLString,  description: 'Фільтр за спеціальністю' },
      },
      resolve: (_, args) => {
        let query  = 'SELECT * FROM doctors WHERE 1=1';
        const params = [];

        if (args.available !== undefined) {
          query += ' AND available = ?';
          params.push(args.available ? 1 : 0);
        }
        if (args.specialty) {
          query += ' AND specialty LIKE ?';
          params.push(`%${args.specialty}%`);
        }

        return db.prepare(query).all(...params);
      },
    },

    // Отримати одного лікаря за ID
    doctor: {
      type:        DoctorType,
      description: 'Лікар за його унікальним ID',
      args: {
        id: { type: new GraphQLNonNull(GraphQLID), description: 'ID лікаря' },
      },
      resolve: (_, args) =>
        db.prepare('SELECT * FROM doctors WHERE id = ?').get(args.id),
    },

    // Отримати всі записи на прийом
    appointments: {
      type:        new GraphQLList(AppointmentType),
      description: 'Список усіх записів на прийом',
      args: {
        status:    { type: GraphQLString, description: 'Фільтр за статусом' },
        doctor_id: { type: GraphQLID,     description: 'Фільтр за ID лікаря' },
      },
      resolve: (_, args) => {
        let query  = 'SELECT * FROM appointments WHERE 1=1';
        const params = [];

        if (args.status) {
          query += ' AND status = ?';
          params.push(args.status);
        }
        if (args.doctor_id) {
          query += ' AND doctor_id = ?';
          params.push(Number(args.doctor_id));
        }

        return db.prepare(query).all(...params);
      },
    },

    // Отримати один запис за ID
    appointment: {
      type:        AppointmentType,
      description: 'Запис на прийом за його унікальним ID',
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: (_, args) =>
        db.prepare('SELECT * FROM appointments WHERE id = ?').get(args.id),
    },
  },
});

// ─── Кореневий тип Mutation ────────────────────────────────────────────────────

const RootMutation = new GraphQLObjectType({
  name: 'Mutation',
  description: 'Кореневий тип для зміни даних',
  fields: {
    // Створити новий запис на прийом
    createAppointment: {
      type:        AppointmentType,
      description: 'Записати пацієнта на прийом до лікаря',
      args: {
        patient_name: { type: new GraphQLNonNull(GraphQLString), description: 'Ім\'я пацієнта' },
        doctor_id:    { type: new GraphQLNonNull(GraphQLID),     description: 'ID лікаря' },
        date:         { type: new GraphQLNonNull(GraphQLString), description: 'Дата (YYYY-MM-DD)' },
        time:         { type: new GraphQLNonNull(GraphQLString), description: 'Час (HH:MM)' },
      },
      resolve: (_, args) => {
        const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(args.doctor_id);
        if (!doctor)           throw new Error('Лікаря не знайдено');
        if (!doctor.available) throw new Error('Лікар недоступний для запису');

        const conflict = db.prepare(
          'SELECT id FROM appointments WHERE doctor_id=? AND date=? AND time=? AND status != "cancelled"'
        ).get(args.doctor_id, args.date, args.time);
        if (conflict) throw new Error('Цей час вже зайнятий у вибраного лікаря');

        const result = db
          .prepare('INSERT INTO appointments (patient_name, doctor_id, date, time, status) VALUES (?,?,?,?,?)')
          .run(args.patient_name, args.doctor_id, args.date, args.time, 'pending');

        return db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
      },
    },

    // Оновити статус запису
    updateAppointmentStatus: {
      type:        AppointmentType,
      description: 'Змінити статус запису (pending / confirmed / cancelled)',
      args: {
        id:     { type: new GraphQLNonNull(GraphQLID),     description: 'ID запису' },
        status: { type: new GraphQLNonNull(GraphQLString), description: 'Новий статус' },
      },
      resolve: (_, args) => {
        const validStatuses = ['pending', 'confirmed', 'cancelled'];
        if (!validStatuses.includes(args.status)) {
          throw new Error(`Статус має бути одним з: ${validStatuses.join(', ')}`);
        }
        const existing = db.prepare('SELECT id FROM appointments WHERE id = ?').get(args.id);
        if (!existing) throw new Error('Запис не знайдено');

        db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(args.status, args.id);
        return db.prepare('SELECT * FROM appointments WHERE id = ?').get(args.id);
      },
    },

    // Видалити запис
    deleteAppointment: {
      type:        GraphQLBoolean,
      description: 'Видалити запис на прийом',
      args: {
        id: { type: new GraphQLNonNull(GraphQLID), description: 'ID запису' },
      },
      resolve: (_, args) => {
        const existing = db.prepare('SELECT id FROM appointments WHERE id = ?').get(args.id);
        if (!existing) throw new Error('Запис не знайдено');

        db.prepare('DELETE FROM appointments WHERE id = ?').run(args.id);
        return true;
      },
    },

    // Додати нового лікаря
    addDoctor: {
      type:        DoctorType,
      description: 'Додати нового лікаря',
      args: {
        name:      { type: new GraphQLNonNull(GraphQLString) },
        specialty: { type: new GraphQLNonNull(GraphQLString) },
        available: { type: GraphQLBoolean, defaultValue: true },
      },
      resolve: (_, args) => {
        const result = db
          .prepare('INSERT INTO doctors (name, specialty, available) VALUES (?, ?, ?)')
          .run(args.name, args.specialty, args.available ? 1 : 0);
        return db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);
      },
    },
  },
});

// ─── Експорт схеми ────────────────────────────────────────────────────────────

module.exports = new GraphQLSchema({
  query:    RootQuery,
  mutation: RootMutation,
});
