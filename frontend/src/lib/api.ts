import axios from "axios";
import type { Session, TourPackage, TourSchedule, Booking, BookingFilterRequest, UserProfile, Invoice } from "./models";

const API = axios.create({ baseURL: "http://localhost:8080" });

API.interceptors.request.use((config) => {
  try {
    if ((config.method ?? "get").toLowerCase() === "get") {
      config.headers["Cache-Control"] = "no-cache, no-store, max-age=0";
      config.headers["Pragma"] = "no-cache";
      config.params = { ...(config.params ?? {}), _ts: Date.now() };
    }
    const raw = localStorage.getItem("tms.session");
    if (raw) {
      const session = JSON.parse(raw) as Session;
      if (session.token) config.headers["Authorization"] = `Bearer ${session.token}`;
      if (session.email) config.headers["X-User-Email"] = session.email;
    }
  } catch {}
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginUser(payload: { email: string; password: string }): Promise<Session> {
  const { data } = await API.post("/auth/login", payload);
  return { token: data.token, userId: data.userId, fullName: data.fullName, email: data.email, roles: Array.from(data.roles) };
}

export async function registerUser(payload: { fullName: string; email: string; phone?: string; password: string }) {
  const { data } = await API.post("/auth/register", payload);
  return data;
}

export async function logoutUser() {
  await API.post("/auth/logout");
}

export async function sendForgotPasswordCode(payload: { email: string }) {
  const { data } = await API.post("/auth/forgot-password/send-code", payload);
  return data as { message: string };
}

export async function verifyForgotPasswordCode(payload: { email: string; code: string }) {
  const { data } = await API.post("/auth/forgot-password/verify-code", payload);
  return data as { message: string };
}

export async function resetPasswordWithCode(payload: { email: string; code: string; newPassword: string }) {
  const { data } = await API.post("/auth/forgot-password/reset", payload);
  return data as { message: string };
}

// ─── User / Profile ──────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await API.get("/users/me");
  return data;
}

export async function updateMyProfile(payload: { fullName: string; phone?: string }): Promise<UserProfile> {
  const { data } = await API.put("/users/me", payload);
  return data;
}

export async function changeMyPassword(payload: { currentPassword: string; newPassword: string }) {
  const { data } = await API.put("/users/me/password", payload);
  return data;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data } = await API.get("/users");
  return data;
}

export async function updateUserRoles(userId: number, roles: string[]) {
  const { data } = await API.put(`/users/${userId}/roles`, { roles });
  return data;
}

export async function updateUser(
  userId: number,
  payload: { fullName: string; phone?: string; enabled?: boolean; roles?: string[]; password?: string }
): Promise<UserProfile> {
  const { data } = await API.put(`/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId: number): Promise<{ message: string }> {
  const { data } = await API.delete(`/users/${userId}`);
  return data;
}

export async function createUser(payload: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  enabled?: boolean;
  roles?: string[];
}): Promise<UserProfile> {
  const { data } = await API.post("/users", payload);
  return data;
}

// ─── Tours ───────────────────────────────────────────────────────────────────

export async function getTours(params?: {
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  minDuration?: number;
  maxDuration?: number;
  status?: string;
}): Promise<TourPackage[]> {
  const { data } = await API.get("/tours", { params });
  return data;
}

export async function getTour(id: number): Promise<TourPackage> {
  const { data } = await API.get(`/tours/${id}`);
  return data;
}

export async function createTour(payload: object): Promise<TourPackage> {
  const { data } = await API.post("/tours", payload);
  return data;
}

export async function updateTour(id: number, payload: object): Promise<TourPackage> {
  const { data } = await API.put(`/tours/${id}`, payload);
  return data;
}

export async function deleteTour(id: number) {
  await API.delete(`/tours/${id}`);
}

export async function getSchedules(): Promise<TourSchedule[]> {
  const { data } = await API.get("/schedules");
  return data;
}

export async function getScheduleById(id: number): Promise<TourSchedule> {
  const { data } = await API.get(`/schedules/${id}`);
  return data;
}

export async function createSchedule(payload: object): Promise<TourSchedule> {
  const { data } = await API.post("/schedules", payload);
  return data;
}

export async function updateSchedule(id: number, payload: object): Promise<TourSchedule> {
  const { data } = await API.put(`/schedules/${id}`, payload);
  return data;
}

export async function deleteSchedule(id: number) {
  await API.delete(`/schedules/${id}`);
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export interface CreateBookingPayload {
  userId: number;
  tourPackageId: number;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  totalAmount: number;
  paymentMethod: string;
  mockPaymentSuccess: boolean;
  customerEmail: string;
  travelers: { firstName: string; lastName: string; age: number }[];
  // Enrichment fields for professional email + PDF invoice
  customerName?: string;
  tourTitle?: string;
  destinationName?: string;
  durationDays?: number;
  pricePerPerson?: number;
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const { data } = await API.post("/bookings", payload);
  return data;
}

export async function getMyBookings(userId: number): Promise<Booking[]> {
  const { data } = await API.get("/bookings/my", { params: { userId } });
  return data;
}

export async function getAllBookings(): Promise<Booking[]> {
  const { data } = await API.get("/bookings");
  return data;
}

export async function filterBookings(filter: BookingFilterRequest): Promise<Booking[]> {
  const { data } = await API.post("/admin/bookings/search", filter);
  return data;
}

export interface CancelBookingPayload {
  customerEmail?: string;
  customerName?: string;
  tourTitle?: string;
  destinationName?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  durationDays?: number;
  numberOfTravelers?: number;
  pricePerPerson?: number;
}

export async function cancelBooking(id: number, payload?: CancelBookingPayload): Promise<Booking> {
  const { data } = await API.put(`/bookings/${id}/cancel`, payload ?? null);
  return data;
}

export async function adminCancelBooking(id: number, payload?: CancelBookingPayload): Promise<Booking> {
  const { data } = await API.put(`/admin/bookings/${id}/cancel`, payload ?? null);
  return data;
}

export async function adminMarkBookingCompleted(id: number): Promise<Booking> {
  const { data } = await API.put(`/admin/bookings/${id}/complete`);
  return data;
}

export interface UpdateBookingPayload {
  scheduleId: number;
  totalAmount: number;
  customerEmail?: string;
  travelers: { firstName: string; lastName: string; age: number }[];
  newStartDate?: string;
  newEndDate?: string;
}

export async function updateBooking(id: number, payload: UpdateBookingPayload): Promise<Booking> {
  const { data } = await API.put(`/bookings/${id}`, payload);
  return data;
}

export async function getInvoice(bookingId: number): Promise<Invoice> {
  const { data } = await API.get(`/invoices/${bookingId}`);
  return data;
}

export async function getAllInvoices(bookingId: number): Promise<Invoice[]> {
  const { data } = await API.get(`/invoices/${bookingId}/all`);
  return data;
}

export interface InvoicePdfPayload {
  recipientEmail: string;
  customerName?: string;
  bookingReference: string;
  invoiceNumber?: string;
  tourTitle?: string;
  destinationName?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  durationDays?: number;
  numberOfTravelers?: number;
  pricePerPerson?: number;
  totalAmount?: number;
  processingFee?: number;
  grandTotal?: number;
  paymentMethod?: string;
  bookingDate?: string;
}

export async function downloadInvoicePdf(payload: InvoicePdfPayload): Promise<Blob> {
  const { data } = await API.post("/notifications/invoice/pdf", payload, { responseType: "blob" });
  return data;
}

export interface RefundInvoicePdfPayload {
  recipientEmail: string;
  customerName?: string;
  bookingReference: string;
  invoiceNumber?: string;
  tourTitle?: string;
  destinationName?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  durationDays?: number;
  numberOfTravelers?: number;
  totalAmount?: number;
  cancellationDate?: string;
}

export async function downloadRefundInvoicePdf(payload: RefundInvoicePdfPayload): Promise<Blob> {
  const { data } = await API.post("/notifications/refund-invoice/pdf", payload, { responseType: "blob" });
  return data;
}

export async function adminCreateBooking(payload: CreateBookingPayload & { userId: number }): Promise<Booking> {
  const { data } = await API.post("/admin/bookings", payload);
  return data;
}

export async function adminUpdateBooking(id: number, payload: object): Promise<Booking> {
  const { data } = await API.put(`/admin/bookings/${id}`, payload);
  return data;
}
