"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import {
  FeatherAlertTriangle, FeatherFilter, FeatherPlus, FeatherRefreshCw, FeatherSearch, FeatherX,
} from "@subframe/core";
import type { Booking, Session, TourPackage, UserProfile } from "@/lib/models";
import { adminCancelBooking, getAllBookings, getAllUsers, getTours } from "@/lib/api";
import AppNavbar from "@/components/AppNavbar";
import BookingDetailModal from "@/components/BookingDetailModal";
import AdminCreateBookingModal from "@/components/AdminCreateBookingModal";

type StatusFilter = "all" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
type BookingSortKey = "bookingReference" | "userName" | "tourName" | "travelers" | "amount" | "paymentStatus" | "bookingStatus" | "bookingDate";
type SortDir = "asc" | "desc";

interface Props { session: Session; onLogout: () => void; }

export default function AdminBookingCenterPage({ session, onLogout }: Props) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tours, setTours] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<BookingSortKey>("bookingDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [createBookingOpen, setCreateBookingOpen] = useState(false);
  const [cancelPromptBooking, setCancelPromptBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [modalEdit, setModalEdit] = useState(false);

  useEffect(() => { void loadBookings(); }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const [b, u, t] = await Promise.all([getAllBookings(), getAllUsers(), getTours()]);
      setBookings(b);
      setUsers(u);
      setTours(t);
    } catch {
      setBookings([]);
      setUsers([]);
      setTours([]);
    }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((b) => b.bookingStatus === "CONFIRMED").length,
    completed: bookings.filter((b) => b.bookingStatus === "COMPLETED").length,
    cancelled: bookings.filter((b) => b.bookingStatus === "CANCELLED").length,
    revenue: bookings.filter((b) => b.paymentStatus === "SUCCESS").reduce((sum, b) => sum + b.totalAmount, 0),
  }), [bookings]);

  const userNameById = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.fullName));
    return map;
  }, [users]);

  const userEmailById = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.email));
    return map;
  }, [users]);

  const tourNameById = useMemo(() => {
    const map = new Map<number, string>();
    tours.forEach((t) => map.set(t.id, t.title));
    return map;
  }, [tours]);

  const tourById = useMemo(() => {
    const map = new Map<number, TourPackage>();
    tours.forEach((t) => map.set(t.id, t));
    return map;
  }, [tours]);

  const filtered = useMemo(() => {
    let list = [...bookings];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((b) => {
        const userName = userNameById.get(b.userId)?.toLowerCase() ?? "";
        const tourName = tourNameById.get(b.tourPackageId)?.toLowerCase() ?? "";
        return b.bookingReference.toLowerCase().includes(q) || userName.includes(q) || tourName.includes(q);
      });
    }
    if (statusFilter !== "all") list = list.filter((b) => b.bookingStatus === statusFilter);
    return list.sort((a, b) => {
      const userA = userNameById.get(a.userId) ?? `User #${a.userId}`;
      const userB = userNameById.get(b.userId) ?? `User #${b.userId}`;
      const tourA = tourNameById.get(a.tourPackageId) ?? `Tour #${a.tourPackageId}`;
      const tourB = tourNameById.get(b.tourPackageId) ?? `Tour #${b.tourPackageId}`;
      let cmp = 0;
      switch (sortKey) {
        case "bookingReference": cmp = a.bookingReference.localeCompare(b.bookingReference); break;
        case "userName": cmp = userA.localeCompare(userB); break;
        case "tourName": cmp = tourA.localeCompare(tourB); break;
        case "travelers": cmp = a.numberOfPeople - b.numberOfPeople; break;
        case "amount": cmp = a.totalAmount - b.totalAmount; break;
        case "paymentStatus": cmp = a.paymentStatus.localeCompare(b.paymentStatus); break;
        case "bookingStatus": cmp = a.bookingStatus.localeCompare(b.bookingStatus); break;
        case "bookingDate": cmp = new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [bookings, search, statusFilter, sortKey, sortDir, userNameById, tourNameById]);

  const handleCancel = async (b: Booking) => {
    setCancelling(b.id);
    try {
      const userEmail = userEmailById.get(b.userId);
      const tour = tourById.get(b.tourPackageId);
      await adminCancelBooking(b.id, {
        customerEmail: userEmail,
        customerName: userNameById.get(b.userId),
        tourTitle: tour?.title,
        destinationName: tour?.destinationName,
        numberOfTravelers: b.numberOfPeople,
      });
      setCancelPromptBooking(null);
      await loadBookings();
    }
    catch (err) { alert((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to cancel booking."); }
    finally { setCancelling(null); }
  };

  const statusBadge = (b: Booking) => {
    const map: Record<string, "brand" | "success" | "error" | "warning" | "neutral"> = {
      CONFIRMED: "brand", COMPLETED: "success", CANCELLED: "error", PENDING: "warning",
    };
    return <Badge variant={map[b.bookingStatus] ?? "neutral"}>{b.bookingStatus}</Badge>;
  };

  const openModal = (b: Booking, edit: boolean) => {
    setSelectedBooking(b);
    setModalEdit(edit);
  };

  return (
    <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
      <AppNavbar
        session={session}
        onLogout={onLogout}
        brandName="Wanderlust Admin"
        links={[
          { label: "Overview", active: false,  onClick: () => navigate("/admin") },
          { label: "Tours",    active: false,  onClick: () => navigate("/admin?tab=tours") },
          { label: "Users",    active: false,  onClick: () => navigate("/admin?tab=users") },
          { label: "Bookings", active: true,   onClick: () => {} },
          { label: "Profile",  active: false,  onClick: () => navigate("/admin?tab=profile") },
        ]}
      />

      <div className="flex w-full flex-col items-center gap-8 px-8 py-8">
        <div className="flex w-full max-w-[1280px] flex-col items-start gap-8">
          <div className="flex w-full items-center gap-4">
            <div className="flex grow items-center gap-4">
              <span className="text-heading-1 font-heading-1 text-default-font">Booking Center</span>
              <Button icon={<FeatherPlus />} onClick={() => setCreateBookingOpen(true)}>
                Add New Booking
              </Button>
            </div>
            <Button variant="neutral-secondary" icon={<FeatherRefreshCw />} onClick={() => void loadBookings()}>Refresh</Button>
          </div>

        {/* Stats */}
        <div className="w-full items-start gap-4 grid grid-cols-5 mobile:grid-cols-2">
          {[
            { label: "Total Bookings", value: stats.total, variant: "neutral" as const },
            { label: "Confirmed", value: stats.confirmed, variant: "brand" as const },
            { label: "Completed", value: stats.completed, variant: "success" as const },
            { label: "Cancelled", value: stats.cancelled, variant: "error" as const },
            { label: "Total Revenue", value: `$${stats.revenue.toFixed(0)}`, variant: "success" as const },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-start gap-2 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
              <span className="text-body font-body text-subtext-color">{label}</span>
              <span className="text-heading-2 font-heading-2 text-default-font">{value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
          <TextField className="h-auto w-72 flex-none" label="" helpText="" icon={<FeatherSearch />}>
            <TextField.Input placeholder="Search by ref, user, tour..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </TextField>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "CONFIRMED", "COMPLETED", "CANCELLED"] as StatusFilter[]).map((s) => (
              <Badge key={s} variant={statusFilter === s ? "brand" : "neutral"} icon={statusFilter === s ? <FeatherFilter /> : undefined} onClick={() => setStatusFilter(s)} className="cursor-pointer">
                {s === "all" ? "All" : s}
              </Badge>
            ))}
          </div>
        </div>

        {/* Bookings table */}
        <div className="w-full overflow-x-auto rounded-lg border border-solid border-neutral-border">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {[
                  { label: "Booking Ref", key: "bookingReference" as BookingSortKey },
                  { label: "User Name", key: "userName" as BookingSortKey },
                  { label: "Tour Name", key: "tourName" as BookingSortKey },
                  { label: "Travelers", key: "travelers" as BookingSortKey },
                  { label: "Amount", key: "amount" as BookingSortKey },
                  { label: "Payment", key: "paymentStatus" as BookingSortKey },
                  { label: "Status", key: "bookingStatus" as BookingSortKey },
                  { label: "Date", key: "bookingDate" as BookingSortKey },
                ].map(({ label, key }) => (
                  <th key={label} className="text-left px-4 py-3 text-body-bold font-body-bold text-subtext-color whitespace-nowrap">
                    <button
                      className="inline-flex items-center gap-2 hover:text-default-font transition-colors"
                      onClick={() => {
                        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else { setSortKey(key); setSortDir("asc"); }
                      }}
                    >
                      <span>{label}</span>
                      <span className="text-caption font-caption text-subtext-color">
                        {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-body-bold font-body-bold text-subtext-color whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-body font-body text-subtext-color">Loading bookings...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-body font-body text-subtext-color">No bookings found.</td></tr>
              ) : filtered.map((b) => (
                <tr key={b.id} className="border-t border-solid border-neutral-border hover:bg-neutral-50">
                  <td className="px-4 py-3 text-body-bold font-body-bold text-default-font whitespace-nowrap">{b.bookingReference}</td>
                  <td className="px-4 py-3 text-body font-body text-subtext-color">
                    <span className="block max-w-[180px] truncate" title={userNameById.get(b.userId) ?? `User #${b.userId}`}>
                      {userNameById.get(b.userId) ?? `User #${b.userId}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body font-body text-subtext-color">
                    <span className="block max-w-[220px] truncate" title={tourNameById.get(b.tourPackageId) ?? `Tour #${b.tourPackageId}`}>
                      {tourNameById.get(b.tourPackageId) ?? `Tour #${b.tourPackageId}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body font-body text-default-font">{b.numberOfPeople}</td>
                  <td className="px-4 py-3 text-body-bold font-body-bold text-default-font whitespace-nowrap">${b.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.paymentStatus === "PAID" ? "success" : b.paymentStatus === "REFUNDED" ? "warning" : "neutral"}>{b.paymentStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">{statusBadge(b)}</td>
                  <td className="px-4 py-3 text-caption font-caption text-subtext-color whitespace-nowrap">{new Date(b.bookingDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="neutral-secondary" onClick={() => openModal(b, false)}>View</Button>
                      {(b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING") && (
                        <Button variant="neutral-secondary" onClick={() => openModal(b, true)}>Edit</Button>
                      )}
                      {(b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING") && (
                        <Button variant="destructive-secondary" icon={<FeatherX />} loading={cancelling === b.id} onClick={() => setCancelPromptBooking(b)}>Cancel</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          session={session}
          customerEmailOverride={userEmailById.get(selectedBooking.userId)}
          customerNameOverride={userNameById.get(selectedBooking.userId)}
          allowEdit={selectedBooking.bookingStatus !== "CANCELLED"}
          allowMarkCompleted={true}
          onMarkedCompleted={() => { void loadBookings(); }}
          onClose={() => setSelectedBooking(null)}
          onCancelled={() => { setSelectedBooking(null); void loadBookings(); }}
          onUpdated={() => { setSelectedBooking(null); void loadBookings(); }}
          initialEdit={modalEdit}
        />
      )}
      {createBookingOpen && (
        <AdminCreateBookingModal
          users={users}
          tours={tours}
          onClose={() => setCreateBookingOpen(false)}
          onCreated={() => void loadBookings()}
        />
      )}
      {cancelPromptBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCancelPromptBooking(null); }}
        >
          <div className="w-full max-w-3xl rounded-xl border border-solid border-error-300 bg-error-50 p-5">
            <div className="flex items-start gap-3">
              <FeatherAlertTriangle className="mt-0.5 text-heading-3 font-heading-3 text-error-600 flex-none" />
              <div className="flex grow flex-col gap-1">
                <span className="text-heading-3 font-heading-3 text-error-700">Cancel this booking?</span>
                <span className="text-body font-body text-error-700">
                  This cannot be undone. A refund will be initiated for <strong>{cancelPromptBooking.bookingReference}</strong> and a cancellation email will be sent.
                </span>
              </div>
            </div>
            <div className="mt-4 flex w-full justify-center">
              <div className="flex w-full max-w-[720px] items-center gap-3">
              <Button
                className="grow"
                size="large"
                variant="destructive-primary"
                loading={cancelling === cancelPromptBooking.id}
                onClick={() => void handleCancel(cancelPromptBooking)}
              >
                Yes, Cancel Booking
              </Button>
              <Button
                className="grow"
                size="large"
                variant="neutral-secondary"
                onClick={() => setCancelPromptBooking(null)}
                disabled={cancelling === cancelPromptBooking.id}
              >
                Keep Booking
              </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
