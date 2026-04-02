"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { TextField } from "@/ui/components/TextField";
import {
  FeatherArrowUpDown, FeatherCalendar, FeatherCalendarCheck,
  FeatherCheck, FeatherCheckCircle, FeatherChevronDown,
  FeatherEdit2, FeatherEye, FeatherFileText, FeatherFilter, FeatherKey,
  FeatherLock, FeatherMail, FeatherMapPin, FeatherPhone, FeatherRefreshCw,
  FeatherSave, FeatherSearch, FeatherShield,
  FeatherUser, FeatherUserCircle, FeatherUsers, FeatherX, FeatherXCircle,
} from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import type { Booking, Session, TourPackage, TourSchedule } from "@/lib/models";
import {
  getMyBookings, cancelBooking, getMyProfile, updateMyProfile, changeMyPassword,
  getTours, getSchedules, getScheduleById,
} from "@/lib/api";
import { tourImageUrl } from "@/lib/imageUtils";
import { writeSession } from "@/lib/session";
import BookingDetailModal from "@/components/BookingDetailModal";
import AppNavbar from "@/components/AppNavbar";

type SortKey = "newest" | "oldest" | "price-high" | "price-low";
type StatusFilter = "all" | "UPCOMING" | "COMPLETED" | "CANCELLED";
type ActiveTab = "bookings" | "profile";

interface Props { session: Session; onLogout: () => void; }

export default function MyBookingsPage({ session, onLogout }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (searchParams.get("tab") === "profile" ? "profile" : "bookings"));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [openInEdit, setOpenInEdit] = useState(false);
  const [tourMap, setTourMap] = useState<Record<number, TourPackage>>({});
  const [scheduleMap, setScheduleMap] = useState<Record<number, TourSchedule>>({});

  // Profile sub-tab
  const [profileSection, setProfileSection] = useState<"personal" | "security">("personal");

  // Profile
  const [fullName, setFullName] = useState(session.fullName);
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    void loadBookings();
    void loadProfile();
  }, []);

  useEffect(() => {
    setActiveTab(searchParams.get("tab") === "profile" ? "profile" : "bookings");
  }, [searchParams]);

  const fmtDate = (s?: string | null) => {
    if (!s) return "—";
    try {
      // Append local-time marker so date strings like "2026-04-09" are parsed
      // as local midnight instead of UTC midnight (UTC midnight shifts the date
      // back by the local UTC offset for users east of UTC, e.g. IST = UTC+5:30).
      const local = s.includes("T") ? s : s + "T00:00:00";
      return new Date(local).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }
    catch { return s; }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const [bks, tours, schedules] = await Promise.allSettled([
        getMyBookings(session.userId),
        getTours(),
        getSchedules(),
      ]);
      if (bks.status === "fulfilled") setBookings(bks.value);
      if (tours.status === "fulfilled")
        setTourMap(Object.fromEntries(tours.value.map((t) => [t.id, t])));
      if (schedules.status === "fulfilled")
        setScheduleMap(Object.fromEntries(schedules.value.map((s) => [s.id, s])));
    } catch { setBookings([]); }
    finally { setLoading(false); }
  };

  const loadProfile = async () => {
    try {
      const p = await getMyProfile();
      setFullName(p.fullName);
      setPhone(p.phone || "");
    } catch { /* use session data */ }
  };

  const stats = useMemo(() => {
    const upcoming = bookings.filter((b) => b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING").length;
    const completed = bookings.filter((b) => b.bookingStatus === "COMPLETED").length;
    const cancelled = bookings.filter((b) => b.bookingStatus === "CANCELLED").length;
    const refunded = bookings.filter((b) => b.paymentStatus === "REFUNDED").length;
    return { upcoming, completed, cancelled, refunded };
  }, [bookings]);

  const filtered = useMemo(() => {
    let list = [...bookings];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((b) =>
        b.bookingReference.toLowerCase().includes(q) ||
        (tourMap[b.tourPackageId]?.title ?? "").toLowerCase().includes(q) ||
        (tourMap[b.tourPackageId]?.destination ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      if (statusFilter === "UPCOMING") list = list.filter((b) => b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING");
      else list = list.filter((b) => b.bookingStatus === statusFilter);
    }
    if (sortKey === "newest") list.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
    else if (sortKey === "oldest") list.sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
    else if (sortKey === "price-high") list.sort((a, b) => b.totalAmount - a.totalAmount);
    else list.sort((a, b) => a.totalAmount - b.totalAmount);
    return list;
  }, [bookings, search, statusFilter, sortKey]);

  const handleCancel = async (b: Booking) => {
    if (!confirm(`Cancel booking ${b.bookingReference}?`)) return;
    setCancelling(b.id);
    try {
      const tour = tourMap[b.tourPackageId];
      const sched = scheduleMap[b.scheduleId];
      await cancelBooking(b.id, {
        customerEmail: session.email,
        customerName: session.fullName,
        tourTitle: tour?.title,
        destinationName: tour?.destination,
        travelStartDate: sched?.startDate ? fmtDate(sched.startDate) : undefined,
        travelEndDate: sched?.endDate ? fmtDate(sched.endDate) : undefined,
        durationDays: tour?.durationDays,
        numberOfTravelers: b.numberOfPeople,
      });
      // Release availability in open tour lists/details immediately.
      window.dispatchEvent(new CustomEvent("tms:tour-availability-changed", {
        detail: { tourPackageId: b.tourPackageId, delta: b.numberOfPeople },
      }));
      await loadBookings();
    }
    catch (err) { alert((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to cancel booking."); }
    finally { setCancelling(null); }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) { setProfileError("Name is required."); return; }
    setProfileSaving(true); setProfileError(""); setProfileMsg("");
    try {
      const updated = await updateMyProfile({ fullName: fullName.trim(), phone: phone.trim() || undefined });
      setFullName(updated.fullName);
      setPhone(updated.phone || "");
      const nextSession: Session = { ...session, fullName: updated.fullName };
      writeSession(nextSession);
      window.dispatchEvent(new CustomEvent("tms:session-updated", { detail: nextSession }));
      setProfileMsg("Profile updated successfully!");
    }
    catch (err) { setProfileError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to save profile."); }
    finally { setProfileSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { setPwError("Fill all password fields."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwSaving(true); setPwError(""); setPwMsg("");
    try { await changeMyPassword({ currentPassword: currentPw, newPassword: newPw }); setPwMsg("Password changed!"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    catch (err) { setPwError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to change password."); }
    finally { setPwSaving(false); }
  };

  const statusBadge = (b: Booking) => {
    if (b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING") return <Badge variant="brand">Upcoming</Badge>;
    if (b.bookingStatus === "COMPLETED") return <Badge variant="success">Completed</Badge>;
    if (b.bookingStatus === "CANCELLED") return <Badge variant="error">Cancelled</Badge>;
    return <Badge variant="neutral">{b.bookingStatus}</Badge>;
  };

  const canModify = (b: Booking) => b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING";


  return (
    <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
      <AppNavbar
        session={session}
        onLogout={onLogout}
        links={[
          { label: "Discover Tours", active: false,                         onClick: () => navigate("/explore") },
          { label: "My Bookings",    active: activeTab === "bookings",      onClick: () => navigate("/my-bookings?tab=bookings") },
          { label: "Profile",        active: activeTab === "profile",       onClick: () => navigate("/my-bookings?tab=profile") },
        ]}
      />

      {/* ── Bookings tab ────────────────────────────────────────────────────── */}
      {activeTab === "bookings" && <div className="flex w-full flex-col items-center gap-8 px-12 py-12 mobile:px-4 mobile:py-6">
        <div className="flex w-full max-w-[1280px] flex-col items-start gap-8">
          <span className="text-heading-1 font-heading-1 text-default-font">My Bookings</span>

          {/* Stats */}
          <div className="flex w-full flex-col items-start gap-6">
          <div className="w-full items-start gap-4 grid grid-cols-4 mobile:grid-cols-2">
            {[
              { label: "Upcoming", count: stats.upcoming, bg: "bg-brand-100", icon: <FeatherCalendarCheck className="text-heading-3 font-heading-3 text-brand-600" /> },
              { label: "Completed", count: stats.completed, bg: "bg-success-100", icon: <FeatherCheckCircle className="text-heading-3 font-heading-3 text-success-600" /> },
              { label: "Cancelled", count: stats.cancelled, bg: "bg-error-100", icon: <FeatherXCircle className="text-heading-3 font-heading-3 text-error-600" /> },
              { label: "Refunded", count: stats.refunded, bg: "bg-warning-100", icon: <FeatherRefreshCw className="text-heading-3 font-heading-3 text-warning-600" /> },
            ].map(({ label, count, bg, icon }) => (
              <div key={label} className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-5 py-5">
                <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${bg}`}>{icon}</div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-heading-1 font-heading-1 text-default-font">{count}</span>
                  <span className="text-body font-body text-subtext-color">{label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
            <TextField className="h-8 w-64 flex-none mobile:grow mobile:shrink-0 mobile:basis-0" label="" helpText="" icon={<FeatherSearch />}>
              <TextField.Input
                className="text-body-bold font-body-bold placeholder:text-body-bold placeholder:font-body-bold"
                placeholder="Search by booking ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </TextField>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "UPCOMING", "COMPLETED", "CANCELLED"] as StatusFilter[]).map((s) => (
                <Badge
                  key={s}
                  variant={statusFilter === s ? "brand" : "neutral"}
                  icon={statusFilter === s ? <FeatherFilter /> : undefined}
                  onClick={() => setStatusFilter(s)}
                  className="cursor-pointer h-8 px-4 text-body-bold font-body-bold"
                >
                  <span className="text-body-bold font-body-bold">
                    {s === "all" ? "All Status" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </span>
                </Badge>
              ))}
            </div>
            <div className="flex grow shrink-0 basis-0 items-center justify-end gap-2">
              <SubframeCore.DropdownMenu.Root>
                <SubframeCore.DropdownMenu.Trigger asChild>
                  <Button className="h-8 px-4 text-body-bold font-body-bold" variant="neutral-secondary" icon={<FeatherArrowUpDown />} iconRight={<FeatherChevronDown />}>
                    {sortKey === "newest" ? "Newest First" : sortKey === "oldest" ? "Oldest First" : sortKey === "price-high" ? "Price: High to Low" : "Price: Low to High"}
                  </Button>
                </SubframeCore.DropdownMenu.Trigger>
                <SubframeCore.DropdownMenu.Portal>
                  <SubframeCore.DropdownMenu.Content side="bottom" align="end" sideOffset={4} asChild>
                    <DropdownMenu>
                      {(["newest", "oldest", "price-high", "price-low"] as SortKey[]).map((k) => (
                        <DropdownMenu.DropdownItem key={k} icon={null} onClick={() => setSortKey(k)}>
                          {k === "newest" ? "Newest First" : k === "oldest" ? "Oldest First" : k === "price-high" ? "Price: High to Low" : "Price: Low to High"}
                        </DropdownMenu.DropdownItem>
                      ))}
                    </DropdownMenu>
                  </SubframeCore.DropdownMenu.Content>
                </SubframeCore.DropdownMenu.Portal>
              </SubframeCore.DropdownMenu.Root>
            </div>
          </div>

          {/* Bookings grid */}
            {loading ? (
              <span className="text-body font-body text-subtext-color">Loading bookings...</span>
            ) : filtered.length === 0 ? (
              <div className="flex w-full flex-col items-center gap-4 py-12">
                <FeatherCalendar className="text-heading-1 font-heading-1 text-subtext-color" />
                <span className="text-body font-body text-subtext-color">No bookings found.</span>
                <Button onClick={() => navigate("/explore")}>Explore Tours</Button>
              </div>
            ) : (
              <div className="w-full gap-6 grid grid-cols-3 mobile:grid-cols-1">
                {filtered.map((b) => {
                const tour = tourMap[b.tourPackageId];
                const sched = scheduleMap[b.scheduleId];
                return (
                  <div
                    key={b.id}
                    className="flex grow shrink-0 basis-0 flex-col items-start gap-4 overflow-hidden rounded-xl border border-solid border-neutral-border bg-neutral-50 cursor-pointer hover:border-brand-600 hover:shadow-lg transition-all duration-200"
                    onClick={() => { setOpenInEdit(false); setSelectedBooking(b); }}
                  >
                    {/* Image — same height as Explore Tours */}
                    <img
                      className="h-64 w-full flex-none object-cover"
                      src={tour?.imageUrl || tourImageUrl(tour?.title, tour?.destinationName, "600x400")}
                      alt={tour?.title ?? "Tour"}
                    />

                    {/* Content — same padding as Explore Tours */}
                    <div className="flex w-full flex-col items-start gap-4 px-6 pb-6">

                      {/* Title row + status badge */}
                      <div className="flex w-full flex-col items-start gap-2">
                        <div className="flex w-full items-start gap-2">
                          <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
                            {tour?.title ?? `Tour #${b.tourPackageId}`}
                          </span>
                          {statusBadge(b)}
                        </div>
                        {tour?.destinationName && (
                          <div className="flex items-center gap-2">
                            <FeatherMapPin className="text-body font-body text-subtext-color" />
                            <span className="text-body font-body text-subtext-color">{tour.destinationName}</span>
                          </div>
                        )}
                        <span className="text-caption font-caption text-subtext-color">Ref: {b.bookingReference}</span>
                      </div>

                      {/* Info pills — same style as Explore Tours badges */}
                      <div className="flex w-full flex-wrap items-center gap-3">
                        {sched ? (
                          <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                            <FeatherCalendar className="text-caption font-caption text-default-font" />
                            <span className="text-caption-bold font-caption-bold text-default-font">
                              {fmtDate(sched.startDate)} → {fmtDate(sched.endDate)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                            <FeatherCalendar className="text-caption font-caption text-subtext-color" />
                            <span className="text-caption font-caption text-subtext-color">Dates unavailable</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                          <FeatherUsers className="text-caption font-caption text-default-font" />
                          <span className="text-caption-bold font-caption-bold text-default-font">
                            {b.numberOfPeople} {b.numberOfPeople === 1 ? "Traveler" : "Travelers"}
                          </span>
                        </div>
                      </div>

                      {/* Divider — matches Explore Tours */}
                      <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

                      {/* Price + payment status */}
                      <div className="flex w-full items-center gap-4">
                        <div className="flex grow shrink-0 basis-0 flex-col items-start">
                          <span className="text-caption font-caption text-subtext-color">Total Amount</span>
                          <span className={`text-heading-2 font-heading-2 ${b.bookingStatus === "CANCELLED" ? "text-subtext-color line-through" : "text-default-font"}`}>
                            ${b.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        <Badge
                          variant={b.paymentStatus === "PAID" ? "success" : b.paymentStatus === "REFUNDED" ? "warning" : "neutral"}
                          icon={b.paymentStatus === "PAID" ? <FeatherCheck /> : b.paymentStatus === "REFUNDED" ? <FeatherRefreshCw /> : undefined}
                        >
                          {b.paymentStatus}
                        </Badge>
                      </div>

                      {/* Action buttons — all flex-1 so they are perfectly equal width */}
                      <div className="flex w-full items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {canModify(b) ? (
                          <>
                            <Button
                              className="flex-1"
                              size="small"
                              variant="destructive-secondary"
                              icon={<FeatherX />}
                              loading={cancelling === b.id}
                              onClick={() => void handleCancel(b)}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="flex-1"
                              size="small"
                              variant="brand-secondary"
                              icon={<FeatherEdit2 />}
                              onClick={() => { setOpenInEdit(true); setSelectedBooking(b); }}
                            >
                              Edit
                            </Button>
                            <Button
                              className="flex-1"
                              size="small"
                              variant="neutral-secondary"
                              icon={<FeatherEye />}
                              onClick={() => { setOpenInEdit(false); setSelectedBooking(b); }}
                            >
                              Details
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="flex-1"
                              size="small"
                              variant="neutral-secondary"
                              icon={<FeatherFileText />}
                              onClick={() => { setOpenInEdit(false); setSelectedBooking(b); }}
                            >
                              Invoice
                            </Button>
                            <Button
                              className="flex-1"
                              size="small"
                              variant="brand-secondary"
                              icon={<FeatherEye />}
                              onClick={() => { setOpenInEdit(false); setSelectedBooking(b); }}
                            >
                              Details
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* ── Profile tab ─────────────────────────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="flex w-full grow items-start justify-center px-4 py-12 overflow-auto">
          <div className="flex w-full max-w-lg origin-top scale-[1.15] flex-col overflow-hidden rounded-2xl border border-solid border-neutral-border bg-neutral-50 shadow-xl mobile:scale-100">

            {/* Tab switcher header */}
            <div className="flex w-full border-b border-solid border-neutral-border bg-neutral-100">
              {(["personal", "security"] as const).map((section) => {
                const isActive = profileSection === section;
                return (
                  <button
                    key={section}
                    className={`group relative flex flex-1 items-center justify-center gap-2.5 px-6 py-5 text-heading-3 font-heading-3 transition-all duration-200 select-none outline-none
                      ${isActive
                        ? "text-brand-600 bg-neutral-0"
                        : "text-subtext-color hover:text-default-font hover:bg-neutral-50 active:scale-95"
                      }`}
                    onClick={() => setProfileSection(section)}
                  >
                    {section === "personal"
                      ? <FeatherUserCircle className={`text-heading-3 font-heading-3 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                      : <FeatherShield    className={`text-heading-3 font-heading-3 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                    }
                    {section === "personal" ? "Personal Info" : "Security"}
                    {/* Active underline slide-in */}
                    <span className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-brand-600 transition-all duration-300 ${isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />
                  </button>
                );
              })}
            </div>

            {/* Panel body */}
            <div className="flex flex-col gap-6 px-8 py-8">

              {/* Personal information panel */}
              {profileSection === "personal" && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-heading-3 font-heading-3 text-default-font">Personal Information</span>
                    <span className="text-caption font-caption text-subtext-color">Update your display name and contact details</span>
                  </div>
                  <div className="flex w-full flex-col items-start gap-4">
                    <div className="flex w-full flex-col items-start gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">Full Name</span>
                      <TextField className="h-auto w-full flex-none" helpText="Your display name across the platform">
                        <TextField.Input placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                      </TextField>
                    </div>
                    <div className="flex w-full flex-col items-start gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">Phone Number</span>
                      <TextField className="h-auto w-full flex-none" helpText="Used for booking confirmations" icon={<FeatherPhone />}>
                        <TextField.Input type="tel" placeholder="+1 (555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </TextField>
                    </div>
                    <div className="flex w-full flex-col items-start gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">Email Address</span>
                      <div className="flex w-full items-center gap-3 rounded-md border border-solid border-neutral-border bg-neutral-100 px-4 py-3">
                        <FeatherMail className="text-body font-body text-subtext-color" />
                        <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">{session.email}</span>
                        <FeatherLock className="text-body font-body text-subtext-color flex-none" />
                      </div>
                      <span className="text-caption font-caption text-subtext-color">Email cannot be changed</span>
                    </div>
                  </div>
                  {profileMsg   && <span className="text-caption font-caption text-success-700">{profileMsg}</span>}
                  {profileError && <span className="text-caption font-caption text-error-700">{profileError}</span>}
                  <Button className="w-full" variant="brand-primary" icon={<FeatherSave />} loading={profileSaving} onClick={() => void handleSaveProfile()}>
                    Save Changes
                  </Button>
                </>
              )}

              {/* Security panel */}
              {profileSection === "security" && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-heading-3 font-heading-3 text-default-font">Security Settings</span>
                    <span className="text-caption font-caption text-subtext-color">Change your account password</span>
                  </div>
                  <div className="flex w-full flex-col items-start gap-4">
                    <div className="flex w-full flex-col items-start gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">Current Password</span>
                      <TextField className="h-auto w-full flex-none" helpText="Enter your current password to make changes" icon={<FeatherLock />}>
                        <TextField.Input type="password" placeholder="••••••••" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                      </TextField>
                    </div>
                    <div className="flex w-full flex-col items-start gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">New Password</span>
                      <TextField className="h-auto w-full flex-none" helpText="Minimum 6 characters" icon={<FeatherLock />}>
                        <TextField.Input type="password" placeholder="••••••••" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                      </TextField>
                    </div>
                    <div className="flex w-full flex-col items-start gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">Confirm New Password</span>
                      <TextField className="h-auto w-full flex-none" helpText="Re-enter your new password" icon={<FeatherLock />}>
                        <TextField.Input type="password" placeholder="••••••••" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                      </TextField>
                    </div>
                  </div>
                  {pwMsg   && <span className="text-caption font-caption text-success-700">{pwMsg}</span>}
                  {pwError && <span className="text-caption font-caption text-error-700">{pwError}</span>}
                  <Button className="w-full" variant="brand-primary" icon={<FeatherKey />} loading={pwSaving} onClick={() => void handleChangePassword()}>
                    Update Password
                  </Button>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          session={session}
          initialEdit={openInEdit}
          onClose={() => { setSelectedBooking(null); setOpenInEdit(false); }}
          onCancelled={() => {
            setSelectedBooking(null);
            setOpenInEdit(false);
            void loadBookings();
          }}
          onUpdated={(updated, schedule) => {
            // Immediately patch the booking card so travelers/amount/dates show at once
            setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            setSelectedBooking(updated);
            // Add/overwrite the schedule in the map so date badges update right away
            if (schedule) {
              setScheduleMap((prev) => ({ ...prev, [schedule.id]: schedule }));
            } else if (updated.scheduleId) {
              // Fallback: fetch if modal didn't have it yet
              void getScheduleById(updated.scheduleId).then((sched) => {
                setScheduleMap((prev) => ({ ...prev, [sched.id]: sched }));
              }).catch(() => {/* non-critical */});
            }
            // Full background refresh for eventual consistency
            void loadBookings();
          }}
        />
      )}
    </div>
  );
}
