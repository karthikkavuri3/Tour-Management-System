export type RoleName = "CUSTOMER" | "ADMIN" | "TRAVEL_MANAGER" | "STAFF";

export interface Session {
  token: string;
  userId: number;
  fullName: string;
  email: string;
  roles: RoleName[];
}

export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  enabled: boolean;
  roles: string[];
}

export interface TourPackage {
  id: number;
  title: string;
  description: string;
  destinationId: number;
  destinationName: string;
  imageUrl: string;
  price: number;
  durationDays: number;
  maxCapacity: number;
  bookingsAvailable: number;
  startDate: string | null;   // ISO date "YYYY-MM-DD" — booking window start
  endDate: string | null;     // ISO date "YYYY-MM-DD" — booking window end
  itineraryHighlights?: { title: string; details?: string | null }[];
  whatsIncluded?: string[];
  status: string;
}

export interface TourSchedule {
  id: number;
  tourPackageId: number;
  tourTitle: string;
  startDate: string;
  endDate: string;
  departureTime: string | null;
  returnTime: string | null;
  meetingPoint: string | null;
  status: string;
}

export interface Traveler {
  firstName: string;
  lastName: string;
  age: number;
}

export interface Booking {
  id: number;
  bookingReference: string;
  userId: number;
  tourPackageId: number;
  scheduleId: number;
  numberOfPeople: number;
  totalAmount: number;
  bookingStatus: string;
  paymentStatus: string;
  bookingDate: string;
  travelers: Traveler[];
}

export interface BookingFilterRequest {
  userId?: number;
  tourPackageId?: number;
  bookingStatus?: string;
  paymentStatus?: string;
  bookedFrom?: string;
  bookedTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  remarks: string;
  invoiceType?: string;   // "PAYMENT" or "REFUND" (returned by the new getAllInvoices endpoint)
}
