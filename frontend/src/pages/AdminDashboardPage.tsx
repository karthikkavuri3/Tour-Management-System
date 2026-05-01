"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import type { AxiosError } from "axios";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { TextField } from "@/ui/components/TextField";
import { ToggleGroup } from "@/ui/components/ToggleGroup";
import {
  FeatherAlertCircle, FeatherCalendar, FeatherCheck, FeatherCheckCircle,
  FeatherClock, FeatherEdit2, FeatherKey, FeatherLock, FeatherMail, FeatherPhone,
  FeatherPlus, FeatherSave, FeatherSearch, FeatherShield, FeatherStar, FeatherTrash,
  FeatherUserCircle, FeatherUsers, FeatherX, FeatherDollarSign, FeatherMap, FeatherMapPin,
} from "@subframe/core";
import type { Booking, Session, TourPackage, UserProfile } from "@/lib/models";
import {
  changeMyPassword,
  createUser as createUserApi,
  deleteTour,
  deleteUser,
  getAllBookings,
  getAllUsers,
  getMyProfile,
  getTours,
  updateMyProfile,
  updateTour,
  updateUser,
  createTour,
} from "@/lib/api";
import { tourImageUrl } from "@/lib/imageUtils";
import { writeSession } from "@/lib/session";
import AppNavbar from "@/components/AppNavbar";

const DURATION_FILTER: Record<string, { min: number; max: number }> = {
  "1-3": { min: 1, max: 3 },
  "4-7": { min: 4, max: 7 },
  "8+":  { min: 8, max: 999 },
};

interface Props { session: Session; onLogout: () => void; }

interface TourForm {
  title: string;
  description: string;
  imageUrl: string;
  destinationId: string;
  price: string;
  durationDays: string;
  maxCapacity: string;
  bookingsAvailable: string;
  startDate: string;
  endDate: string;
  itineraryHighlights: { title: string; details: string }[];
  whatsIncludedText: string;
}
type TourFormTextField =
  | "title"
  | "description"
  | "imageUrl"
  | "destinationId"
  | "price"
  | "durationDays"
  | "maxCapacity"
  | "bookingsAvailable"
  | "startDate"
  | "endDate";

type UserSortKey = "fullName" | "email" | "phone" | "roles" | "enabled";
type UserSortDir = "asc" | "desc";
type UserRole = "ADMIN" | "CUSTOMER";

const defaultIncludedItems = [
  "Accommodation",
  "All transportation",
  "Daily breakfast",
  "Expert guide",
  "All activities",
  "Travel insurance",
];

const buildItineraryByDuration = (durationDays: number): { title: string; details: string }[] => {
  if (durationDays <= 1) {
    return [
      {
        title: "Day 1: Arrival & Orientation",
        details: "Arrive at the destination and meet your expert guide. Orientation tour and trip overview.",
      },
    ];
  }
  if (durationDays === 2) {
    return [
      {
        title: "Day 1: Arrival & Orientation",
        details: "Arrive at the destination and meet your expert guide. Orientation tour and welcome briefing.",
      },
      {
        title: "Day 2: Core Experiences",
        details: "Explore key attractions and enjoy guided local experiences.",
      },
    ];
  }
  const midStart = 3;
  const midEnd = Math.max(midStart, Math.ceil(durationDays / 2));
  const finalStart = Math.min(durationDays, midEnd + 1);
  return [
    {
      title: "Day 1-2: Arrival & Orientation",
      details: "Arrive at the destination and meet your expert guide. Orientation tour, welcome dinner, and overview of the journey ahead.",
    },
    {
      title: `Day ${midStart}-${midEnd}: Core Experiences`,
      details: "Explore the most iconic attractions. Guided excursions, cultural experiences, and breathtaking scenery.",
    },
    {
      title: `Day ${finalStart}-${durationDays}: Farewell`,
      details: "Final excursion, free time for shopping, and a memorable farewell before departure.",
    },
  ];
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocal(s: string | undefined): Date | undefined {
  return s ? new Date(s + "T00:00:00") : undefined;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

const syncItineraryWithDuration = (
  current: { title: string; details: string }[],
  durationDays: number
): { title: string; details: string }[] => {
  const generated = buildItineraryByDuration(durationDays);
  return generated.map((item, idx) => ({
    title: item.title,
    details: current[idx]?.details ?? item.details,
  }));
};

const emptyForm = (): TourForm => ({
  title: "", description: "", imageUrl: "", destinationId: "1",
  price: "", durationDays: "", maxCapacity: "", bookingsAvailable: "",
  startDate: "", endDate: "",
  itineraryHighlights: buildItineraryByDuration(3),
  whatsIncludedText: defaultIncludedItems.join("\n"),
});

export default function AdminDashboardPage({ session, onLogout }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tours, setTours] = useState<TourPackage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tours" | "users" | "profile">(() => {
    const tab = searchParams.get("tab");
    if (tab === "tours") return "tours";
    if (tab === "users") return "users";
    if (tab === "profile") return "profile";
    return "overview";
  });
  const [profileSection, setProfileSection] = useState<"personal" | "security">("personal");
  const [fullName, setFullName] = useState(session.fullName);
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  // Tours-tab filter + sort state
  const [tourSearch, setTourSearch] = useState("");
  const [tourMinPrice, setTourMinPrice] = useState("");
  const [tourMaxPrice, setTourMaxPrice] = useState("");
  const [tourDuration, setTourDuration] = useState("");
  const [tourAvailability, setTourAvailability] = useState("");
  const [tourSort, setTourSort] = useState("newest");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userSortKey, setUserSortKey] = useState<UserSortKey>("fullName");
  const [userSortDir, setUserSortDir] = useState<UserSortDir>("asc");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [userFormFullName, setUserFormFullName] = useState("");
  const [userFormPhone, setUserFormPhone] = useState("");
  const [userFormRoles, setUserFormRoles] = useState<UserRole[]>(["CUSTOMER"]);
  const [userResetPassword, setUserResetPassword] = useState(false);
  const [userFormError, setUserFormError] = useState("");
  const [userFormSaving, setUserFormSaving] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("CUSTOMER");
  const [newUserError, setNewUserError] = useState("");
  const [newUserSaving, setNewUserSaving] = useState(false);

  // Tour create / edit modal
  const [tourModal, setTourModal] = useState<"create" | "edit" | null>(null);
  const [editingTour, setEditingTour] = useState<TourPackage | null>(null);
  const [form, setForm] = useState<TourForm>(emptyForm());
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { void loadData(); void loadProfile(); }, []);

  useEffect(() => {
    const onAvailabilityChanged = (event: Event) => {
      const custom = event as CustomEvent<{ tourPackageId: number; delta: number }>;
      const { tourPackageId, delta } = custom.detail ?? {};
      if (!tourPackageId || !delta) return;
      setTours((prev) =>
        prev.map((t) =>
          t.id === tourPackageId
            ? { ...t, bookingsAvailable: Math.max(0, t.bookingsAvailable + delta) }
            : t
        )
      );
    };
    window.addEventListener("tms:tour-availability-changed", onAvailabilityChanged);
    return () => window.removeEventListener("tms:tour-availability-changed", onAvailabilityChanged);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t, u, b] = await Promise.all([getTours(), getAllUsers(), getAllBookings()]);
      setTours(t); setUsers(u); setBookings(b);
    }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  // Keep the selected tab in sync with URL query (e.g. /admin?tab=tours)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "tours") {
      setActiveTab("tours");
      void loadData();
      return;
    }
    if (tab === "users") {
      setActiveTab("users");
      return;
    }
    if (tab === "profile") {
      setActiveTab("profile");
      return;
    }
    setActiveTab("overview");
  }, [searchParams]);

  const loadProfile = async () => {
    try {
      const p = await getMyProfile();
      setFullName(p.fullName);
      setPhone(p.phone || "");
    } catch {}
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
    } catch (err) {
      setProfileError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { setPwError("Fill all password fields."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwSaving(true); setPwError(""); setPwMsg("");
    try {
      await changeMyPassword({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg("Password changed!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setPwError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  };

  const stats = useMemo(() => ({
    totalTours: tours.length,
    activeBookings: bookings.filter((b) => b.bookingStatus === "CONFIRMED" || b.bookingStatus === "PENDING").length,
    totalUsers: users.length,
    revenue: bookings.filter((b) => b.paymentStatus === "SUCCESS").reduce((sum, b) => sum + b.totalAmount, 0),
  }), [tours, users, bookings]);

  const filteredTours = useMemo(() => {
    const list = tours.filter((t) => {
      if (tourSearch && !t.title.toLowerCase().includes(tourSearch.toLowerCase()) && !t.destinationName.toLowerCase().includes(tourSearch.toLowerCase())) return false;
      if (tourMinPrice && t.price < Number(tourMinPrice)) return false;
      if (tourMaxPrice && t.price > Number(tourMaxPrice)) return false;
      if (tourDuration && DURATION_FILTER[tourDuration]) {
        const { min, max } = DURATION_FILTER[tourDuration];
        if (t.durationDays < min || t.durationDays > max) return false;
      }
      if (tourAvailability === "Available" && t.bookingsAvailable === 0) return false;
      if (tourAvailability === "Limited" && (t.bookingsAvailable === 0 || t.bookingsAvailable > 5)) return false;
      return true;
    });
    if (tourSort === "price-high") list.sort((a, b) => b.price - a.price);
    else if (tourSort === "price-low") list.sort((a, b) => a.price - b.price);
    else if (tourSort === "oldest") list.sort((a, b) => a.id - b.id);
    else list.sort((a, b) => b.id - a.id);
    return list;
  }, [tours, tourSearch, tourMinPrice, tourMaxPrice, tourDuration, tourAvailability, tourSort]);

  const bookedTravelersByTour = useMemo(() => {
    const map: Record<number, number> = {};
    for (const b of bookings) {
      const includeBooking =
        (b.bookingStatus === "CONFIRMED" ||
         b.bookingStatus === "PENDING" ||
         b.bookingStatus === "COMPLETED") &&
        b.paymentStatus !== "REFUNDED";
      if (!includeBooking) continue;
      map[b.tourPackageId] = (map[b.tourPackageId] ?? 0) + b.numberOfPeople;
    }
    return map;
  }, [bookings]);

  const mostBookedTours = useMemo(
    () =>
      [...tours]
        .sort((a, b) => (bookedTravelersByTour[b.id] ?? 0) - (bookedTravelersByTour[a.id] ?? 0))
        .slice(0, 4),
    [tours, bookedTravelersByTour]
  );

  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      const q = userSearch.trim().toLowerCase();
      if (q) {
        const hay = `${u.fullName} ${u.email} ${u.phone ?? ""} ${u.roles.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (userRoleFilter !== "all" && !u.roles.includes(userRoleFilter)) return false;
      return true;
    });

    const valueForSort = (u: UserProfile): string | number => {
      if (userSortKey === "fullName") return u.fullName.toLowerCase();
      if (userSortKey === "email") return u.email.toLowerCase();
      if (userSortKey === "phone") return (u.phone ?? "").toLowerCase();
      if (userSortKey === "roles") return [...u.roles].sort().join(",").toLowerCase();
      return u.enabled ? 1 : 0;
    };

    list.sort((a, b) => {
      const va = valueForSort(a);
      const vb = valueForSort(b);
      if (va < vb) return userSortDir === "asc" ? -1 : 1;
      if (va > vb) return userSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [users, userSearch, userRoleFilter, userSortKey, userSortDir]);

  const handleDeleteTour = async (id: number) => {
    if (!confirm("Delete this tour? This cannot be undone.")) return;
    try { await deleteTour(id); await loadData(); }
    catch (err) { alert((err as AxiosError<{ message?: string }>).response?.data?.message || "Cannot delete tour with active bookings."); }
  };

  const openUserEdit = (u: UserProfile) => {
    setEditingUser(u);
    setUserFormFullName(u.fullName);
    setUserFormPhone(u.phone ?? "");
    const normalizedRoles = (u.roles ?? []).filter((role): role is UserRole => role === "ADMIN" || role === "CUSTOMER");
    setUserFormRoles(normalizedRoles.length > 0 ? normalizedRoles : ["CUSTOMER"]);
    setUserResetPassword(false);
    setUserFormError("");
    setUserModalOpen(true);
  };

  const toggleUserRole = (role: UserRole) => {
    // Single-select: only one role can be active at a time.
    setUserFormRoles([role]);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!userFormFullName.trim()) { setUserFormError("Full name is required."); return; }
    if (userFormRoles.length === 0) { setUserFormError("At least one role is required."); return; }
    setUserFormSaving(true); setUserFormError("");
    try {
      await updateUser(editingUser.id, {
        fullName: userFormFullName.trim(),
        phone: userFormPhone.trim() || undefined,
        roles: userFormRoles,
        ...(userResetPassword ? { password: "test123" } : {}),
      });
      setUserModalOpen(false);
      await loadData();
    } catch (err) {
      setUserFormError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to update user.");
    } finally { setUserFormSaving(false); }
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (!confirm(`Delete user ${u.fullName} (${u.email})? This action cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      if (editingUser?.id === u.id) setUserModalOpen(false);
      await loadData();
    } catch (err) {
      alert((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to delete user.");
    }
  };

  const openCreateUser = () => {
    setNewUserFullName("");
    setNewUserPhone("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserConfirmPassword("");
    setNewUserRole("CUSTOMER");
    setNewUserError("");
    setCreateUserModalOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUserFullName.trim()) { setNewUserError("Full name is required."); return; }
    if (!newUserEmail.trim()) { setNewUserError("Email is required."); return; }
    if (!newUserPassword.trim()) { setNewUserError("Password is required."); return; }
    if (!newUserConfirmPassword.trim()) { setNewUserError("Confirm password is required."); return; }
    if (newUserPassword.trim().length < 6) { setNewUserError("Password must be at least 6 characters."); return; }
    if (newUserPassword !== newUserConfirmPassword) { setNewUserError("Password and confirm password must match."); return; }
    setNewUserSaving(true); setNewUserError("");
    try {
      await createUserApi({
        fullName: newUserFullName.trim(),
        email: newUserEmail.trim(),
        phone: newUserPhone.trim() || undefined,
        password: newUserPassword.trim(),
        enabled: true,
        roles: [newUserRole],
      });
      setCreateUserModalOpen(false);
      await loadData();
    } catch (err) {
      setNewUserError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to create user.");
    } finally { setNewUserSaving(false); }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setFormError("");
    setEditingTour(null);
    setTourModal("create");
  };

  const openEdit = (tour: TourPackage) => {
    const duration = Math.max(1, Number(tour.durationDays || 1));
    const itineraryFromTour = (tour.itineraryHighlights ?? [])
      .map((i) => ({ title: (i.title ?? "").trim(), details: (i.details ?? "").trim() }))
      .filter((i) => i.title);
    setForm({
      title: tour.title,
      description: tour.description ?? "",
      imageUrl: tour.imageUrl ?? "",
      destinationId: String(tour.destinationId),
      price: String(tour.price),
      durationDays: String(tour.durationDays),
      maxCapacity: String(tour.maxCapacity),
      bookingsAvailable: String(tour.bookingsAvailable),
      startDate: tour.startDate ?? "",
      endDate: tour.endDate ?? "",
      itineraryHighlights:
        itineraryFromTour.length > 0
          ? syncItineraryWithDuration(itineraryFromTour, duration)
          : buildItineraryByDuration(duration),
      whatsIncludedText:
        (tour.whatsIncluded && tour.whatsIncluded.length > 0
          ? tour.whatsIncluded.join("\n")
          : defaultIncludedItems.join("\n")),
    });
    setFormError("");
    setEditingTour(tour);
    setTourModal("edit");
  };

  const handleFormSubmit = async () => {
    if (!form.title.trim() || !form.price || !form.durationDays || !form.maxCapacity || !form.bookingsAvailable) {
      setFormError("Title, price, duration, max capacity, and bookings available are required.");
      return;
    }
    setFormLoading(true); setFormError("");
    // Auto-generate a destination-relevant image when none is provided
    const resolvedImageUrl = form.imageUrl.trim() ||
      tourImageUrl(form.title, form.title, "1200x800");
    const itineraryHighlights = form.itineraryHighlights
      .map((i) => ({ title: i.title.trim(), details: i.details.trim() }))
      .filter((i) => i.title);
    const whatsIncluded = form.whatsIncludedText
      .split("\n")
      .map((i) => i.trim())
      .filter(Boolean);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      imageUrl: resolvedImageUrl,
      destinationId: Number(form.destinationId),
      price: Number(form.price),
      durationDays: Number(form.durationDays),
      maxCapacity: Number(form.maxCapacity),
      bookingsAvailable: Number(form.bookingsAvailable),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      itineraryHighlights,
      whatsIncluded,
    };
    try {
      if (tourModal === "create") {
        await createTour(payload);
      } else if (editingTour) {
        await updateTour(editingTour.id, payload);
      }
      setTourModal(null);
      await loadData();
    } catch (err) {
      setFormError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to save tour.");
    } finally { setFormLoading(false); }
  };

  const set = (field: TourFormTextField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => {
      const next: TourForm = { ...prev, [field]: e.target.value };
      if (field === "durationDays") {
        const days = Math.max(1, Number(e.target.value || 1));
        next.itineraryHighlights =
          tourModal === "create"
            ? buildItineraryByDuration(days)
            : syncItineraryWithDuration(prev.itineraryHighlights, days);
      }
      return next;
    });

  const availabilityIcon = (tour: TourPackage) => {
    if (tour.bookingsAvailable === 0) return <IconWithBackground variant="error"   size="small" icon={<FeatherX />} />;
    if (tour.bookingsAvailable <= 5)  return <IconWithBackground variant="warning" size="small" icon={<FeatherAlertCircle />} />;
    return                                    <IconWithBackground variant="success" size="small" icon={<FeatherCheck />} />;
  };

  // ── Navbar ─────────────────────────────────────────────────────────────

  // ── Overview tab ────────────────────────────────────────────────────────
  const overviewTab = (
    <div className="flex w-full flex-col items-center gap-8 px-8 py-8">
      <div className="flex w-full max-w-[1280px] flex-col items-start gap-8">
        <span className="text-heading-1 font-heading-1 text-default-font">Admin Dashboard</span>
        <div className="w-full items-start gap-4 grid grid-cols-4 mobile:grid-cols-2">
          {[
            { label: "Total Tours",          count: stats.totalTours,                   bg: "bg-brand-100",   icon: <FeatherMap className="text-heading-3 font-heading-3 text-brand-600" /> },
            { label: "Active Bookings",       count: stats.activeBookings,               bg: "bg-success-100", icon: <FeatherCheckCircle className="text-heading-3 font-heading-3 text-success-600" /> },
            { label: "Total Users",           count: stats.totalUsers,                   bg: "bg-warning-100", icon: <FeatherUsers className="text-heading-3 font-heading-3 text-warning-600" /> },
            { label: "Total Revenue",         count: `$${stats.revenue.toLocaleString()}`, bg: "bg-neutral-100", icon: <FeatherDollarSign className="text-heading-3 font-heading-3 text-subtext-color" /> },
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
        <div className="flex w-full flex-wrap gap-4">
          <Button icon={<FeatherPlus />} onClick={openCreate}>Add New Tour</Button>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        <div className="flex w-full max-w-[1280px] flex-col items-start gap-4">
          <span className="text-heading-1 font-heading-1 text-default-font">Most Booked Tours</span>
        </div>
        {mostBookedTours.length === 0 ? (
          <div className="flex w-full max-w-[1280px]">
            <span className="text-body font-body text-subtext-color">No booking data yet.</span>
          </div>
        ) : (
          <div className="w-full max-w-[1280px] gap-6 grid grid-cols-3 mobile:grid-cols-1">
            {mostBookedTours.map((tour) => (
              <div
                key={tour.id}
                className="flex grow shrink-0 basis-0 flex-col items-start gap-4 overflow-hidden rounded-xl border border-solid border-neutral-border bg-neutral-50 cursor-pointer hover:border-brand-600 hover:shadow-lg transition-all duration-200"
                onClick={() => navigate(`/explore/tours/${tour.id}?from=overview`)}
              >
                <img
                  className="h-64 w-full flex-none object-cover"
                  src={tour.imageUrl || tourImageUrl(tour.title, tour.title, "800x600")}
                  alt={tour.title}
                />
                <div className="flex w-full flex-col items-start gap-4 px-6 py-6">
                  <div className="flex w-full flex-col items-start gap-2">
                    <div className="flex w-full items-center gap-2">
                      <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">{tour.title}</span>
                      {availabilityIcon(tour)}
                    </div>
                    <div className="flex items-center gap-2">
                      <FeatherMapPin className="text-body font-body text-subtext-color" />
                      <span className="text-body font-body text-subtext-color">{tour.title}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => <FeatherStar key={i} className="text-body font-body text-warning-600" />)}
                  </div>
                  <div className="flex w-full items-center gap-4">
                    <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                      <FeatherClock className="text-caption font-caption text-default-font" />
                      <span className="text-caption-bold font-caption-bold text-default-font">{tour.durationDays} days</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                      <FeatherUsers className="text-caption font-caption text-default-font" />
                      <span className="text-caption-bold font-caption-bold text-default-font">
                        {bookedTravelersByTour[tour.id] ?? 0} booked
                      </span>
                    </div>
                  </div>
                  <div className="flex h-px w-full flex-none bg-neutral-border" />
                  <div className="flex w-full items-center gap-3">
                    <div className="flex grow shrink-0 basis-0 flex-col items-start">
                      <span className="text-caption font-caption text-subtext-color">Starting from</span>
                      <span className="text-heading-2 font-heading-2 text-default-font">${Number(tour.price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="neutral-secondary" icon={<FeatherEdit2 />} onClick={() => navigate(`/explore/tours/${tour.id}?from=overview&mode=edit`)}>
                        Edit
                      </Button>
                      <Button variant="destructive-secondary" icon={<FeatherTrash />} onClick={() => void handleDeleteTour(tour.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Tours tab ───────────────────────────────────────────────────────────
  const toursTab = (
    <>
      {/* Filter bar — identical structure to ExploreToursPage */}
      <div className="flex w-full flex-col items-start gap-8 bg-neutral-50 px-12 py-8 mobile:px-4 mobile:py-6">
        <div className="flex w-full max-w-[1280px] flex-col items-start gap-4 mx-auto">
          <div className="flex w-full items-center gap-4">
            <span className="text-heading-1 font-heading-1 text-default-font">Tour Management</span>
            <Button icon={<FeatherPlus />} onClick={openCreate}>Add New Tour</Button>
          </div>

          {/* Row 1 — all filters + clear filters */}
          <div className="flex w-full flex-wrap items-end gap-6 mobile:flex-col mobile:gap-4">

            {/* Destination */}
            <div className="flex flex-col items-start gap-2 w-80 flex-none mobile:w-full">
              <span className="text-body-bold font-body-bold text-subtext-color">Destination</span>
              <TextField className="h-auto w-full" variant="filled" icon={<FeatherMapPin />}>
                <TextField.Input placeholder="Search destinations…" value={tourSearch} onChange={(e) => setTourSearch(e.target.value)} />
              </TextField>
            </div>

            {/* Min / Max Price */}
            <div className="flex items-end gap-3 mobile:w-full mobile:flex-col">
              <div className="flex flex-col items-start gap-2 w-36 flex-none mobile:w-full">
                <span className="text-body-bold font-body-bold text-subtext-color">Min Price</span>
                <TextField className="h-auto w-full" variant="filled" icon={<FeatherDollarSign />}>
                  <TextField.Input type="number" placeholder="0" value={tourMinPrice} onChange={(e) => setTourMinPrice(e.target.value)} />
                </TextField>
              </div>
              <div className="flex flex-col items-start gap-2 w-36 flex-none mobile:w-full">
                <span className="text-body-bold font-body-bold text-subtext-color">Max Price</span>
                <TextField className="h-auto w-full" variant="filled" icon={<FeatherDollarSign />}>
                  <TextField.Input type="number" placeholder="5000" value={tourMaxPrice} onChange={(e) => setTourMaxPrice(e.target.value)} />
                </TextField>
              </div>
            </div>

            {/* Duration */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-body-bold font-body-bold text-subtext-color">Duration</span>
              <ToggleGroup className="h-8 px-1" value={tourDuration} onValueChange={(v) => setTourDuration(v === tourDuration ? "" : v)}>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="1-3">1-3 days</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="4-7">4-7 days</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="8+">8+ days</ToggleGroup.Item>
              </ToggleGroup>
            </div>

            {/* Availability */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-body-bold font-body-bold text-subtext-color">Availability</span>
              <ToggleGroup className="h-8 px-1" value={tourAvailability} onValueChange={(v) => setTourAvailability(v === tourAvailability ? "" : v)}>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="Available">Available</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="Limited">Limited</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="All">All</ToggleGroup.Item>
              </ToggleGroup>
            </div>

            {/* Clear filters — inline, aligned to bottom */}
            <Button className="self-end flex-none" variant="neutral-secondary" onClick={() => { setTourSearch(""); setTourMinPrice(""); setTourMaxPrice(""); setTourDuration(""); setTourAvailability(""); setTourSort("newest"); }}>
              Clear filters
            </Button>
          </div>

          {/* Row 2 — sort */}
          <div className="flex items-center gap-3">
            <span className="text-body-bold font-body-bold text-subtext-color">Sort by</span>
            <select
              className="h-8 rounded-md border border-solid border-neutral-border bg-neutral-0 px-3 text-body font-body text-default-font focus:outline-none focus:border-brand-600 cursor-pointer"
              value={tourSort}
              onChange={(e) => setTourSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price-high">Price: High → Low</option>
              <option value="price-low">Price: Low → High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Card grid — identical structure to ExploreToursPage */}
      <div className="flex w-full flex-col items-center gap-12 px-12 py-12 mobile:px-4 mobile:py-6">
        {loading && <span className="text-body font-body text-subtext-color">Loading tours…</span>}
        {!loading && filteredTours.length === 0 && (
          <span className="text-body font-body text-subtext-color">No tours match your filters.</span>
        )}

        <div className="w-full max-w-[1280px] gap-6 grid grid-cols-3 mobile:grid-cols-1">
          {filteredTours.map((tour) => (
            <div
              key={tour.id}
              className="flex grow shrink-0 basis-0 flex-col items-start gap-4 overflow-hidden rounded-xl border border-solid border-neutral-border bg-neutral-50 cursor-pointer hover:border-brand-600 hover:shadow-lg transition-all duration-200"
              onClick={() => navigate(`/explore/tours/${tour.id}?from=tours`)}
            >
              <img
                className="h-64 w-full flex-none object-cover"
                src={tour.imageUrl || tourImageUrl(tour.title, tour.title, "800x600")}
                alt={tour.title}
              />
              <div className="flex w-full flex-col items-start gap-4 px-6 py-6">
                <div className="flex w-full flex-col items-start gap-2">
                  <div className="flex w-full items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">{tour.title}</span>
                    {availabilityIcon(tour)}
                  </div>
                  <div className="flex items-center gap-2">
                    <FeatherMapPin className="text-body font-body text-subtext-color" />
                    <span className="text-body font-body text-subtext-color">{tour.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((i) => <FeatherStar key={i} className="text-body font-body text-warning-600" />)}
                </div>
                <div className="flex w-full items-center gap-4">
                  <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                    <FeatherClock className="text-caption font-caption text-default-font" />
                    <span className="text-caption-bold font-caption-bold text-default-font">{tour.durationDays} days</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2">
                    <FeatherUsers className="text-caption font-caption text-default-font" />
                    <span className="text-caption-bold font-caption-bold text-default-font">{tour.bookingsAvailable} bookings left</span>
                  </div>
                </div>
                <div className="flex h-px w-full flex-none bg-neutral-border" />
                <div className="flex w-full items-center gap-3">
                  <div className="flex grow shrink-0 basis-0 flex-col items-start">
                    <span className="text-caption font-caption text-subtext-color">Starting from</span>
                    <span className="text-heading-2 font-heading-2 text-default-font">${Number(tour.price).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="neutral-secondary" icon={<FeatherEdit2 />} onClick={() => navigate(`/explore/tours/${tour.id}?from=tours&mode=edit`)}>
                      Edit
                    </Button>
                    <Button variant="destructive-secondary" icon={<FeatherTrash />} onClick={() => void handleDeleteTour(tour.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // ── Users tab ───────────────────────────────────────────────────────────
  const usersTab = (
    <div className="flex w-full flex-col items-center gap-6 px-8 py-8">
      <div className="flex w-full max-w-[1280px] flex-col items-start gap-6">
        <div className="flex w-full items-center gap-4">
          <span className="text-heading-1 font-heading-1 text-default-font">User Management</span>
          <Button icon={<FeatherPlus />} onClick={openCreateUser}>
            Add New User
          </Button>
        </div>
        <span className="text-body font-body text-subtext-color">Total Users: {users.length}</span>

        {/* User filters */}
        <div className="flex w-full flex-wrap items-end gap-7 rounded-xl border border-solid border-neutral-border bg-neutral-50 px-5 py-5">
          <div className="flex flex-col items-start gap-2 w-80 flex-none mobile:w-full">
            <span className="text-[15px] font-semibold text-subtext-color">Search</span>
            <TextField className="h-auto w-full" variant="filled" icon={<FeatherSearch />}>
              <TextField.Input
                className="text-body-bold font-body-bold placeholder:text-body-bold placeholder:font-body-bold"
                placeholder="Search name, email, phone, role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </TextField>
          </div>

          <div className="flex flex-col items-start gap-2">
            <span className="text-[15px] font-semibold text-subtext-color">Role</span>
            <ToggleGroup className="h-8 px-1" value={userRoleFilter} onValueChange={(v) => setUserRoleFilter(v === userRoleFilter ? "all" : v)}>
              <ToggleGroup.Item className="h-7 px-4 text-body-bold font-body-bold" icon={null} value="all">All</ToggleGroup.Item>
              <ToggleGroup.Item className="h-7 px-4 text-body-bold font-body-bold" icon={null} value="ADMIN">Admin</ToggleGroup.Item>
              <ToggleGroup.Item className="h-7 px-4 text-body-bold font-body-bold" icon={null} value="CUSTOMER">Customer</ToggleGroup.Item>
            </ToggleGroup>
          </div>

          <Button
            className="self-end flex-none"
            variant="neutral-secondary"
            onClick={() => {
              setUserSearch("");
              setUserRoleFilter("all");
              setUserSortKey("fullName");
              setUserSortDir("asc");
            }}
          >
            Clear filters
          </Button>
        </div>

        <div className="w-full overflow-x-auto rounded-lg border border-solid border-neutral-border">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {[
                  { label: "Name", key: "fullName" as UserSortKey },
                  { label: "Email", key: "email" as UserSortKey },
                  { label: "Phone", key: "phone" as UserSortKey },
                  { label: "Roles", key: "roles" as UserSortKey },
                ].map(({ label, key }) => (
                  <th key={label} className="text-left px-4 py-3 text-body-bold font-body-bold text-subtext-color">
                    <button
                      className="inline-flex items-center gap-2 hover:text-default-font transition-colors"
                      onClick={() => {
                        if (userSortKey === key) setUserSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else { setUserSortKey(key); setUserSortDir("asc"); }
                      }}
                    >
                      <span>{label}</span>
                      <span className="text-caption font-caption text-subtext-color">
                        {userSortKey === key ? (userSortDir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-body-bold font-body-bold text-subtext-color">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-body font-body text-subtext-color">Loading...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-body font-body text-subtext-color">No users match current filters.</td></tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} className="border-t border-solid border-neutral-border hover:bg-neutral-50">
                  <td className="px-4 py-3 text-body-bold font-body-bold text-default-font">{u.fullName}</td>
                  <td className="px-4 py-3 text-body font-body text-subtext-color">{u.email}</td>
                  <td className="px-4 py-3 text-body font-body text-subtext-color">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r} variant={r === "ADMIN" ? "error" : r === "CUSTOMER" ? "brand" : "warning"}>{r}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.id === session.userId || u.email === session.email ? (
                      <span className="text-body font-body text-subtext-color">Current user</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="small" variant="neutral-secondary" icon={<FeatherEdit2 />} onClick={() => openUserEdit(u)}>
                          Edit
                        </Button>
                        <Button size="small" variant="destructive-secondary" icon={<FeatherTrash />} onClick={() => void handleDeleteUser(u)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const profileTab = (
    <div className="flex w-full grow items-start justify-center px-4 py-12 overflow-auto">
      <div className="flex w-full max-w-lg origin-top scale-[1.10] flex-col overflow-hidden rounded-2xl border border-solid border-neutral-border bg-neutral-50 shadow-xl mobile:scale-100">
        <div className="flex w-full border-b border-solid border-neutral-border bg-neutral-100">
          {(["personal", "security"] as const).map((section) => {
            const isActive = profileSection === section;
            return (
              <button
                key={section}
                className={`group relative flex flex-1 items-center justify-center gap-2.5 px-6 py-5 text-heading-3 font-heading-3 transition-all duration-200 select-none outline-none
                  ${isActive ? "text-brand-600 bg-neutral-0" : "text-subtext-color hover:text-default-font hover:bg-neutral-50 active:scale-95"}`}
                onClick={() => setProfileSection(section)}
              >
                {section === "personal"
                  ? <FeatherUserCircle className={`text-heading-3 font-heading-3 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                  : <FeatherShield className={`text-heading-3 font-heading-3 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                }
                {section === "personal" ? "Personal Info" : "Security"}
                <span className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-brand-600 transition-all duration-300 ${isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-6 px-8 py-8">
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
              {profileMsg && <span className="text-caption font-caption text-success-700">{profileMsg}</span>}
              {profileError && <span className="text-caption font-caption text-error-700">{profileError}</span>}
              <Button className="w-full" variant="brand-primary" icon={<FeatherSave />} loading={profileSaving} onClick={() => void handleSaveProfile()}>
                Save Changes
              </Button>
            </>
          )}

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
              {pwMsg && <span className="text-caption font-caption text-success-700">{pwMsg}</span>}
              {pwError && <span className="text-caption font-caption text-error-700">{pwError}</span>}
              <Button className="w-full" variant="brand-primary" icon={<FeatherKey />} loading={pwSaving} onClick={() => void handleChangePassword()}>
                Update Password
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── Tour create / edit modal ────────────────────────────────────────────
  const tourFormModal = tourModal && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setTourModal(null); }}
    >
      <div className="relative flex w-full max-w-2xl flex-col bg-neutral-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex w-full items-center gap-3 border-b border-solid border-neutral-border bg-neutral-50 px-6 py-4 flex-none">
          <span className="grow text-heading-2 font-heading-2 text-default-font">
            {tourModal === "create" ? "Add New Tour" : `Edit: ${editingTour?.title}`}
          </span>
          <IconButton variant="neutral-secondary" icon={<FeatherX />} onClick={() => setTourModal(null)} />
        </div>

        {/* Body */}
        <div className="flex w-full flex-col items-start gap-5 overflow-y-auto px-6 py-6">

          <TextField className="w-full" variant="outline" label="Tour Title *">
            <TextField.Input placeholder="e.g. Goa Weekend Escape" value={form.title} onChange={set("title")} />
          </TextField>

          <div className="flex w-full flex-col items-start gap-1">
            <span className="text-body-bold font-body-bold text-default-font">Description</span>
            <textarea
              className="w-full rounded-lg border border-solid border-neutral-border bg-neutral-0 px-4 py-3 text-body font-body text-default-font focus:outline-none focus:border-brand-600 resize-none"
              rows={3}
              placeholder="Tour description..."
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <div className="flex w-full flex-col gap-2">
            <TextField className="w-full" variant="outline" label="Image URL (leave blank to auto-generate)">
              <TextField.Input placeholder="https://... or leave blank to auto-pick" value={form.imageUrl} onChange={set("imageUrl")} />
            </TextField>
            {/* Live preview of current or auto-generated image */}
            <div className="h-32 w-full overflow-hidden rounded-lg bg-neutral-100">
              <img
                className="h-full w-full object-cover"
                src={form.imageUrl.trim() || tourImageUrl(form.title, form.title, "600x300")}
                alt="Tour preview"
                onError={(e) => { (e.target as HTMLImageElement).src = tourImageUrl("", "", "600x300"); }}
              />
            </div>
          </div>

          <div className="flex w-full items-start gap-4">
            <TextField className="grow" variant="outline" label="Price per person ($) *">
              <TextField.Input type="number" placeholder="12000" value={form.price} onChange={set("price")} />
            </TextField>
            <TextField className="w-32 flex-none" variant="outline" label="Duration (days) *">
              <TextField.Input type="number" placeholder="3" value={form.durationDays} onChange={set("durationDays")} />
            </TextField>
          </div>

          <div className="flex w-full items-start gap-4">
            <TextField className="grow" variant="outline" label="Max Capacity *">
              <TextField.Input type="number" placeholder="40" value={form.maxCapacity} onChange={set("maxCapacity")} />
            </TextField>
            <TextField className="grow" variant="outline" label="Bookings Available *">
              <TextField.Input type="number" placeholder="40" value={form.bookingsAvailable} onChange={set("bookingsAvailable")} />
            </TextField>
          </div>

          {/* Booking window */}
          <div className="flex w-full flex-col gap-4 rounded-2xl border border-solid border-neutral-border bg-neutral-50 px-5 py-5">
            <div className="flex items-center gap-2">
              <FeatherCalendar className="text-body font-body text-brand-600" />
              <span className="text-heading-3 font-heading-3 text-default-font">Booking Window</span>
            </div>
            <span className="text-body font-body text-subtext-color -mt-2">
              Customers can pick any travel start date within this window.
            </span>

            <div className="grid w-full grid-cols-2 gap-5 mobile:grid-cols-1">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-body-bold font-body-bold text-subtext-color">Booking Opens</span>
                  {form.startDate && (
                    <span className="text-caption-bold font-caption-bold text-brand-600">{fmtDate(form.startDate)}</span>
                  )}
                </div>
                <div className="flex justify-center rounded-xl border border-solid border-neutral-border bg-default-background py-2 rdp-custom rdp-compact">
                  <DayPicker
                    mode="single"
                    selected={parseLocal(form.startDate)}
                    defaultMonth={parseLocal(form.startDate) ?? new Date()}
                    onSelect={(day) => {
                      if (!day) return;
                      const iso = isoDate(day);
                      setForm((prev) => ({
                        ...prev,
                        startDate: iso,
                        endDate: prev.endDate && prev.endDate < iso ? iso : prev.endDate,
                      }));
                    }}
                    showOutsideDays={false}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-body-bold font-body-bold text-subtext-color">Booking Closes</span>
                  {form.endDate && (
                    <span className="text-caption-bold font-caption-bold text-brand-600">{fmtDate(form.endDate)}</span>
                  )}
                </div>
                <div className="flex justify-center rounded-xl border border-solid border-neutral-border bg-default-background py-2 rdp-custom rdp-compact">
                  <DayPicker
                    mode="single"
                    selected={parseLocal(form.endDate)}
                    defaultMonth={parseLocal(form.endDate) ?? parseLocal(form.startDate) ?? new Date()}
                    disabled={form.startDate ? [{ before: new Date(form.startDate + "T00:00:00") }] : []}
                    onSelect={(day) => {
                      if (!day) return;
                      setForm((prev) => ({ ...prev, endDate: isoDate(day) }));
                    }}
                    showOutsideDays={false}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
            <span className="text-body-bold font-body-bold text-default-font">Itinerary Highlights</span>
            <span className="text-caption font-caption text-subtext-color">
              Rows are auto-generated from duration. Add or update highlight details below.
            </span>
            <div className="flex w-full flex-col gap-3">
              {form.itineraryHighlights.map((item, idx) => (
                <div key={item.title + idx} className="flex w-full flex-col gap-1 rounded-lg border border-solid border-neutral-border bg-default-background px-3 py-3">
                  <span className="text-body-bold font-body-bold text-default-font">{item.title}</span>
                  <textarea
                    className="w-full rounded-md border border-solid border-neutral-border bg-neutral-50 px-3 py-2 text-body font-body text-default-font resize-none focus:outline-none focus:border-brand-600"
                    rows={2}
                    placeholder="Add itinerary details for this section..."
                    value={item.details}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        itineraryHighlights: prev.itineraryHighlights.map((row, rowIdx) =>
                          rowIdx === idx ? { ...row, details: e.target.value } : row
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
            <span className="text-body-bold font-body-bold text-default-font">What&#39;s Included</span>
            <span className="text-caption font-caption text-subtext-color">Enter one inclusion per line.</span>
            <textarea
              className="w-full rounded-lg border border-solid border-neutral-border bg-default-background px-4 py-3 text-body font-body text-default-font resize-y focus:outline-none focus:border-brand-600"
              rows={6}
              value={form.whatsIncludedText}
              onChange={(e) => setForm((prev) => ({ ...prev, whatsIncludedText: e.target.value }))}
              placeholder={"Accommodation\nAll transportation\nDaily breakfast"}
            />
          </div>

          {formError && (
            <span className="text-caption font-caption text-error-700">{formError}</span>
          )}

          <div className="flex w-full items-center gap-3">
            <Button variant="neutral-secondary" onClick={() => setTourModal(null)}>Cancel</Button>
            <Button className="grow h-10" size="large" loading={formLoading} onClick={() => void handleFormSubmit()}>
              {tourModal === "create" ? "Create Tour" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const userEditModal = userModalOpen && editingUser && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setUserModalOpen(false); }}
    >
      <div className="relative flex w-full max-w-xl scale-[1.05] mobile:scale-100 flex-col bg-neutral-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh]">
        <div className="flex w-full items-center gap-3 border-b border-solid border-neutral-border bg-neutral-50 px-6 py-4 flex-none">
          <span className="grow text-heading-2 font-heading-2 text-default-font">Edit User Profile</span>
          <IconButton variant="neutral-secondary" icon={<FeatherX />} onClick={() => setUserModalOpen(false)} />
        </div>

        <div className="flex w-full flex-col items-start gap-5 overflow-y-auto px-6 py-6">
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Full Name</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input value={userFormFullName} onChange={(e) => setUserFormFullName(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Phone Number</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input value={userFormPhone} onChange={(e) => setUserFormPhone(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Email Address</span>
            <div className="flex w-full items-center gap-2 rounded-md border border-solid border-neutral-border bg-neutral-100 px-4 py-2.5">
              <FeatherLock className="text-body font-body text-subtext-color" />
              <span className="text-body font-body text-subtext-color">{editingUser.email}</span>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Password</span>
            <div className="flex w-full flex-col items-start gap-2">
              <Button
                variant="neutral-secondary"
                onClick={() => setUserResetPassword(true)}
              >
                Reset Password
              </Button>
              {userResetPassword && (
                <span className="text-caption font-caption text-success-700">
                  Password is reset to 'test123'
                </span>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Roles</span>
            <div className="flex w-full flex-wrap gap-2">
              {(["ADMIN", "CUSTOMER"] as UserRole[]).map((role) => (
                <Button
                  key={role}
                  size="small"
                  variant={userFormRoles.includes(role) ? "brand-secondary" : "neutral-secondary"}
                  onClick={() => toggleUserRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>
          </div>

          {userFormError && <span className="text-caption font-caption text-error-700">{userFormError}</span>}

          <div className="flex w-full items-center gap-3">
            <Button variant="neutral-secondary" onClick={() => setUserModalOpen(false)}>Cancel</Button>
            <Button className="grow h-10" size="large" loading={userFormSaving} onClick={() => void handleSaveUser()}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const userCreateModal = createUserModalOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setCreateUserModalOpen(false); }}
    >
      <div className="relative flex w-full max-w-xl flex-col bg-neutral-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh]">
        <div className="flex w-full items-center gap-3 border-b border-solid border-neutral-border bg-neutral-50 px-6 py-4 flex-none">
          <span className="grow text-heading-2 font-heading-2 text-default-font">Add New User</span>
          <IconButton variant="neutral-secondary" icon={<FeatherX />} onClick={() => setCreateUserModalOpen(false)} />
        </div>

        <div className="flex w-full flex-col items-start gap-5 overflow-y-auto px-6 py-6">
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Full Name *</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Phone Number</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Email Address *</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Password *</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Confirm Password *</span>
            <TextField className="w-full" variant="outline">
              <TextField.Input type="password" value={newUserConfirmPassword} onChange={(e) => setNewUserConfirmPassword(e.target.value)} />
            </TextField>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">Role</span>
            <div className="flex w-full flex-wrap gap-2">
              {(["ADMIN", "CUSTOMER"] as UserRole[]).map((role) => (
                <Button
                  key={role}
                  size="small"
                  variant={newUserRole === role ? "brand-secondary" : "neutral-secondary"}
                  onClick={() => setNewUserRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>
          </div>

          {newUserError && <span className="text-caption font-caption text-error-700">{newUserError}</span>}

          <div className="flex w-full items-center gap-3">
            <Button variant="neutral-secondary" onClick={() => setCreateUserModalOpen(false)}>Cancel</Button>
            <Button className="grow h-10" size="large" loading={newUserSaving} onClick={() => void handleCreateUser()}>
              Create User
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
        <AppNavbar
          session={session}
          onLogout={onLogout}
          brandName="Wanderlust Admin"
          links={[
            { label: "Overview", active: activeTab === "overview", onClick: () => setActiveTab("overview") },
            { label: "Tours",    active: activeTab === "tours",    onClick: () => setActiveTab("tours") },
            { label: "Users",    active: activeTab === "users",    onClick: () => setActiveTab("users") },
            { label: "Bookings", active: false,                    onClick: () => navigate("/admin/bookings") },
            { label: "Profile",  active: activeTab === "profile",  onClick: () => setActiveTab("profile") },
          ]}
        />
        {activeTab === "overview" && overviewTab}
        {activeTab === "tours" && toursTab}
        {activeTab === "users" && usersTab}
        {activeTab === "profile" && profileTab}
      </div>
      {tourFormModal}
      {userEditModal}
      {userCreateModal}
    </>
  );
}
