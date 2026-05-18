// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default columns
  const columns = await Promise.all([
    prisma.column.upsert({ where: { id: 'col-todo' }, update: {}, create: { id: 'col-todo', label: 'To Do', color: '#6c63ff', order: 0 } }),
    prisma.column.upsert({ where: { id: 'col-inprogress' }, update: {}, create: { id: 'col-inprogress', label: 'In Progress', color: '#ffc94d', order: 1 } }),
    prisma.column.upsert({ where: { id: 'col-review' }, update: {}, create: { id: 'col-review', label: 'In Review', color: '#ff9f43', order: 2 } }),
    prisma.column.upsert({ where: { id: 'col-done' }, update: {}, create: { id: 'col-done', label: 'Done', color: '#43d9ad', order: 3 } }),
  ]);
  console.log(`✅ Created ${columns.length} columns`);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ifhe.ac.in' },
    update: {},
    create: {
      email: 'admin@ifhe.ac.in',
      name: 'V. Professor',
      initials: 'VP',
      passwordHash: await bcrypt.hash('Admin@1234', 12),
      role: 'ADMIN',
      avatarColor: 'linear-gradient(135deg,#6c63ff,#ff6584)',
    },
  });
  console.log(`✅ Admin user: ${admin.email} / password: Admin@1234`);

  console.log('✅ Seeding complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
