require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.DATABASE_URL) {
  console.error('Falta la variable de entorno DATABASE_URL (cadena de conexión a Postgres).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

/* Envuelve rutas async para que los errores no tumben el servidor */
const ah = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

const SEED_EVENTS = [
  { id: '1', title: 'Reunión PVEM', date: '2026-09-01', start: '09:00', end: '10:00', location: '', description: '', notes: '', priority: 'media', category: 'trabajo', status: 'pendiente', reminder: false },
  { id: '2', title: 'Gym', date: '2026-09-03', start: '07:00', end: '08:00', location: '', description: '', notes: '', priority: 'media', category: 'salud', status: 'pendiente', reminder: false },
  { id: '4', title: 'Desayuno', date: '2026-09-16', start: '08:00', end: '08:30', location: '', description: 'Tiempo personal', notes: '', priority: 'baja', category: 'personal', status: 'pendiente', reminder: false },
  { id: '6', title: 'Reunión equipo', date: '2026-09-16', start: '11:00', end: '12:00', location: 'Sala de juntas', description: '', notes: '', priority: 'alta', category: 'eventos', status: 'pendiente', reminder: true },
  { id: '7', title: 'Comida', date: '2026-09-16', start: '14:00', end: '15:00', location: '', description: 'Con Ana', notes: '', priority: 'media', category: 'familia', status: 'pendiente', reminder: false },
];
const SEED_NOTES = [
  { id: 'n1', text: 'Ideas para el proyecto 2027', done: false },
  { id: 'n2', text: 'Lista de compras', done: false },
];

function rowToEvent(r) {
  return { id: r.id, title: r.title, date: r.date, start: r.start_time, end: r.end_time,
    location: r.location, description: r.description, notes: r.notes, priority: r.priority,
    category: r.category, status: r.status, reminder: r.reminder };
}

async function insertEvent(data) {
  const id = data.id || randomUUID();
  await pool.query(
    `INSERT INTO events (id,title,date,start_time,end_time,location,description,notes,priority,category,status,reminder)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, data.title || '', data.date || '', data.start || '', data.end || '', data.location || '',
     data.description || '', data.notes || '', data.priority || 'media', data.category || 'otros',
     data.status || 'pendiente', !!data.reminder]
  );
  return { ...data, id };
}
async function insertNote(data) {
  const id = data.id || randomUUID();
  await pool.query('INSERT INTO notes (id,text,done) VALUES ($1,$2,$3)', [id, data.text || '', !!data.done]);
  return { id, text: data.text || '', done: !!data.done };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, title TEXT, date TEXT, start_time TEXT, end_time TEXT,
      location TEXT, description TEXT, notes TEXT, priority TEXT, category TEXT,
      status TEXT, reminder BOOLEAN
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, text TEXT, done BOOLEAN
    );
  `);
  const { rows } = await pool.query('SELECT COUNT(*) FROM events');
  if (parseInt(rows[0].count, 10) === 0) {
    for (const ev of SEED_EVENTS) await insertEvent(ev);
    for (const n of SEED_NOTES) await insertNote(n);
  }
}

/* ---------- Events ---------- */
app.get('/api/events', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY date, start_time');
  res.json(rows.map(rowToEvent));
}));

app.get('/api/events/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(rowToEvent(rows[0]));
}));

app.post('/api/events', ah(async (req, res) => {
  const ev = await insertEvent(req.body);
  res.status(201).json(ev);
}));

app.put('/api/events/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado' });
  const merged = { ...rowToEvent(rows[0]), ...req.body, id: req.params.id };
  await pool.query(
    `UPDATE events SET title=$1,date=$2,start_time=$3,end_time=$4,location=$5,description=$6,
     notes=$7,priority=$8,category=$9,status=$10,reminder=$11 WHERE id=$12`,
    [merged.title, merged.date, merged.start, merged.end, merged.location, merged.description,
     merged.notes, merged.priority, merged.category, merged.status, !!merged.reminder, req.params.id]
  );
  res.json(merged);
}));

app.delete('/api/events/:id', ah(async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

/* ---------- Vistas de calendario ---------- */
app.get('/api/calendar/day/:date', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events WHERE date=$1 ORDER BY start_time', [req.params.date]);
  res.json(rows.map(rowToEvent));
}));

app.get('/api/calendar/week/:date', ah(async (req, res) => {
  const d = new Date(req.params.date + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  const start = new Date(d); start.setDate(d.getDate() - dow);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const s = start.toISOString().slice(0, 10), e = end.toISOString().slice(0, 10);
  const { rows } = await pool.query('SELECT * FROM events WHERE date>=$1 AND date<=$2 ORDER BY date, start_time', [s, e]);
  res.json(rows.map(rowToEvent));
}));

app.get('/api/calendar/month/:year/:month', ah(async (req, res) => {
  const mm = String(req.params.month).padStart(2, '0');
  const prefix = `${req.params.year}-${mm}`;
  const { rows } = await pool.query('SELECT * FROM events WHERE date LIKE $1 ORDER BY date, start_time', [`${prefix}%`]);
  res.json(rows.map(rowToEvent));
}));

/* ---------- Notas ---------- */
app.get('/api/notes', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notes');
  res.json(rows);
}));

app.post('/api/notes', ah(async (req, res) => {
  const note = await insertNote(req.body);
  res.status(201).json(note);
}));

app.put('/api/notes/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notes WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Nota no encontrada' });
  const merged = { ...rows[0], ...req.body, id: req.params.id };
  await pool.query('UPDATE notes SET text=$1, done=$2 WHERE id=$3', [merged.text, !!merged.done, req.params.id]);
  res.json(merged);
}));

app.delete('/api/notes/:id', ah(async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log(`Calendario compartido (Postgres) corriendo en el puerto ${PORT}`)))
  .catch(err => { console.error('Error inicializando la base de datos:', err); process.exit(1); });
