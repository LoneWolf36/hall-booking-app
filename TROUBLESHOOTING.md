# Troubleshooting Guide

This guide helps you resolve common issues with the Hall Booking Application.

## 🔧 Quick Fixes for Common API Errors

### 1. Redis Controller "Cannot read properties of undefined" Error

**Error Message:**
```json
{
  "statusCode": 500,
  "error": "InternalServerError",
  "message": "Internal server error",
  "path": "/api/v1/redis-test/set/hello",
  "method": "POST"
}
```

**Root Cause:** Missing request body with `value` property.

**Solution:**
```bash
# ❌ Wrong - Empty body
curl -X POST http://localhost:3000/api/v1/redis-test/set/hello \
  -H "Content-Type: application/json" \
  -d '{}'

# ✅ Correct - With required value
curl -X POST http://localhost:3000/api/v1/redis-test/set/hello \
  -H "Content-Type: application/json" \
  -d '{"value": "world"}'

# ✅ With TTL (optional)
curl -X POST http://localhost:3000/api/v1/redis-test/set/hello \
  -H "Content-Type: application/json" \
  -d '{"value": "world", "ttl": 3600}'
```

### 2. Health Check "Cache Connection Failed"

**Error Message:**
```json
{
  "status": "error",
  "checks": {
    "cache": {
      "healthy": false,
      "message": "Connection failed"
    }
  }
}
```

**Root Cause:** Missing or invalid Redis environment variables.

**Solution:**
1. **Check Environment Variables:**
   ```bash
   # Verify Redis configuration
   echo $UPSTASH_REDIS_REST_URL
   echo $UPSTASH_REDIS_REST_TOKEN
   ```

2. **Set Up Upstash Redis:**
   - Go to [Upstash Console](https://console.upstash.com/)
   - Create a new Redis database
   - Copy the REST URL and Token
   - Update your `.env` file:
   ```env
   UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-token-here"
   ```

3. **Test Connection:**
   ```bash
   # Test Redis connection directly
   curl https://your-instance.upstash.io/ping \
     -H "Authorization: Bearer your-token"
   ```

### 3. Users API "Validation Failed" Error

**Error Message:**
```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Validation failed",
  "path": "/api/v1/users",
  "method": "POST"
}
```

**Root Cause:** Missing required fields or invalid data format.

**Solution:**
```bash
# ❌ Wrong - Empty body
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-1" \
  -d '{}'

# ✅ Correct - With required fields
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-1" \
  -d '{
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "role": "customer"
  }'
```

**Required Fields:**
- `name`: String (min 2 characters)
- `phone`: Valid Indian phone number (+91XXXXXXXXXX)
- `email`: Valid email (optional)
- `role`: Either "customer" or "admin" (optional, defaults to "customer")

## 🐛 Environment Setup Issues

### Database Connection Issues

**Symptoms:**
- Health check shows database as unhealthy
- "Database connection failed" errors

**Solutions:**
1. **Check DATABASE_URL:**
   ```bash
   echo $DATABASE_URL
   # Should look like: postgresql://user:pass@host:port/dbname
   ```

2. **Test Connection:**
   ```bash
   npx prisma db pull
   # If successful, connection works
   ```

3. **Common Issues:**
   - Wrong host/port
   - Invalid credentials
   - Database doesn't exist
   - SSL configuration issues

### Missing Environment Variables

**Check Required Variables:**
```bash
# Create .env from example
cp .env.example .env

# Verify all variables are set
node -e "console.log(process.env.DATABASE_URL ? '✅ DATABASE_URL' : '❌ DATABASE_URL missing')"
node -e "console.log(process.env.UPSTASH_REDIS_REST_URL ? '✅ REDIS_URL' : '❌ REDIS_URL missing')"
```

## 📊 Health Check Debugging

### Get Detailed Health Status

```bash
# Check overall health
curl http://localhost:3000/api/v1/health | jq .

# Check Redis specifically
curl http://localhost:3000/api/v1/redis-test/health | jq .
```

### Health Check Response Format

```json
{
  "status": "ok",  // or "error"
  "checks": {
    "database": {
      "healthy": true,
      "message": "Connected"
    },
    "cache": {
      "healthy": true,
      "message": "Connected"
    },
    "timestamp": "2025-10-26T09:00:00.000Z",
    "environment": "development",
    "version": "1.0.0"
  }
}
```

## 🔍 API Testing Examples

### Complete API Testing Flow

```bash
#!/bin/bash
set -e

API_BASE="http://localhost:3000/api/v1"
TENANT_ID="tenant-1"

echo "🔍 Testing API endpoints..."

# 1. Health Check
echo "\n📊 Health Check:"
curl -s "$API_BASE/health" | jq .

# 2. Redis Test
echo "\n🔴 Redis Test:"
curl -s -X POST "$API_BASE/redis-test/set/test-key" \
  -H "Content-Type: application/json" \
  -d '{"value": "test-value", "ttl": 60}' | jq .

# 3. Create User
echo "\n👤 Create User:"
curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{
    "name": "Test User",
    "phone": "+919876543210",
    "email": "test@example.com"
  }' | jq .

# 4. Get User by Phone
echo "\n🔍 Get User by Phone:"
curl -s "$API_BASE/users/phone/+919876543210" \
  -H "X-Tenant-Id: $TENANT_ID" | jq .

echo "\n✅ API testing complete!"
```

## 🚀 Performance Optimization

### Redis Performance Issues

**Symptoms:**
- Slow API responses
- High cache miss rate
- Memory issues

**Solutions:**
1. **Monitor Cache Hit Rate:**
   ```bash
   # Check Redis stats
   curl http://localhost:3000/api/v1/redis-test/health
   ```

2. **Optimize TTL Values:**
   ```javascript
   // In your .env file
   REDIS_TTL_AVAILABILITY=300    // 5 minutes for availability
   REDIS_TTL_BOOKINGS=3600      // 1 hour for bookings
   REDIS_TTL_IDEMPOTENCY=86400  // 24 hours for idempotency
   ```

### Database Performance Issues

**Solutions:**
1. **Check Index Usage:**
   ```sql
   -- Verify exclusion constraint exists
   SELECT conname FROM pg_constraint 
   WHERE conname = 'no_booking_overlap';
   ```

2. **Monitor Query Performance:**
   ```bash
   # Enable query logging
   echo "LOG_LEVEL=debug" >> .env
   ```

## 🆘 Getting Help

### Log Analysis

**Enable Debug Logging:**
```bash
# In .env file
LOG_LEVEL=debug
NODE_ENV=development
```

**Check Application Logs:**
```bash
# Look for specific error patterns
npm run start:dev 2>&1 | grep -i "error\|warn\|redis\|database"
```

### Common Log Messages

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `Redis client not initialized` | Missing Redis config | Set UPSTASH_* env vars |
| `Database health check failed` | DB connection issue | Check DATABASE_URL |
| `Validation failed` | Invalid request body | Check required fields |
| `JWT token missing` | Auth not implemented | Normal for development |

### Support Information

**System Information:**
```bash
# Get system info for support
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo "OS: $(uname -a)"
echo "Current Directory: $(pwd)"
ls -la .env* 2>/dev/null || echo "No .env files found"
```

**Environment Check:**
```bash
# Verify all required services
echo "Database: $(npx prisma db pull >/dev/null 2>&1 && echo 'OK' || echo 'FAILED')"
echo "Redis: $(curl -s http://localhost:3000/api/v1/health | jq -r '.checks.cache.healthy')"
```

---

**Need More Help?**

If these solutions don't resolve your issue:
1. Check the application logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure all required services (PostgreSQL, Redis) are running
4. Test individual components using the provided curl examples
