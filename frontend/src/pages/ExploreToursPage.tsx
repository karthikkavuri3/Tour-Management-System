"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "@/ui/components/Alert";
import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { TextField } from "@/ui/components/TextField";
import { ToggleGroup } from "@/ui/components/ToggleGroup";
import {
  FeatherAlertCircle, FeatherCheck, FeatherClock,
  FeatherDollarSign, FeatherMapPin, FeatherStar, FeatherUsers, FeatherX,
} from "@subframe/core";
import type { Session, TourPackage } from "@/lib/models";
import { getTours } from "@/lib/api";
import { tourImageUrl } from "@/lib/imageUtils";
import AppNavbar from "@/components/AppNavbar";

const DURATION_FILTER: Record<string, { min: number; max: number }> = {
  "1-3": { min: 1, max: 3 },
  "4-7": { min: 4, max: 7 },
  "8+":  { min: 8, max: 999 },
};

interface Props { session: Session; onLogout: () => void; }

export default function ExploreToursPage({ session, onLogout }: Props) {
  const navigate = useNavigate();

  const [tours, setTours] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [durationFilter, setDurationFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => { void load(); }, []);

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

  const load = async () => {
    setLoading(true); setListError("");
    try { setTours(await getTours()); }
    catch { setListError("Failed to load tours. Make sure the backend is running."); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    const list = tours.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.destinationName.toLowerCase().includes(search.toLowerCase())) return false;
      if (minPrice && t.price < Number(minPrice)) return false;
      if (maxPrice && t.price > Number(maxPrice)) return false;
      if (durationFilter && DURATION_FILTER[durationFilter]) {
        const { min, max } = DURATION_FILTER[durationFilter];
        if (t.durationDays < min || t.durationDays > max) return false;
      }
      if (availabilityFilter === "Available" && t.bookingsAvailable === 0) return false;
      if (availabilityFilter === "Limited" && (t.bookingsAvailable === 0 || t.bookingsAvailable > 5)) return false;
      return true;
    });
    if (sort === "price-high") list.sort((a, b) => b.price - a.price);
    else if (sort === "price-low") list.sort((a, b) => a.price - b.price);
    else if (sort === "oldest") list.sort((a, b) => a.id - b.id);
    else list.sort((a, b) => b.id - a.id); // newest
    return list;
  }, [tours, search, minPrice, maxPrice, durationFilter, availabilityFilter, sort]);

  const availabilityIcon = (tour: TourPackage) => {
    if (tour.bookingsAvailable === 0) return <IconWithBackground variant="error"   size="small" icon={<FeatherX />} />;
    if (tour.bookingsAvailable <= 5)  return <IconWithBackground variant="warning" size="small" icon={<FeatherAlertCircle />} />;
    return                                    <IconWithBackground variant="success" size="small" icon={<FeatherCheck />} />;
  };

  return (
    <div className="flex h-full w-full flex-col items-start bg-neutral-0 overflow-auto">

      <AppNavbar
        session={session}
        onLogout={onLogout}
        links={[
          { label: "Discover Tours", active: true,  onClick: () => {} },
          { label: "My Bookings",    active: false, onClick: () => navigate("/my-bookings") },
          { label: "Profile",        active: false, onClick: () => navigate("/my-bookings?tab=profile") },
        ]}
      />

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-start gap-8 bg-neutral-50 px-12 py-8 mobile:px-4 mobile:py-6">
        <div className="flex w-full max-w-[1280px] flex-col items-start gap-4 mx-auto">
          <span className="text-heading-1 font-heading-1 text-default-font">Explore Tours</span>

          {/* Row 1 — all filters + clear filters */}
          <div className="flex w-full flex-wrap items-end gap-6 mobile:flex-col mobile:gap-4">

            {/* Destination */}
            <div className="flex flex-col items-start gap-2 w-80 flex-none mobile:w-full">
              <span className="text-body-bold font-body-bold text-subtext-color">Destination</span>
              <TextField className="h-auto w-full" variant="filled" icon={<FeatherMapPin />}>
                <TextField.Input placeholder="Search destinations..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </TextField>
            </div>

            {/* Min / Max Price */}
            <div className="flex items-end gap-3 mobile:w-full mobile:flex-col">
              <div className="flex flex-col items-start gap-2 w-36 flex-none mobile:w-full">
                <span className="text-body-bold font-body-bold text-subtext-color">Min Price</span>
                <TextField className="h-auto w-full" variant="filled" icon={<FeatherDollarSign />}>
                  <TextField.Input type="number" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                </TextField>
              </div>
              <div className="flex flex-col items-start gap-2 w-36 flex-none mobile:w-full">
                <span className="text-body-bold font-body-bold text-subtext-color">Max Price</span>
                <TextField className="h-auto w-full" variant="filled" icon={<FeatherDollarSign />}>
                  <TextField.Input type="number" placeholder="5000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                </TextField>
              </div>
            </div>

            {/* Duration */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-body-bold font-body-bold text-subtext-color">Duration</span>
              <ToggleGroup className="h-8 px-1" value={durationFilter} onValueChange={(v) => setDurationFilter(v === durationFilter ? "" : v)}>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="1-3">1-3 days</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="4-7">4-7 days</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="8+">8+ days</ToggleGroup.Item>
              </ToggleGroup>
            </div>

            {/* Availability */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-body-bold font-body-bold text-subtext-color">Availability</span>
              <ToggleGroup className="h-8 px-1" value={availabilityFilter} onValueChange={(v) => setAvailabilityFilter(v === availabilityFilter ? "" : v)}>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="Available">Available</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="Limited">Limited</ToggleGroup.Item>
                <ToggleGroup.Item className="h-7 px-4" icon={null} value="All">All</ToggleGroup.Item>
              </ToggleGroup>
            </div>

            {/* Clear filters — inline, aligned to bottom */}
            <Button className="self-end flex-none" variant="neutral-secondary" onClick={() => { setSearch(""); setMinPrice(""); setMaxPrice(""); setDurationFilter(""); setAvailabilityFilter(""); setSort("newest"); }}>
              Clear filters
            </Button>
          </div>

          {/* Row 2 — sort */}
          <div className="flex items-center gap-3">
            <span className="text-body-bold font-body-bold text-subtext-color">Sort by</span>
            <select
              className="h-8 rounded-md border border-solid border-neutral-border bg-neutral-0 px-3 text-body font-body text-default-font focus:outline-none focus:border-brand-600 cursor-pointer"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price-high">Price: High → Low</option>
              <option value="price-low">Price: Low → High</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Tour cards grid ─────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center gap-12 px-12 py-12 mobile:px-4 mobile:py-6">
        {loading && <span className="text-body font-body text-subtext-color">Loading tours…</span>}
        {listError && <Alert variant="error" icon={<FeatherAlertCircle />} title="Failed to load tours" description={listError} />}
        {!loading && !listError && filtered.length === 0 && (
          <span className="text-body font-body text-subtext-color">No tours match your filters.</span>
        )}

        <div className="w-full max-w-[1280px] gap-6 grid grid-cols-3 mobile:grid-cols-1">
          {filtered.map((tour) => (
            <div
              key={tour.id}
              className="flex grow shrink-0 basis-0 flex-col items-start gap-4 overflow-hidden rounded-xl border border-solid border-neutral-border bg-neutral-50 cursor-pointer hover:border-brand-600 hover:shadow-lg transition-all duration-200"
              onClick={() => navigate(`/explore/tours/${tour.id}`)}
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
                <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
                <div className="flex w-full items-center gap-4">
                  <div className="flex grow shrink-0 basis-0 flex-col items-start">
                    <span className="text-caption font-caption text-subtext-color">Starting from</span>
                    <span className="text-heading-2 font-heading-2 text-default-font">${tour.price.toFixed(2)}</span>
                  </div>
                  <Button onClick={(e) => { e.stopPropagation(); navigate(`/explore/tours/${tour.id}`); }}>
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
