const { PrismaClient } = require('@prisma/client');

// Reuse a single instance (important on serverless / hot-reload)
const prisma = global._prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

module.exports = prisma;
