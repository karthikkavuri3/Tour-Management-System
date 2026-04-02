"use client";

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import type { AxiosError } from "axios";
import { Accordion } from "@/ui/components/Accordion";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { TextField } from "@/ui/components/TextField";
import {
  FeatherArrowLeft, FeatherCalendar, FeatherCheck, FeatherClock,
  FeatherDollarSign, FeatherEdit2, FeatherImage, FeatherMapPin,
  FeatherSave, FeatherStar, FeatherTrash, FeatherUsers, FeatherX,
} from "@subframe/core";
import type { Session, TourPackage } from "@/lib/models";
import { getTour, updateTour, deleteTour } from "@/lib/api";
import BookingModal from "@/components/BookingModal";
import { tourImageUrl } from "@/lib/imageUtils";
import AppNavbar from "@/components/AppNavbar";

interface Props { session: Session; onLogout: () => void; }

interface TourForm {
  title: string; description: string; imageUrl: string;
  price: string; durationDays: string; maxCapacity: string;
  bookingsAvailable: string; startDate: string; endDate: string;
  itineraryHighlights: { title: string; details: string }[];
  whatsIncludedText: string;
}
type TourFormTextField =
  | "title"
  | "description"
  | "imageUrl"
  | "price"
  | "durationDays"
  | "maxCapacity"
  | "bookingsAvailable"
  | "startDate"
  | "endDate";

function isAdminUser(session: Session) {
  return session.roles.some((r) => r === "ADMIN" || r === "TRAVEL_MANAGER" || r === "STAFF");
}

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

export default function TourDetailPage({ session, onLogout }: Props) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const editMode = searchParams.get("mode") === "edit";
  const from = searchParams.get("from"); // "overview" | "tours" | null
  const isAdmin = isAdminUser(session);

  const [tour, setTour] = useState<TourPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);

  const [form, setForm] = useState<TourForm>({
    title: "", description: "", imageUrl: "", price: "",
    durationDays: "", maxCapacity: "", bookingsAvailable: "",
    startDate: "", endDate: "",
    itineraryHighlights: buildItineraryByDuration(3),
    whatsIncludedText: defaultIncludedItems.join("\n"),
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load(Number(id));
  }, [id]);

  useEffect(() => {
    const currentTourId = tour?.id;
    const onAvailabilityChanged = (event: Event) => {
      const custom = event as CustomEvent<{ tourPackageId: number; delta: number }>;
      const { tourPackageId, delta } = custom.detail ?? {};
      if (!currentTourId || currentTourId !== tourPackageId || !delta) return;
      setTour((prev) => prev ? { ...prev, bookingsAvailable: Math.max(0, prev.bookingsAvailable + delta) } : prev);
      setForm((prev) => ({ ...prev, bookingsAvailable: String(Math.max(0, Number(prev.bookingsAvailable || 0) + delta)) }));
    };
    window.addEventListener("tms:tour-availability-changed", onAvailabilityChanged);
    return () => window.removeEventListener("tms:tour-availability-changed", onAvailabilityChanged);
  }, [tour?.id]);

  const load = async (tourId: number) => {
    setLoading(true); setError("");
    try {
      const t = await getTour(tourId);
      setTour(t);
      setForm({
        title: t.title, description: t.description ?? "",
        imageUrl: t.imageUrl ?? "", price: String(t.price),
        durationDays: String(t.durationDays), maxCapacity: String(t.maxCapacity),
        bookingsAvailable: String(t.bookingsAvailable),
        startDate: t.startDate ?? "", endDate: t.endDate ?? "",
        itineraryHighlights:
          (t.itineraryHighlights && t.itineraryHighlights.length > 0
            ? syncItineraryWithDuration(
                t.itineraryHighlights.map((i) => ({
                  title: (i.title ?? "").trim(),
                  details: (i.details ?? "").trim(),
                })).filter((i) => i.title),
                Math.max(1, Number(t.durationDays || 1))
              )
            : buildItineraryByDuration(Math.max(1, Number(t.durationDays || 1)))),
        whatsIncludedText:
          (t.whatsIncluded && t.whatsIncluded.length > 0
            ? t.whatsIncluded.join("\n")
            : defaultIncludedItems.join("\n")),
      });
    } catch {
      setError("Tour not found or could not be loaded.");
    } finally { setLoading(false); }
  };

  const set = (field: TourFormTextField) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => {
        const next: TourForm = { ...prev, [field]: e.target.value };
        if (field === "durationDays") {
          const days = Math.max(1, Number(e.target.value || 1));
          next.itineraryHighlights = syncItineraryWithDuration(prev.itineraryHighlights, days);
        }
        return next;
      });

  const handleSave = async () => {
    if (!form.title.trim() || !form.price || !form.durationDays) {
      setFormError("Title, price and duration are required.");
      return;
    }
    setSaving(true); setFormError("");
    const resolvedImageUrl = form.imageUrl.trim() ||
      tourImageUrl(form.title, tour?.destinationName ?? form.title, "1200x800");
    try {
      const itineraryHighlights = form.itineraryHighlights
        .map((i) => ({ title: i.title.trim(), details: i.details.trim() }))
        .filter((i) => i.title);
      const whatsIncluded = form.whatsIncludedText
        .split("\n")
        .map((i) => i.trim())
        .filter(Boolean);
      await updateTour(Number(id), {
        title: form.title.trim(), description: form.description.trim() || null,
        imageUrl: resolvedImageUrl, destinationId: tour?.destinationId,
        price: Number(form.price), durationDays: Number(form.durationDays),
        maxCapacity: Number(form.maxCapacity), bookingsAvailable: Number(form.bookingsAvailable),
        startDate: form.startDate || null, endDate: form.endDate || null,
        itineraryHighlights,
        whatsIncluded,
      });
      navigate("/admin?tab=tours");
    } catch (err) {
      setFormError(
        (err as AxiosError<{ message?: string }>).response?.data?.message ||
        "Failed to save changes. Please try again."
      );
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${tour?.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await deleteTour(Number(id)); navigate("/admin?tab=tours"); }
    catch { alert("Cannot delete — tour may have active bookings."); }
    finally { setDeleting(false); }
  };

  const cancelEdit = () => {
    setFormError("");
    if (from) setSearchParams({ from });
    else setSearchParams({});
  };
  const goBack = () => {
    if (!isAdmin) { navigate("/explore"); return; }
    navigate(from === "overview" ? "/admin" : "/admin?tab=tours");
  };

  const adminNavLinks = [
    { label: "Overview", active: false, onClick: () => navigate("/admin") },
    { label: "Tours",    active: true,  onClick: () => navigate("/admin?tab=tours") },
    { label: "Users",    active: false, onClick: () => navigate("/admin?tab=users") },
    { label: "Bookings", active: false, onClick: () => navigate("/admin/bookings") },
    { label: "Profile",  active: false, onClick: () => navigate("/admin?tab=profile") },
  ];
  const userNavLinks = [
    { label: "Discover Tours", active: true,  onClick: () => navigate("/explore") },
    { label: "My Bookings",    active: false, onClick: () => navigate("/my-bookings") },
    { label: "Profile",        active: false, onClick: () => navigate("/my-bookings?tab=profile") },
  ];

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-0">
      <span className="text-body font-body text-subtext-color">Loading tour details…</span>
    </div>
  );

  if (error || !tour) return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-neutral-0">
      <span className="text-body font-body text-subtext-color">{error || "Tour not found."}</span>
      <Button icon={<FeatherArrowLeft />} onClick={goBack}>Back</Button>
    </div>
  );

  const itineraryHighlights =
    (tour.itineraryHighlights && tour.itineraryHighlights.length > 0
      ? tour.itineraryHighlights
      : buildItineraryByDuration(Math.max(1, tour.durationDays))
    ).map((item) => ({
      title: item.title || "Itinerary",
      details: item.details?.trim() || "Details will be shared before departure.",
    }));

  const whatsIncluded =
    tour.whatsIncluded && tour.whatsIncluded.length > 0
      ? tour.whatsIncluded
      : defaultIncludedItems;

  /* ─── Edit form ────────────────────────────────────────────────────────── */
  const editForm = (
    <div className="flex w-full flex-col items-start gap-6">

      {/* ── Image preview + URL ─────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-start gap-3 rounded-2xl border border-solid border-neutral-border bg-neutral-50 overflow-hidden">
        <div className="relative w-full h-56 bg-neutral-100">
          <img
            className="h-full w-full object-cover"
            src={form.imageUrl.trim() || tourImageUrl(form.title || tour.title, tour.destinationName, "1200x500")}
            alt="Tour preview"
            onError={(e) => { (e.target as HTMLImageElement).src = tourImageUrl("", "", "1200x500"); }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end px-6 py-4 gap-2">
            <FeatherImage className="text-white text-body" />
            <span className="text-body-bold font-body-bold text-white">Image Preview</span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-1 px-6 pb-5">
          <span className="text-body-bold font-body-bold text-subtext-color">Image URL</span>
          <TextField className="w-full" variant="filled">
            <TextField.Input
              placeholder="https://images.unsplash.com/… (leave blank to auto-generate)"
              value={form.imageUrl}
              onChange={set("imageUrl")}
            />
          </TextField>
        </div>
      </div>

      {/* ── Basic Info ──────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-solid border-neutral-border bg-neutral-50 px-6 py-5">
        <div className="flex items-center gap-2">
          <FeatherEdit2 className="text-body font-body text-brand-600" />
          <span className="text-heading-3 font-heading-3 text-default-font">Basic Information</span>
        </div>

        <div className="flex w-full flex-col gap-1">
          <span className="text-body-bold font-body-bold text-subtext-color">Tour Title *</span>
          <TextField className="w-full" variant="filled">
            <TextField.Input placeholder="e.g. Goa Weekend Escape" value={form.title} onChange={set("title")} />
          </TextField>
        </div>

        <div className="flex w-full flex-col gap-1">
          <span className="text-body-bold font-body-bold text-subtext-color">Description</span>
          <textarea
            className="w-full rounded-lg border border-solid border-neutral-100 bg-neutral-100 px-3 py-2.5 text-body font-body text-default-font placeholder:text-neutral-400 hover:border-neutral-border focus:outline-none focus:border-brand-600 focus:bg-default-background resize-none transition-colors"
            rows={3}
            placeholder="Describe what makes this tour special…"
            value={form.description}
            onChange={set("description")}
          />
        </div>
      </div>

      {/* ── Pricing & Logistics ─────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-solid border-neutral-border bg-neutral-50 px-6 py-5">
        <div className="flex items-center gap-2">
          <FeatherDollarSign className="text-body font-body text-brand-600" />
          <span className="text-heading-3 font-heading-3 text-default-font">Pricing &amp; Logistics</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-body-bold font-body-bold text-subtext-color">Price per Person ($) *</span>
            <TextField className="w-full" variant="filled">
              <TextField.Input type="number" placeholder="12000" value={form.price} onChange={set("price")} />
            </TextField>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-bold font-body-bold text-subtext-color">Duration (days) *</span>
            <TextField className="w-full" variant="filled" icon={<FeatherClock />}>
              <TextField.Input type="number" placeholder="3" value={form.durationDays} onChange={set("durationDays")} />
            </TextField>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-bold font-body-bold text-subtext-color">Max Capacity</span>
            <TextField className="w-full" variant="filled" icon={<FeatherUsers />}>
              <TextField.Input type="number" placeholder="40" value={form.maxCapacity} onChange={set("maxCapacity")} />
            </TextField>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-bold font-body-bold text-subtext-color">Bookings Available</span>
            <TextField className="w-full" variant="filled" icon={<FeatherUsers />}>
              <TextField.Input type="number" placeholder="40" value={form.bookingsAvailable} onChange={set("bookingsAvailable")} />
            </TextField>
          </div>
        </div>
      </div>

      {/* ── Booking Window (calendars) ───────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-solid border-neutral-border bg-neutral-50 px-6 py-5">
        <div className="flex items-center gap-2">
          <FeatherCalendar className="text-body font-body text-brand-600" />
          <span className="text-heading-3 font-heading-3 text-default-font">Booking Window</span>
        </div>
        <span className="text-body font-body text-subtext-color -mt-2">
          Customers can pick any travel start date within this window.
        </span>

        <div className="grid grid-cols-2 gap-6 mobile:grid-cols-1">
          {/* Start date */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-body-bold font-body-bold text-subtext-color">Booking Opens</span>
              {form.startDate && (
                <span className="text-caption-bold font-caption-bold text-brand-600">{fmtDate(form.startDate)}</span>
              )}
            </div>
            <div className="flex justify-center rounded-xl border border-solid border-neutral-border bg-default-background py-2 rdp-custom">
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
                    // push end date forward if it's before the new start
                    endDate: prev.endDate && prev.endDate < iso ? iso : prev.endDate,
                  }));
                }}
                showOutsideDays={false}
              />
            </div>
          </div>

          {/* End date */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-body-bold font-body-bold text-subtext-color">Booking Closes</span>
              {form.endDate && (
                <span className="text-caption-bold font-caption-bold text-brand-600">{fmtDate(form.endDate)}</span>
              )}
            </div>
            <div className="flex justify-center rounded-xl border border-solid border-neutral-border bg-default-background py-2 rdp-custom">
              <DayPicker
                mode="single"
                selected={parseLocal(form.endDate)}
                defaultMonth={parseLocal(form.endDate) ?? parseLocal(form.startDate) ?? new Date()}
                disabled={form.startDate ? [{ before: new Date(form.startDate + "T00:00:00") }] : []}
                onSelect={(day) => { if (day) setForm((prev) => ({ ...prev, endDate: isoDate(day) })); }}
                showOutsideDays={false}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 rounded-2xl border border-solid border-neutral-border bg-neutral-50 px-6 py-5">
        <span className="text-heading-3 font-heading-3 text-default-font">Itinerary Highlights</span>
        <span className="text-body font-body text-subtext-color -mt-2">
          Rows are auto-generated from duration. Add details for each itinerary section.
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

      <div className="flex w-full flex-col gap-4 rounded-2xl border border-solid border-neutral-border bg-neutral-50 px-6 py-5">
        <span className="text-heading-3 font-heading-3 text-default-font">What&#39;s Included</span>
        <span className="text-body font-body text-subtext-color -mt-2">Enter one inclusion per line.</span>
        <textarea
          className="w-full rounded-lg border border-solid border-neutral-border bg-default-background px-4 py-3 text-body font-body text-default-font resize-y focus:outline-none focus:border-brand-600"
          rows={6}
          value={form.whatsIncludedText}
          onChange={(e) => setForm((prev) => ({ ...prev, whatsIncludedText: e.target.value }))}
          placeholder={"Accommodation\nAll transportation\nDaily breakfast"}
        />
      </div>

      {formError && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-solid border-error-200 bg-error-50 px-4 py-3">
          <FeatherX className="text-body font-body text-error-600 flex-none" />
          <span className="text-caption font-caption text-error-700">{formError}</span>
        </div>
      )}

      {/* Bottom actions — centered */}
      <div className="flex w-full items-center justify-center gap-4 py-4">
        <Button size="large" variant="neutral-secondary" icon={<FeatherX />} onClick={cancelEdit}>
          Cancel
        </Button>
        <Button size="large" icon={<FeatherSave />} loading={saving} onClick={() => void handleSave()}>
          Save Changes
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-full w-full flex-col items-start bg-neutral-0 overflow-auto">

        <AppNavbar
          session={session}
          onLogout={onLogout}
          brandName={isAdmin ? "Wanderlust Admin" : "Wanderlust"}
          links={isAdmin ? adminNavLinks : userNavLinks}
        />

        <div className="flex w-full flex-col items-center gap-8 px-12 py-10 mobile:px-4 mobile:py-6">
          <div className="flex w-full max-w-[1280px] flex-col items-start gap-8">

            {/* ── Header row ─────────────────────────────────────────────── */}
            <div className="flex w-full items-center gap-4">
              {/* In edit mode back → view mode; in view mode back → list */}
              <IconButton
                variant="neutral-secondary"
                icon={<FeatherArrowLeft />}
                onClick={editMode ? cancelEdit : goBack}
              />
              <span className={`grow text-default-font ${
                editMode ? "text-heading-1 font-heading-1 mobile:text-heading-1 mobile:font-heading-1" : "text-heading-1 font-heading-1 mobile:text-heading-2 mobile:font-heading-2"
              }`}>
                {editMode ? `Editing: ${tour.title}` : `${tour.title} — Package Details`}
              </span>

              {isAdmin && !editMode && (
                <div className="flex items-center gap-3 flex-none">
                  <Button
                    variant="neutral-secondary"
                    icon={<FeatherEdit2 />}
                    onClick={() => setSearchParams(from ? { from, mode: "edit" } : { mode: "edit" })}
                  >
                    Edit Tour
                  </Button>
                  <Button variant="destructive-secondary" icon={<FeatherTrash />} loading={deleting} onClick={() => void handleDelete()}>
                    Delete Tour
                  </Button>
                </div>
              )}
              {isAdmin && editMode && (
                <div className="flex items-center gap-3 flex-none">
                  <Button variant="neutral-secondary" icon={<FeatherX />} onClick={cancelEdit}>Cancel</Button>
                  <Button icon={<FeatherSave />} loading={saving} onClick={() => void handleSave()}>Save Changes</Button>
                </div>
              )}
            </div>

            {/* ── EDIT MODE ──────────────────────────────────────────────── */}
            {isAdmin && editMode && editForm}

            {/* ── VIEW MODE ──────────────────────────────────────────────── */}
            {!editMode && (
              <>
                <div className="flex h-96 w-full flex-none overflow-hidden rounded-xl bg-neutral-100">
                  <img
                    className="min-h-[0px] w-full object-cover"
                    src={tour.imageUrl || tourImageUrl(tour.title, tour.destinationName, "1200x800")}
                    alt={tour.title}
                  />
                </div>

                <div className="flex h-px w-full flex-none bg-neutral-border" />

                <div className="flex w-full flex-col items-start gap-4">
                  <div className="flex w-full flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <FeatherMapPin className="text-heading-2 font-heading-2 text-subtext-color" />
                      <span className="text-heading-2 font-heading-2 text-default-font">{tour.destinationName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FeatherClock className="text-heading-2 font-heading-2 text-subtext-color" />
                      <span className="text-heading-2 font-heading-2 text-default-font">{tour.durationDays} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FeatherUsers className="text-heading-2 font-heading-2 text-subtext-color" />
                      <span className="text-heading-2 font-heading-2 text-default-font">{tour.bookingsAvailable} bookings available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map((i) => <FeatherStar key={i} className="text-body font-body text-warning-600" />)}
                    </div>
                  </div>
                  {tour.description && <span className="text-body font-body text-subtext-color">{tour.description}</span>}
                </div>

                {(tour.startDate || tour.endDate) && (
                  <div className="flex w-full items-start gap-3 rounded-lg border border-solid border-brand-200 bg-brand-50 px-5 py-4">
                    <FeatherCalendar className="text-body font-body text-brand-600 flex-none mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">Booking Window</span>
                      <span className="text-body font-body text-subtext-color">
                        Travel can start between{" "}
                        <strong>{tour.startDate ? new Date(tour.startDate + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong>
                        {" "}and{" "}
                        <strong>{tour.endDate ? new Date(tour.endDate + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong>.
                        You pick your exact start date when booking.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex w-full flex-col items-start gap-4">
                  <span className="text-heading-2 font-heading-2 text-default-font">Itinerary Highlights</span>
                  <div className="flex w-full flex-col items-start rounded-lg border border-solid border-neutral-border overflow-hidden">
                    {itineraryHighlights.map((item, idx) => (
                      <Accordion
                        key={`${item.title}-${idx}`}
                        trigger={
                          <div className={`flex w-full items-center gap-2 px-4 py-3 ${idx > 0 ? "border-t border-solid border-neutral-border" : ""}`}>
                            <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">{item.title}</span>
                            <Accordion.Chevron />
                          </div>
                        }
                        defaultOpen={idx === 0}
                      >
                        <div className="flex w-full flex-col items-start gap-2 px-4 py-3 bg-neutral-50">
                          <span className="text-body font-body text-subtext-color">{item.details}</span>
                        </div>
                      </Accordion>
                    ))}
                  </div>
                </div>

                <div className="flex w-full flex-col items-start gap-4">
                  <span className="text-heading-2 font-heading-2 text-default-font">What&#39;s Included</span>
                  <div className="flex w-full flex-wrap items-start gap-3">
                    {whatsIncluded.map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <IconWithBackground variant="success" size="small" icon={<FeatherCheck />} />
                        <span className="text-body font-body text-default-font">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex h-px w-full flex-none bg-neutral-border" />

                <div className="flex w-full items-center gap-6">
                  <div className="flex grow flex-col items-start gap-1">
                    <span className="text-caption font-caption text-subtext-color">Price per person</span>
                    <span className="text-heading-1 font-heading-1 text-default-font">${tour.price.toFixed(2)}</span>
                  </div>
                  {!isAdmin && (
                    <Button size="large" disabled={tour.bookingsAvailable === 0} onClick={() => setBookingOpen(true)}>
                      {tour.bookingsAvailable === 0 ? "Fully Booked" : "Book Now"}
                    </Button>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {bookingOpen && !isAdmin && (
        <BookingModal tour={tour} session={session} onClose={() => setBookingOpen(false)} />
      )}
    </>
  );
}
