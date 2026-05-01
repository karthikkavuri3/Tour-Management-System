"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { AxiosError } from "axios";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { TextField } from "@/ui/components/TextField";
import {
  FeatherAlertTriangle, FeatherCalendar, FeatherCheckCircle, FeatherClock,
  FeatherCreditCard, FeatherDownload, FeatherEdit2, FeatherFileText, FeatherMapPin,
  FeatherPlus, FeatherRefreshCw, FeatherSave, FeatherTrash2, FeatherUser,
  FeatherUsers, FeatherX, FeatherXCircle,
} from "@subframe/core";
import type { Booking, Invoice, Session, TourPackage, TourSchedule } from "@/lib/models";
import {
  adminMarkBookingCompleted,
  cancelBooking, downloadInvoicePdf, downloadRefundInvoicePdf,
  getAllInvoices, getScheduleById, getTour, updateBooking,
} from "@/lib/api";
import { tourImageUrl } from "@/lib/imageUtils";

interface Props {
  booking: Booking;
  session: Session;
  onClose: () => void;
  onCancelled: () => void;
  onUpdated?: (updated: Booking, schedule: TourSchedule | null) => void;
  initialEdit?: boolean;
  customerEmailOverride?: string;
  customerNameOverride?: string;
  allowEdit?: boolean;
  allowMarkCompleted?: boolean;
  onMarkedCompleted?: (updated: Booking) => void;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const s = iso.includes("T") ? iso : iso + "T00:00:00";
  return new Date(s).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoDate(d: Date) {
  // Use local date parts — toISOString() returns UTC and would shift the date
  // backward for users in UTC+ timezones (e.g. IST = UTC+5:30).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StatusBadge({ booking }: { booking: Booking }) {
  if (booking.bookingStatus === "CONFIRMED" || booking.bookingStatus === "PENDING")
    return <Badge variant="brand" icon={<FeatherCalendar />}>Upcoming</Badge>;
  if (booking.bookingStatus === "COMPLETED")
    return <Badge variant="success" icon={<FeatherCheckCircle />}>Completed</Badge>;
  if (booking.bookingStatus === "CANCELLED")
    return <Badge variant="error" icon={<FeatherXCircle />}>Cancelled</Badge>;
  return <Badge variant="neutral">{booking.bookingStatus}</Badge>;
}

export default function BookingDetailModal({
  booking,
  session,
  onClose,
  onCancelled,
  onUpdated,
  initialEdit,
  customerEmailOverride,
  customerNameOverride,
  allowEdit = true,
  allowMarkCompleted = false,
  onMarkedCompleted,
}: Props) {
  // ── Local booking state so the modal reflects updates immediately ──────────
  const [localBooking, setLocalBooking] = useState<Booking>(booking);

  const [tour, setTour] = useState<TourPackage | null>(null);
  const [schedule, setSchedule] = useState<TourSchedule | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cancel flow
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Invoice download
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(initialEdit ?? false);
  const [editTravelers, setEditTravelers] = useState(
    (localBooking.travelers ?? []).map((t) => ({ ...t }))
  );
  const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [markCompletedMessage, setMarkCompletedMessage] = useState("");
  const [markCompletedError, setMarkCompletedError] = useState("");

  const canModify = allowEdit && (localBooking.bookingStatus === "CONFIRMED" || localBooking.bookingStatus === "PENDING");
  const canMarkCompleted = allowMarkCompleted && localBooking.bookingStatus === "CONFIRMED";
  const heroImage = tour?.imageUrl || tourImageUrl(tour?.title, tour?.title, "1200x500");
  const notificationEmail = customerEmailOverride ?? session.email;
  const notificationName = customerNameOverride ?? session.fullName;

  // ── Date picker constraints ─────────────────────────────────────────────
  const duration = tour?.durationDays ?? 1;
  const minStartDate = useMemo(() => {
    if (tour?.startDate) return new Date(tour.startDate + "T00:00:00");
    const d = new Date(); d.setDate(d.getDate() + 1); return d;
  }, [tour]);
  const maxStartDate = useMemo(() => {
    if (tour?.endDate) {
      const d = new Date(tour.endDate + "T00:00:00");
      d.setDate(d.getDate() - (duration - 1));
      return d;
    }
    const d = new Date(); d.setFullYear(d.getFullYear() + 2); return d;
  }, [tour, duration]);

  const editEndDate = useMemo(() => {
    if (!editStartDate) return undefined;
    const d = new Date(editStartDate);
    d.setDate(d.getDate() + duration - 1);
    return d;
  }, [editStartDate, duration]);

  const newTotalAmount = useMemo(() => {
    if (!tour) return localBooking.totalAmount;
    return +(tour.price * editTravelers.length).toFixed(2);
  }, [tour, editTravelers, localBooking.totalAmount]);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    void loadData();
    return () => { document.body.style.overflow = ""; };
  }, []);

  const loadData = async (b: Booking = localBooking) => {
    setLoadingData(true);
    const [t, s, inv] = await Promise.allSettled([
      getTour(b.tourPackageId),
      b.scheduleId ? getScheduleById(b.scheduleId) : Promise.resolve(null),
      getAllInvoices(b.id),
    ]);
    if (t.status === "fulfilled") setTour(t.value);
    if (s.status === "fulfilled" && s.value) {
      const sched = s.value as TourSchedule;
      setSchedule(sched);
      // Pre-populate the edit date picker with current travel start date
      if (sched.startDate) {
        setEditStartDate(new Date(sched.startDate + "T00:00:00"));
      }
    }
    if (inv.status === "fulfilled") setInvoices(inv.value);
    setLoadingData(false);
  };

  // ── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    setCancelling(true);
    setCancelError("");
    try {
      await cancelBooking(localBooking.id, {
        customerEmail:    notificationEmail,
        customerName:     notificationName,
        tourTitle:        tour?.title,
        destinationName:  tour?.destinationName,
        travelStartDate:  schedule?.startDate ? fmtDate(schedule.startDate) : undefined,
        travelEndDate:    schedule?.endDate   ? fmtDate(schedule.endDate)   : undefined,
        durationDays:     tour?.durationDays,
        numberOfTravelers: localBooking.numberOfPeople,
      });
      window.dispatchEvent(new CustomEvent("tms:tour-availability-changed", {
        detail: { tourPackageId: localBooking.tourPackageId, delta: localBooking.numberOfPeople },
      }));
      onCancelled();
    } catch (err) {
      setCancelError(
        (err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to cancel booking."
      );
      setCancelling(false);
    }
  };

  // ── Invoice download ─────────────────────────────────────────────────────
  const handleDownloadInvoice = async (inv: Invoice, idx: number) => {
    setDownloadingIdx(idx);
    const isRefund = (inv as Invoice & { invoiceType?: string }).invoiceType === "REFUND" ||
                     (inv.remarks ?? "").includes("cancelled");
    try {
      if (isRefund) {
        const blob = await downloadRefundInvoicePdf({
          recipientEmail:   session.email,
          customerName:     session.fullName,
          bookingReference: localBooking.bookingReference,
          invoiceNumber:    inv.invoiceNumber,
          tourTitle:        tour?.title,
          destinationName:  tour?.destinationName,
          travelStartDate:  schedule?.startDate ?? "",
          travelEndDate:    schedule?.endDate   ?? "",
          durationDays:     tour?.durationDays,
          numberOfTravelers: localBooking.numberOfPeople,
          totalAmount:      localBooking.totalAmount,
          cancellationDate: fmtDate(inv.invoiceDate),
        });
        triggerDownload(blob, `Refund-Invoice-${inv.invoiceNumber || localBooking.bookingReference}.pdf`);
      } else {
        const blob = await downloadInvoicePdf({
          recipientEmail:   session.email,
          customerName:     session.fullName,
          bookingReference: localBooking.bookingReference,
          invoiceNumber:    inv.invoiceNumber,
          tourTitle:        tour?.title,
          destinationName:  tour?.destinationName,
          travelStartDate:  schedule?.startDate ?? "",
          travelEndDate:    schedule?.endDate   ?? "",
          durationDays:     tour?.durationDays,
          numberOfTravelers: localBooking.numberOfPeople,
          pricePerPerson:   tour?.price,
          totalAmount:      localBooking.totalAmount,
          paymentMethod:    "CREDIT_CARD",
          bookingDate:      fmtDate(localBooking.bookingDate),
        });
        triggerDownload(blob, `Invoice-${inv.invoiceNumber || localBooking.bookingReference}.pdf`);
      }
    } catch { /* silent */ }
    finally { setDownloadingIdx(null); }
  };

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Edit: traveler helpers ────────────────────────────────────────────────
  const addTraveler = () => {
    setEditTravelers((prev) => [...prev, { firstName: "", lastName: "", age: 18 }]);
  };
  const removeTraveler = (i: number) => {
    setEditTravelers((prev) => prev.filter((_, idx) => idx !== i));
  };
  const updateTraveler = (i: number, key: "firstName" | "lastName" | "age", val: string | number) => {
    setEditTravelers((prev) => prev.map((t, idx) => idx === i ? { ...t, [key]: val } : t));
  };

  // ── Edit: save ───────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setMarkCompletedMessage("");
    setEditError("");
    if (editTravelers.length === 0) { setEditError("At least one traveler is required."); return; }
    if (editTravelers.some((t) => !t.firstName.trim())) { setEditError("Each traveler must have a first name."); return; }
    if (editTravelers.length > 6) { setEditError("Maximum 6 travelers allowed."); return; }

    setSavingEdit(true);
    try {
      const travelerDelta = editTravelers.length - localBooking.numberOfPeople;
      const datesChanged = editStartDate && editEndDate &&
        isoDate(editStartDate) !== (schedule?.startDate ?? "");

      const updated = await updateBooking(localBooking.id, {
        scheduleId:    localBooking.scheduleId,
        totalAmount:   newTotalAmount,
        customerEmail: notificationEmail,
        travelers:     editTravelers,
        newStartDate:  datesChanged ? isoDate(editStartDate!) : undefined,
        newEndDate:    datesChanged ? isoDate(editEndDate!)   : undefined,
      });

      // Immediately reflect the latest booking data
      setLocalBooking(updated);
      setEditTravelers((updated.travelers ?? []).map((t) => ({ ...t })));
      setIsEditing(false);
      await loadData(updated);
      // Pass the freshly loaded schedule so parent can update its map without a round-trip
      onUpdated?.(updated, schedule);
      if (travelerDelta !== 0) {
        window.dispatchEvent(new CustomEvent("tms:tour-availability-changed", {
          // More travelers => reduce availability (negative delta)
          detail: { tourPackageId: localBooking.tourPackageId, delta: -travelerDelta },
        }));
      }
    } catch (err) {
      setEditError(
        (err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to save changes."
      );
    } finally { setSavingEdit(false); }
  };

  const handleMarkCompleted = async () => {
    if (!canMarkCompleted) return;
    if (!confirm("Do you want to mark this as completed?")) return;
    setMarkingCompleted(true);
    setEditError("");
    setMarkCompletedError("");
    try {
      const updated = await adminMarkBookingCompleted(localBooking.id);
      setLocalBooking(updated);
      setIsEditing(false);
      setMarkCompletedMessage("Marked as completed");
      onMarkedCompleted?.(updated);
    } catch (err) {
      setMarkCompletedError(
        (err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to mark booking as completed."
      );
    } finally {
      setMarkingCompleted(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const paymentInvoice = invoices.find(
    (inv) => !((inv as Invoice & { invoiceType?: string }).invoiceType === "REFUND" || (inv.remarks ?? "").includes("cancelled"))
  ) ?? invoices[0];
  const refundInvoice = invoices.find(
    (inv) => (inv as Invoice & { invoiceType?: string }).invoiceType === "REFUND" || (inv.remarks ?? "").includes("cancelled")
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex w-full max-w-2xl flex-col bg-neutral-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh]">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="relative flex-none h-52 overflow-hidden">
          <img className="w-full h-full object-cover" src={heroImage} alt={tour?.title ?? "Tour"} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-heading-2 font-heading-2 text-white truncate">
                {loadingData ? `Tour #${localBooking.tourPackageId}` : (tour?.title || `Tour #${localBooking.tourPackageId}`)}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {tour && (
                  <>
                    <FeatherMapPin className="text-caption font-caption text-neutral-300 flex-none" />
                    <span className="text-caption font-caption text-neutral-300 truncate">{tour.title}</span>
                  </>
                )}
                <StatusBadge booking={localBooking} />
              </div>
            </div>
            <IconButton variant="neutral-secondary" icon={<FeatherX />} onClick={onClose} className="flex-none mb-1" />
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6">

          {markCompletedMessage && (
            <div className="rounded-lg border border-solid border-success-200 bg-success-50 px-4 py-3">
              <span className="text-body-bold font-body-bold text-success-700">{markCompletedMessage}</span>
            </div>
          )}
          {markCompletedError && (
            <div className="rounded-lg border border-solid border-error-200 bg-error-50 px-4 py-3">
              <span className="text-body font-body text-error-700">{markCompletedError}</span>
            </div>
          )}

          {/* Booking reference banner */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-5 py-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-400">Booking Reference</span>
              <div className="text-heading-2 font-heading-2 text-brand-700 tracking-widest mt-1">{localBooking.bookingReference}</div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-none">
              <span className="text-caption font-caption text-subtext-color">Booked on</span>
              <span className="text-body-bold font-body-bold text-default-font">{fmtDate(localBooking.bookingDate)}</span>
            </div>
          </div>

          {/* ── VIEW MODE ──────────────────────────────────────────────────── */}
          {!isEditing && (
            <>
              {/* Trip details */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-subtext-color">Trip Details</span>
                  <div className="flex items-center gap-2">
                    {canMarkCompleted && (
                      <Button
                        variant="success-secondary"
                        loading={markingCompleted}
                        onClick={() => void handleMarkCompleted()}
                      >
                        Mark Completed
                      </Button>
                    )}
                    {canModify && (
                      <Button variant="neutral-secondary" icon={<FeatherEdit2 />} onClick={() => { setIsEditing(true); setEditTravelers((localBooking.travelers ?? []).map((t) => ({ ...t }))); if (schedule?.startDate) setEditStartDate(new Date(schedule.startDate + "T00:00:00")); setEditError(""); setMarkCompletedMessage(""); }}>
                        Edit Booking
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-solid border-neutral-border bg-neutral-50 p-4">
                  {[
                    { icon: <FeatherCalendar />, label: "Travel Start", value: schedule ? fmtDate(schedule.startDate) : (loadingData ? "Loading…" : "—") },
                    { icon: <FeatherCalendar />, label: "Travel End",   value: schedule ? fmtDate(schedule.endDate)   : (loadingData ? "Loading…" : "—") },
                    { icon: <FeatherClock />,    label: "Duration",     value: tour ? `${tour.durationDays} days`     : (loadingData ? "Loading…" : "—") },
                    { icon: <FeatherUsers />,    label: "Travelers",    value: `${localBooking.numberOfPeople} ${localBooking.numberOfPeople === 1 ? "Person" : "People"}` },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-50">
                        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "text-body font-body text-brand-600" })}
                      </div>
                      <div>
                        <div className="text-caption font-caption text-subtext-color">{label}</div>
                        <div className="text-body-bold font-body-bold text-default-font">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Travelers */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-subtext-color">Traveler Details</span>
                <div className="flex flex-col gap-2">
                  {localBooking.travelers && localBooking.travelers.length > 0 ? localBooking.travelers.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-100">
                        <FeatherUser className="text-caption font-caption text-brand-600" />
                      </div>
                      <span className="grow text-body-bold font-body-bold text-default-font">{t.firstName} {t.lastName}</span>
                      <span className="text-caption font-caption text-subtext-color">Age {t.age}</span>
                    </div>
                  )) : (
                    <div className="flex items-center gap-3 rounded-xl border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                      <FeatherUsers className="text-body font-body text-subtext-color" />
                      <span className="text-body font-body text-subtext-color">{localBooking.numberOfPeople} traveler(s)</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── EDIT MODE ──────────────────────────────────────────────────── */}
          {isEditing && (
            <div className="flex flex-col gap-5 rounded-xl border border-solid border-brand-200 bg-brand-50/30 p-5">
              <div className="flex items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font">Edit Booking</span>
                <Button size="small" variant="neutral-secondary" icon={<FeatherX />} onClick={() => { setIsEditing(false); setEditError(""); }}>
                  Cancel Edit
                </Button>
              </div>

              {/* Date picker */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-subtext-color">
                  Select New Travel Start Date (optional)
                </span>
                {tour?.startDate && tour?.endDate && (
                  <p className="text-caption font-caption text-subtext-color">
                    Booking window: {fmtDate(tour.startDate)} → {fmtDate(tour.endDate)} &bull; Duration: {duration} days
                  </p>
                )}
                <div className="flex flex-wrap gap-4 items-start">
                  <div className="rdp-custom rounded-xl border border-solid border-neutral-border bg-neutral-50 p-2">
                    <DayPicker
                      mode="single"
                      selected={editStartDate}
                      onSelect={setEditStartDate}
                      disabled={[
                        { before: minStartDate },
                        { after: maxStartDate },
                      ]}
                      fromMonth={minStartDate}
                      toMonth={maxStartDate}
                    />
                  </div>
                  {editStartDate && editEndDate && (
                    <div className="flex flex-col gap-2 rounded-xl border border-solid border-brand-200 bg-brand-50 px-4 py-3 min-w-[160px]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-400">Selected Dates</span>
                      <div>
                        <div className="text-caption font-caption text-subtext-color">Start</div>
                        <div className="text-body-bold font-body-bold text-brand-700">{fmtDate(isoDate(editStartDate))}</div>
                      </div>
                      <div>
                        <div className="text-caption font-caption text-subtext-color">End</div>
                        <div className="text-body-bold font-body-bold text-brand-700">{fmtDate(isoDate(editEndDate))}</div>
                      </div>
                    </div>
                  )}
                </div>
                {!editStartDate && (
                  <p className="text-caption font-caption text-subtext-color italic">
                    Leave unselected to keep current travel dates.
                  </p>
                )}
              </div>

              {/* Traveler editor */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-subtext-color">Travelers</span>
                {editTravelers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-solid border-neutral-border bg-neutral-50 px-3 py-3">
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-100">
                      <FeatherUser className="text-caption font-caption text-brand-600" />
                    </div>
                    <TextField className="flex-1 h-auto" label="" helpText="">
                      <TextField.Input
                        placeholder="First name"
                        value={t.firstName}
                        onChange={(e) => updateTraveler(i, "firstName", e.target.value)}
                      />
                    </TextField>
                    <TextField className="flex-1 h-auto" label="" helpText="">
                      <TextField.Input
                        placeholder="Last name"
                        value={t.lastName ?? ""}
                        onChange={(e) => updateTraveler(i, "lastName", e.target.value)}
                      />
                    </TextField>
                    <TextField className="w-20 h-auto flex-none" label="" helpText="">
                      <TextField.Input
                        type="number"
                        placeholder="Age"
                        value={String(t.age)}
                        onChange={(e) => updateTraveler(i, "age", parseInt(e.target.value) || 0)}
                      />
                    </TextField>
                    {editTravelers.length > 1 && (
                      <IconButton size="small" variant="destructive-secondary" icon={<FeatherTrash2 />} onClick={() => removeTraveler(i)} />
                    )}
                  </div>
                ))}
                {editTravelers.length < 6 && (
                  <Button size="small" variant="neutral-secondary" icon={<FeatherPlus />} onClick={addTraveler}>
                    Add Traveler
                  </Button>
                )}
              </div>

              {editTravelers.length !== localBooking.numberOfPeople && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-subtext-color">Updated Price</span>
                  <div className="flex items-center justify-between rounded-xl border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                    <span className="text-body font-body text-subtext-color">
                      New total ({editTravelers.length} × {fmtMoney(tour?.price ?? 0)})
                    </span>
                    <span className="text-body-bold font-body-bold text-default-font">{fmtMoney(newTotalAmount)}</span>
                  </div>
                </div>
              )}

              {editError && (
                <span className="text-caption font-caption text-error-700">{editError}</span>
              )}

              <Button
                variant="brand-primary"
                icon={<FeatherSave />}
                loading={savingEdit}
                onClick={() => void handleSaveEdit()}
              >
                Save Changes
              </Button>
            </div>
          )}

          {/* Payment summary */}
          {!isEditing && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-subtext-color">Payment Summary</span>
              <div className="flex flex-col overflow-hidden rounded-xl border border-solid border-neutral-border">
                <div className="flex items-center justify-between bg-neutral-50 px-5 py-3">
                  <span className="text-body font-body text-subtext-color">Tour Price × {localBooking.numberOfPeople}</span>
                  <span className="text-body font-body text-default-font">{fmtMoney(localBooking.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between bg-brand-600 px-5 py-4">
                  <span className="text-body-bold font-body-bold text-white">Total Charged</span>
                  <span className="text-heading-3 font-heading-3 text-white">{fmtMoney(localBooking.totalAmount)}</span>
                </div>
              </div>

              {/* Payment status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FeatherCreditCard className="text-body font-body text-subtext-color" />
                    <span className="text-caption font-caption text-subtext-color">Payment</span>
                  </div>
                  <Badge
                    variant={
                      booking.paymentStatus === "SUCCESS" || booking.paymentStatus === "PAID"
                        ? "success"
                        : booking.paymentStatus === "REFUNDED"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {booking.paymentStatus === "SUCCESS" ? "PAID" : booking.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FeatherFileText className="text-body font-body text-subtext-color" />
                    <span className="text-caption font-caption text-subtext-color">Invoice(s)</span>
                  </div>
                  <span className="text-caption-bold font-caption-bold text-default-font">
                    {loadingData ? "Loading…" : (invoices.length > 0 ? `${invoices.length} issued` : "—")}
                  </span>
                </div>
              </div>

              {/* Invoice download buttons */}
              {!loadingData && invoices.length > 0 && (
                <div className="flex flex-col gap-2">
                  {paymentInvoice && (
                    <Button
                      variant="neutral-secondary"
                      icon={<FeatherDownload />}
                      loading={downloadingIdx === 0}
                      onClick={() => void handleDownloadInvoice(paymentInvoice, 0)}
                    >
                      Download Payment Invoice ({paymentInvoice.invoiceNumber})
                    </Button>
                  )}
                  {refundInvoice && (
                    <Button
                      variant="warning-secondary"
                      icon={<FeatherRefreshCw />}
                      loading={downloadingIdx === 1}
                      onClick={() => void handleDownloadInvoice(refundInvoice, 1)}
                    >
                      Download Refund Invoice ({refundInvoice.invoiceNumber})
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cancel confirmation */}
          {!isEditing && showCancelConfirm && (
            <div className="flex flex-col gap-4 rounded-xl border border-solid border-error-200 bg-error-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <FeatherAlertTriangle className="text-heading-3 font-heading-3 text-error-600 flex-none mt-0.5" />
                <div>
                  <div className="text-body-bold font-body-bold text-error-700">Cancel this booking?</div>
                  <div className="text-caption font-caption text-error-600 mt-1">
                    This cannot be undone. A refund will be initiated for <strong>{localBooking.bookingReference}</strong> and a cancellation email will be sent.
                  </div>
                </div>
              </div>
              {cancelError && <span className="text-caption font-caption text-error-700">{cancelError}</span>}
              <div className="flex items-center gap-3">
                <Button className="grow" variant="destructive-primary" loading={cancelling} onClick={() => void handleCancel()}>Yes, Cancel Booking</Button>
                <Button variant="neutral-secondary" onClick={() => { setShowCancelConfirm(false); setCancelError(""); }}>Keep Booking</Button>
              </div>
            </div>
          )}

          {/* Action row */}
          {!isEditing && (
            <div className="flex items-center gap-3 pb-2">
              {canModify && !showCancelConfirm && (
                <Button
                  variant="destructive-secondary"
                  icon={<FeatherXCircle />}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel Booking
                </Button>
              )}
              {localBooking.bookingStatus === "CANCELLED" && (
                <div className="flex items-center gap-2 text-warning-600">
                  <FeatherRefreshCw className="text-body font-body" />
                  <span className="text-caption-bold font-caption-bold">Refund Processed</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
