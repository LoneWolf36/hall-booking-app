# Troubleshooting Guide - Hall Booking App

## Console Errors Fix - Complete Solution

This guide addresses the common console errors and connection issues you may encounter while running the Hall Booking App.

## 🔍 Quick Diagnosis

Run the backend health check script first:
```bash
bash scripts/check-backend.sh
```

## 🚫 Common Console Errors & Solutions

### 1. “HTTP 500 Internal Server Error”

**Error Details:**
```
GET http://localhost:3001/api/v1/venues 500 (Internal Server Error)
Uncaught (in promise) Error: HTTP 500: Internal Server Error
```

**Root Causes & Solutions:**

#### A. Backend Server Not Running
```bash
# Check if backend is running
ps aux | grep node

# Start the backend
cd backend
npm install
npm run start:dev
```

#### B. Database Connection Issues
```bash
# Check environment variables
cd backend
cat .env

# Verify database connection
npx prisma migrate status
npx prisma generate
```

#### C. Missing Dependencies
```bash
# Reinstall backend dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
```

### 2. “HTTP 400 Bad Request”

**Error Details:**
```
POST http://localhost:3001/api/v1/bookings 400 (Bad Request)
Validation failed (uuid is expected)
```

**Solutions:**
- Check request payload format
- Verify UUID fields are properly formatted
- Ensure all required fields are present

### 3. “Failed to fetch” / Connection Refused

**Error Details:**
```
TypeError: Failed to fetch
Uncaught (in promise) Error: Unable to connect to server
```

**Root Causes & Solutions:**

#### A. Backend Server Down
```bash
# Start backend server
cd backend
npm run start:dev
```

#### B. Port Conflicts
```bash
# Check what's running on ports
lsof -i :3000  # Backend port
lsof -i :3001  # Frontend port

# Kill conflicting processes if needed
kill -9 <PID>
```

#### C. CORS Issues
The fix includes proper CORS configuration in Next.js config.

### 4. “Unexpected token < in JSON”

**Error Details:**
```
SyntaxError: Unexpected token '<' in JSON at position 0
```

**Solution:**
This usually means the server is returning HTML instead of JSON (often an error page).
- Check backend logs
- Verify API endpoints are working
- Ensure proper error handling

## 🛠️ Step-by-Step Fix Implementation

### Step 1: Update Configuration Files

The following files have been updated with fixes:

1. **frontend/next.config.ts** - Added API proxy and CORS handling
2. **frontend/.env.local** - Fixed API URLs
3. **frontend/src/lib/api/client.ts** - Enhanced error handling
4. **frontend/src/app/booking/page.tsx** - Better error states

### Step 2: Start Services in Correct Order

1. **Start Backend First:**
```bash
cd backend
npm install
npm run start:dev
```

2. **Verify Backend Health:**
```bash
bash scripts/check-backend.sh
```

3. **Start Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Step 3: Test the Application

1. Open http://localhost:3001
2. Check browser console for errors
3. Test the booking flow
4. Monitor API requests in Network tab

## 🔧 Environment Setup Verification

### Backend Requirements (.env)
```bash
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# JWT
JWT_SECRET="your-secret-key"

# Razorpay (for payments)
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
```

### Frontend Requirements (.env.local)
```bash
# API URL pointing to frontend port for proxy
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Debug settings
NEXT_PUBLIC_DEBUG_API=true
```

## 📊 Debugging Tools

### 1. API Health Check Component

The app now includes a built-in API health check component that:
- Monitors backend connectivity
- Shows latency information
- Provides troubleshooting tips
- Auto-retries failed connections

### 2. Enhanced Console Logging

Set `NEXT_PUBLIC_DEBUG_API=true` to enable detailed API logging:
- Request/response details
- Error stack traces
- Network timing information

### 3. Error Recovery

The application now includes:
- Automatic retry mechanisms
- Graceful error handling
- User-friendly error messages
- Connection recovery strategies

## 🔄 Common Fix Scenarios

### Scenario 1: Fresh Installation

```bash
# Clone and setup
git clone <repo-url>
cd hall-booking-app

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npx prisma migrate dev
npm run start:dev

# In another terminal - Frontend setup
cd frontend
npm install
npm run dev
```

### Scenario 2: After Git Pull

```bash
# Update backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy

# Update frontend
cd frontend
npm install

# Restart both services
```

### Scenario 3: Production Deployment

```bash
# Build frontend
cd frontend
npm run build

# Start backend in production mode
cd backend
npm run build
npm run start:prod

# Serve frontend
cd frontend
npm start
```

## 🤔 Still Having Issues?

### Check These Common Problems:

1. **Port Conflicts**
   - Backend should run on port 3000
   - Frontend should run on port 3001
   - Check `lsof -i :3000` and `lsof -i :3001`

2. **Database Issues**
   - Ensure PostgreSQL is running
   - Check database connection string
   - Run `npx prisma migrate status`

3. **Environment Variables**
   - Verify all required env vars are set
   - Check for typos in variable names
   - Ensure proper quoting of values

4. **Firewall/Network**
   - Check if localhost connections are blocked
   - Verify no VPN interference
   - Test with curl: `curl http://localhost:3000/api/v1/health`

5. **Browser Issues**
   - Clear browser cache and cookies
   - Try incognito/private mode
   - Check browser console for additional errors

### Advanced Debugging

```bash
# Check backend logs
cd backend
npm run start:dev 2>&1 | tee backend.log

# Check frontend logs
cd frontend
npm run dev 2>&1 | tee frontend.log

# Network debugging
curl -v http://localhost:3000/api/v1/health
curl -v http://localhost:3001/api/v1/health
```

## 📦 Package Versions

Ensure you're using compatible versions:

**Backend:**
- Node.js: >= 18.0.0
- NestJS: ^10.0.0
- Prisma: ^5.0.0

**Frontend:**
- Node.js: >= 18.0.0
- Next.js: ^14.0.0
- React: ^18.0.0

## 🎆 Success Indicators

When everything is working correctly, you should see:

1. **Backend Console:**
   ```
   [Nest] Application successfully started
   [Nest] Listening on port 3000
   ```

2. **Frontend Console:**
   ```
   ▶ Local: http://localhost:3001
   ▶ Ready in 2.1s
   ```

3. **Browser Console:**
   - No error messages
   - API requests returning 200 status
   - Venues loading successfully

4. **Health Check:**
   ```bash
   bash scripts/check-backend.sh
   # Should show all green checkmarks
   ```

---

## 📞 Need More Help?

If you're still experiencing issues:

1. Check the GitHub issues for similar problems
2. Review the application logs carefully
3. Verify your environment setup matches the requirements
4. Try the health check script for detailed diagnostics

The fixes implemented in this update should resolve the majority of console errors and connection issues. The enhanced error handling and debugging tools will help identify and resolve any remaining issues quickly.