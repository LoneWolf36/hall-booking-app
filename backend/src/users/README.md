# 👥 User Management Service

## Overview

The User Management Service provides comprehensive user handling for the Hall Booking System with phone-based authentication, role management, and multi-tenant support.

## ✅ **Task 2.1 Completion Status**

- [x] **Create user upsert functionality (phone-based)**
- [x] **Implement user validation** 
- [x] **Add user role management (customer, admin)**
- [x] **Create user DTOs and entities**

### **Acceptance Criteria Met**
- ✅ **Upsert user by phone number works**
- ✅ **Duplicate phone handling correct**
- ✅ **Role-based access structure ready**

## 🏗️ **Architecture**

```
src/users/
├── dto/
│   ├── create-user.dto.ts      # Input validation for user creation
│   ├── update-user.dto.ts      # Input validation for user updates
│   └── user-response.dto.ts    # Output formatting for API responses
├── users.controller.ts         # REST API endpoints
├── users.service.ts           # Business logic layer
├── users.module.ts            # Dependency injection setup
├── users.service.spec.ts      # Comprehensive unit tests
└── README.md                  # This documentation
```

## 📱 **Key Features**

### **1. Phone-Based User Upsert**
```typescript
// Creates new user OR updates existing based on phone number
POST /api/v1/users
{
  "name": "Rahul Sharma",
  "phone": "+91-9876-543-210",
  "email": "rahul@example.com",
  "role": "customer"
}
```

**Business Logic:**
- If phone exists → Update existing user
- If phone doesn't exist → Create new user
- Phone numbers are automatically normalized
- Returns consistent response for both cases

### **2. Duplicate Phone Handling**
- **Tenant-scoped uniqueness**: Same phone can exist across different tenants
- **Atomic operations**: Uses Prisma upsert to prevent race conditions
- **Proper error handling**: Clear error messages for conflicts
- **Phone normalization**: Consistent storage format (+91XXXXXXXXXX)

### **3. Role-Based Access Control**
```typescript
enum UserRole {
  CUSTOMER = 'customer',  // Default role for new users
  ADMIN = 'admin'         // Administrative privileges
}
```

**Role Management:**
- Default role: `customer`
- Admin creation requires admin privileges (future)
- Role validation endpoints for authorization
- Prepared for future role expansion

### **4. Multi-Tenant Support**
- All operations scoped to `tenantId`
- Tenant validation prevents orphaned users
- Prepared for SaaS expansion
- Row-level security ready

## 🛠️ **API Endpoints**

### **Create/Update User (Upsert)**
```http
POST /api/v1/users
Headers: X-Tenant-Id: {tenant-id}
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "role": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "role": "customer",
    "createdAt": "2025-10-25T17:30:00Z",
    "updatedAt": "2025-10-25T17:30:00Z"
  },
  "message": "User created or updated successfully"
}
```

### **Find User by Phone**
```http
GET /api/v1/users/phone/{phone}
Headers: X-Tenant-Id: {tenant-id}
```

### **Find User by ID**
```http
GET /api/v1/users/{user-id}
Headers: X-Tenant-Id: {tenant-id}
```

### **Update User**
```http
PATCH /api/v1/users/{user-id}
Headers: X-Tenant-Id: {tenant-id}
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```

### **List Users (Admin)**
```http
GET /api/v1/users?role=customer&page=1&limit=20
Headers: X-Tenant-Id: {tenant-id}
```

### **Validate User Role**
```http
GET /api/v1/users/{user-id}/validate-role/{role}
Headers: X-Tenant-Id: {tenant-id}
```

## 🔒 **Input Validation**

### **Phone Number Validation**
- **Format**: Indian phone numbers (`+91XXXXXXXXXX`)
- **Normalization**: Removes spaces, dashes, parentheses
- **Auto-prefix**: Adds `+91` for 10-digit numbers
- **Validation**: Uses `@IsPhoneNumber('IN')` decorator

### **Name Validation**
- **Required**: Must be provided
- **Min Length**: At least 2 characters
- **Trimming**: Automatic whitespace removal

### **Email Validation**
- **Optional**: Not required for Indian market
- **Format**: Standard email format validation
- **Normalization**: Lowercase and trimmed

### **Role Validation**
- **Enum**: Must be `customer` or `admin`
- **Default**: `customer` for new users
- **Future**: Admin role assignment restricted

## 📊 **Phone Number Normalization Examples**

| Input | Output |
|-------|--------|
| `9876543210` | `+919876543210` |
| `+91 9876 543 210` | `+919876543210` |
| `+91-9876-543-210` | `+919876543210` |
| `+91(9876)543210` | `+919876543210` |
| `91 98765 43210` | `+919876543210` |

## 🚀 **Usage Examples**

### **1. Customer Registration During Booking**
```typescript
// When customer makes a booking
const userData = {
  name: "Priya Patel",
  phone: "98765 43210",
  email: "priya@gmail.com"
};

// This will create new user or update existing
const user = await usersService.upsertUserByPhone(tenantId, userData);
```

### **2. Admin User Management**
```typescript
// List all customers with pagination
const result = await usersService.findAllUsers(tenantId, {
  role: UserRole.CUSTOMER,
  skip: 0,
  take: 50
});

console.log(`Found ${result.total} customers`);
```

### **3. Authorization Check**
```typescript
// Check if user is admin
const isAdmin = await usersService.validateUserRole(
  tenantId, 
  userId, 
  UserRole.ADMIN
);

if (isAdmin) {
  // Allow admin operations
}
```

## 🧪 **Testing**

### **Run Tests**
```bash
# Unit tests
npm run test src/users/users.service.spec.ts

# Test with coverage
npm run test:cov src/users/

# Watch mode during development
npm run test:watch src/users/
```

### **Test Coverage**
- ✅ User upsert functionality
- ✅ Phone number normalization
- ✅ Duplicate handling
- ✅ Role validation
- ✅ Error scenarios
- ✅ Multi-tenant isolation
- ✅ Input validation
- ✅ Pagination

## 🔧 **Development Setup**

### **1. Database Migration**
The User model is already defined in Prisma schema. Run:
```bash
npx prisma generate
npx prisma migrate dev
```

### **2. Environment Variables**
```bash
DATABASE_URL="postgresql://..."
```

### **3. Test the API**
```bash
# Start development server
npm run start:dev

# Test user creation
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: your-tenant-id" \
  -d '{
    "name": "Test User",
    "phone": "+919876543210",
    "email": "test@example.com"
  }'
```

## 🚀 **Integration with Other Services**

### **Booking Service Integration**
```typescript
// In booking service
const user = await this.usersService.upsertUserByPhone(tenantId, {
  name: bookingData.customerName,
  phone: bookingData.customerPhone,
  email: bookingData.customerEmail
});

const booking = await this.createBooking({
  ...bookingData,
  userId: user.id
});
```

### **Authentication Service (Future)**
```typescript
// Phone-based login
const user = await this.usersService.findByPhone(tenantId, phoneNumber);
if (user) {
  // Generate OTP and JWT token
}
```

## 🔜 **Future Enhancements**

### **Phase 1: Authentication**
- [ ] JWT token integration
- [ ] OTP-based phone verification
- [ ] Session management
- [ ] Password reset flow

### **Phase 2: Advanced Features**
- [ ] User profile pictures
- [ ] Address management
- [ ] Preference settings
- [ ] Activity logging

### **Phase 3: Analytics**
- [ ] User registration metrics
- [ ] Role distribution analytics
- [ ] Phone verification rates
- [ ] User engagement tracking

## 🎯 **Performance Optimizations**

### **Current**
- Database indexes on `(tenantId, phone)`
- Efficient upsert operations
- Pagination for large datasets
- Input validation at DTO level

### **Future**
- Redis caching for frequent lookups
- Bulk user operations
- Search functionality
- User import/export

## 🔍 **Monitoring & Debugging**

### **Logging**
- Phone normalization logs
- Upsert operation results
- Validation failures
- Performance metrics

### **Health Checks**
The service integrates with the existing health check system.

---

## 📝 **Summary**

This User Management Service provides a robust foundation for user handling in the Hall Booking System. It successfully implements:

1. **Phone-based upsert** with proper normalization
2. **Duplicate handling** with tenant isolation
3. **Role management** ready for future expansion
4. **Comprehensive validation** and error handling
5. **Multi-tenant architecture** for SaaS scalability

The implementation follows NestJS best practices and is ready for production deployment with comprehensive test coverage and clear API documentation.

**Next Steps**: Integrate with booking workflow and add authentication layer.