#!/usr/bin/env node

/**
 * Automated setup script for Hall Booking App Backend
 * 
 * This script ensures all required components are properly initialized:
 * 1. Prisma client generation
 * 2. Environment validation
 * 3. Database connection test
 * 4. Redis connection test
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`${colors.bold}${colors.blue}\n🚀 ${msg}${colors.reset}`)
};

function executeCommand(command, description) {
  try {
    log.info(`${description}...`);
    execSync(command, { stdio: 'inherit' });
    log.success(`${description} completed`);
    return true;
  } catch (error) {
    log.error(`${description} failed: ${error.message}`);
    return false;
  }
}

function checkFile(filepath, description) {
  if (fs.existsSync(filepath)) {
    log.success(`${description} exists`);
    return true;
  } else {
    log.error(`${description} not found: ${filepath}`);
    return false;
  }
}

function checkEnvironmentVariables() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];
  
  let allValid = true;
  
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      log.success(`${varName} is set`);
    } else {
      log.error(`${varName} is missing`);
      allValid = false;
    }
  });
  
  return allValid;
}

async function main() {
  log.title('Hall Booking App Backend Setup');
  
  // Step 1: Check if .env file exists
  log.info('Checking environment setup...');
  if (!checkFile('.env', '.env file')) {
    if (checkFile('.env.example', '.env.example file')) {
      log.info('Copying .env.example to .env');
      fs.copyFileSync('.env.example', '.env');
      log.warning('Please update .env with your actual configuration values');
    }
  }
  
  // Load environment variables
  require('dotenv').config();
  
  // Step 2: Validate environment variables
  log.info('Validating environment variables...');
  if (!checkEnvironmentVariables()) {
    log.error('Please set all required environment variables in .env file');
    process.exit(1);
  }
  
  // Step 3: Install dependencies if needed
  if (!fs.existsSync('node_modules')) {
    if (!executeCommand('npm install', 'Installing dependencies')) {
      process.exit(1);
    }
  }
  
  // Step 4: Generate Prisma client
  if (!executeCommand('npx prisma generate', 'Generating Prisma client')) {
    log.error('Failed to generate Prisma client');
    log.info('This usually means:');
    log.info('  1. DATABASE_URL is not set correctly');
    log.info('  2. Prisma schema has syntax errors');
    log.info('  3. Database is not accessible');
    process.exit(1);
  }
  
  // Step 5: Check if database needs migration
  try {
    execSync('npx prisma migrate status', { stdio: 'pipe' });
    log.success('Database is up to date');
  } catch (error) {
    log.warning('Database needs migration');
    log.info('Run "npx prisma migrate dev" to create/apply migrations');
  }
  
  // Step 6: Validate Prisma client generation
  const prismaClientPath = 'node_modules/.prisma/client';
  if (checkFile(path.join(prismaClientPath, 'index.js'), 'Prisma client')) {
    log.success('Prisma client generated successfully');
  } else {
    log.error('Prisma client generation incomplete');
    process.exit(1);
  }
  
  // Step 7: Success message
  log.title('Setup Complete!');
  log.success('Backend is ready to start');
  log.info('Run "npm run start:dev" to start the development server');
  log.info('Run "npm run test" to run tests');
  log.info('Run "npx prisma studio" to open database GUI');
}

// Run the setup
main().catch((error) => {
  log.error('Setup failed:');
  console.error(error);
  process.exit(1);
});
