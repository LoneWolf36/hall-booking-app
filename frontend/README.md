# Hall Booking System - Frontend

Modern, responsive frontend for the Hall Booking System built with Next.js 16, TypeScript, and ShadCN UI.

## 🚀 Tech Stack

- **Framework**: Next.js 16.0.0 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: ShadCN UI (25+ components)
- **State Management**: TanStack Query + React Context
- **Forms**: React Hook Form + Zod validation
- **Theme**: next-themes with dark/light mode
- **Icons**: Lucide React
- **HTTP Client**: Axios with interceptors

## 📁 Project Structure

```
frontend/src/
├── app/              # Next.js 16 App Router
│   ├── layout.tsx    # Root layout with providers
│   └── page.tsx      # Home page
├── components/       # React components
│   ├── ui/          # ShadCN UI components (25+)
│   ├── navigation.tsx
│   └── theme-provider.tsx
├── lib/             # Shared utilities
│   ├── api.ts       # Axios client with interceptors
│   └── utils.ts     # Utility functions
├── services/        # API service layers
│   ├── booking.service.ts
│   └── index.ts
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
├── types/           # TypeScript definitions
│   ├── api.ts
│   ├── booking.ts
│   ├── user.ts
│   └── venue.ts
└── utils/           # Helper functions
```

## 🔧 Setup & Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend API running on `http://localhost:3000`

### Install Dependencies

```bash
cd frontend
npm install
```

### Environment Configuration

The `.env.local` file is already configured:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME="Hall Booking System"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NODE_ENV=development
```

### Development

```bash
# Start development server
npm run dev

# Frontend will be available at http://localhost:3001
# (Different port to avoid conflict with backend on 3000)
```

### Build & Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🎨 UI Components

### Available ShadCN Components

- **Forms**: Button, Input, Label, Form, Checkbox, Radio Group, Select, Textarea
- **Layout**: Card, Separator, Tabs, Sheet
- **Navigation**: Navigation Menu, Dialog, Popover, Alert Dialog
- **Feedback**: Alert, Progress, Skeleton, Spinner, Sonner (Toasts)
- **Data Display**: Table, Badge, Avatar, Calendar
- **Advanced**: Command (search), Date Picker

### Theme Support

- 🌙 **Dark/Light Mode**: Automatic system detection with manual toggle
- 🎨 **CSS Variables**: Customizable theme colors
- 📱 **Responsive**: Mobile-first design with Tailwind breakpoints

## 🔌 API Integration

### Backend Connection

The frontend connects to the NestJS backend at `http://localhost:3000/api/v1` with:

- **Authentication**: JWT token in localStorage with auto-refresh
- **Error Handling**: Automatic 401 redirect and error boundaries
- **Type Safety**: Full TypeScript definitions for all API responses

### Available API Services

```typescript
// Health check
api.healthCheck()

// Bookings
api.getBookings()
api.getBooking(id)
api.createBooking(data)
api.updateBooking(id, data)

// Users
api.getUser(id)
api.createUser(data)
api.updateUser(id, data)

// Payments
api.getPaymentOptions(bookingId)
api.selectPaymentMethod(bookingId, data)
api.createPaymentLink(bookingId, data)
api.recordCashPayment(bookingId, data)
```

## 🧪 Development Tools

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format

# Testing (when implemented)
npm run test:watch
npm run test:coverage

# Clean build artifacts
npm run clean
```

## 🏗️ Architecture Highlights

### Next.js 16 Features
- ⚡ **Turbopack**: 5-10x faster builds in development
- 🔄 **React 19.2**: Latest React features with View Transitions
- 📱 **App Router**: File-based routing with layouts and loading states
- 🎯 **Server Components**: Automatic optimization for performance

### Enterprise Features
- 🔒 **Type Safety**: End-to-end TypeScript from API to UI
- 🎨 **Design System**: Consistent UI with ShadCN components
- 📊 **State Management**: TanStack Query for server state
- 🌐 **Internationalization Ready**: Structure supports multi-language
- 📱 **Mobile Responsive**: Works perfectly on all devices

## 🚀 Next Steps (Phase 1)

1. **Authentication Pages**: Login, registration, OTP verification
2. **Booking Interface**: Create, view, manage bookings
3. **Payment Flow**: Integration with flexible payment profiles
4. **Venue Browser**: Search and filter available venues
5. **User Dashboard**: Profile management and booking history

## 🤝 Integration with Backend

This frontend is designed to work seamlessly with the [NestJS backend](../backend/) featuring:

- **Zero Double-Bookings**: Real-time availability checking
- **Flexible Payments**: Support for all payment profiles (5%-15% commission)
- **Multi-Tenant**: Ready for SaaS scaling to 100+ venues
- **Redis Caching**: Optimized performance with cached responses

---

**Built with ❤️ using Next.js 16 + TypeScript + ShadCN UI**
