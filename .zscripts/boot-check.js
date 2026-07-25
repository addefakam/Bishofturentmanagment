// boot-check.js — Pre-flight check for GHMS standalone deployment
// Run: node boot-check.js
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const errors = [];
const warnings = [];

function check(label, ok, detail) {
  if (ok) {
    console.log(`  [OK] ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
    errors.push(label);
  }
}

function warn(label, detail) {
  console.log(`  [WARN] ${label}${detail ? ' — ' + detail : ''}`);
  warnings.push(label);
}

console.log('=== GHMS Boot Check ===');
console.log('CWD:', cwd);
console.log('Node:', process.version);
console.log('Arch:', process.arch);
console.log('Platform:', process.platform);
console.log('');

// 1. server.js
check('server.js exists', fs.existsSync(path.join(cwd, 'server.js')));

// 2. Database
const dbPath = path.join(cwd, 'db/custom.db');
check('db/custom.db exists', fs.existsSync(dbPath),
  fs.existsSync(dbPath) ? (fs.statSync(dbPath).size + ' bytes') : '');

// 3. .env
const envPath = path.join(cwd, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  check('.env exists', true);
  check('DATABASE_URL in .env', !!match, match ? match[1] : '');
  if (match) {
    process.env.DATABASE_URL = match[1].trim();
  }
} else {
  check('.env exists', false, 'file not found');
}

// 4. DATABASE_URL env var
check('DATABASE_URL env set', !!process.env.DATABASE_URL, process.env.DATABASE_URL || '');

// 5. Next.js module
try {
  require('next');
  check('next module', true);
} catch (e) {
  check('next module', false, e.message);
}

// 6. Prisma client
try {
  const { PrismaClient } = require('@prisma/client');
  check('@prisma/client module', true);
} catch (e) {
  check('@prisma/client module', false, e.message);
}

// 7. Prisma engine native binary
const enginePath = path.join(cwd, 'node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node');
if (fs.existsSync(enginePath)) {
  try {
    require(enginePath);
    check('Prisma native engine', true, 'loaded successfully');
  } catch (e) {
    check('Prisma native engine', false, e.message);
    // Check if it's a shared lib issue
    if (e.message.includes('cannot open shared object file') || e.message.includes('dlopen')) {
      warn('Missing shared library', 'The container may lack libssl.so.3 or similar');
    }
    // Check WASM fallback
    const wasmPath = path.join(cwd, 'node_modules/.prisma/client/query_engine_bg.wasm');
    check('Prisma WASM fallback', fs.existsSync(wasmPath));
  }
} else {
  warn('Prisma native engine', 'file not found (WASM will be used)');
  const wasmPath = path.join(cwd, 'node_modules/.prisma/client/query_engine_bg.wasm');
  check('Prisma WASM fallback', fs.existsSync(wasmPath));
}

// 8. Test actual DB connection
if (process.env.DATABASE_URL && fs.existsSync(dbPath)) {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.$connect().then(() => {
      check('DB connection', true, 'connected successfully');
      return prisma.$queryRaw`SELECT count(*) as count FROM sqlite_master`;
    }).then((result) => {
      check('DB query', true, `${result[0].count} tables`);
      return prisma.$disconnect();
    }).catch((e) => {
      check('DB connection', false, e.message);
      console.log('');
      console.log('=== SUMMARY ===');
      console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}`);
      if (errors.length > 0) process.exit(1);
    });
  } catch (e) {
    check('DB connection test', false, e.message);
  }
} else {
  warn('DB connection test', 'skipped (no DATABASE_URL or db file)');
}

// Delayed summary (wait for async DB test)
setTimeout(() => {
  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}`);
  if (errors.length > 0) {
    console.log('Failed checks:', errors.join(', '));
    process.exit(1);
  } else {
    console.log('All checks passed!');
    process.exit(0);
  }
}, 3000);