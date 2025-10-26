// User types for authentication and management
export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  VENUE_ADMIN = 'VENUE_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface CreateUserDto {
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface LoginDto {
  phone: string;
  otp?: string;
}
