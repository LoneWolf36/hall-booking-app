# Prisma Client Setup Guide

🚑 **Quick Fix for the "@prisma/client did not initialize yet" Error**

## The Problem
You're seeing this error:
```
@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

## 🚀 Quick Solution

### Option 1: Automated Setup (Recommended)
```bash
cd backend
npm run setup
```

### Option 2: Manual Steps
```bash
cd backend

# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Apply database migrations (if needed)
npx prisma migrate dev

# 4. Start the server
npm run start:dev
```

### Option 3: Quick Fix Only
If you just need to regenerate the client:
```bash
cd backend
npm run prisma:fix
```

## ⚙️ Environment Setup

Make sure your `.env` file exists and has these variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/hall_booking"

# Redis Configuration (for caching)
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"

# Application Settings
NODE_ENV="development"
PORT=3000
LOG_LEVEL="info"
```

## 🔍 Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your actual database credentials

### Error: "Can't reach database server"
1. Make sure PostgreSQL is running
2. Check your DATABASE_URL credentials
3. Test connection:
   ```bash
   npx prisma db pull
   ```

### Error: "Migration file not found"
1. Create your first migration:
   ```bash
   npx prisma migrate dev --name init
   ```

### Error: "Prisma schema validation failed"
1. Check your `prisma/schema.prisma` file for syntax errors
2. Make sure generator and datasource are configured correctly

## 🚀 Available NPM Scripts

| Script | Purpose |
|--------|--------|
| `npm run setup` | Complete automated setup |
| `npm run setup:quick` | Quick setup (install + generate) |
| `npm run prisma:fix` | Regenerate Prisma client only |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate:dev` | Apply migrations in development |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:status` | Check migration status |
| `npm run start:dev` | Start development server |

## ✅ Verification

After running the setup, verify everything works:

1. **Check Prisma client generation:**
   ```bash
   ls node_modules/.prisma/client/
   # Should see: index.js, index.d.ts, etc.
   ```

2. **Test database connection:**
   ```bash
   curl http://localhost:3000/api/v1/health
   # Should return: {"status":"ok",...}
   ```

3. **Check application logs:**
   Look for: `✅ Database connection established`

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Prisma Integration](https://docs.nestjs.com/recipes/prisma)
- [Database Schema](./prisma/schema.prisma)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Need help?** Check the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) file for more detailed debugging steps.
