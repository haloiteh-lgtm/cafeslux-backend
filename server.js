require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');

const authRoutes = require('./src/routes/auth.routes');
const menuRoutes = require('./src/routes/menu.routes');
const ordersRoutes = require('./src/routes/orders.routes');
const customersRoutes = require('./src/routes/customers.routes');
const giftcardsRoutes = require('./src/routes/giftcards.routes');
const employeesRoutes = require('./src/routes/employees.routes');
const reservationsRoutes = require('./src/routes/reservations.routes');
const stockRoutes = require('./src/routes/stock.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const publicRoutes = require('./src/routes/public.routes');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  credentials: true,
};

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

const io = new Server(server, { cors: corsOptions });
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

app.get('/', (req, res) => res.json({ ok: true, service: 'cafeslux-api', version: '13.0.0' }));
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/auth', authRoutes);
app.use('/api', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/giftcards', giftcardsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', publicRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur', details: err.message });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => console.log(`[Café LUX API] listening on port ${PORT}`));
