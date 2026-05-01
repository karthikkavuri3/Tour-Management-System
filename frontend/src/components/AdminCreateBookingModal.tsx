"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import type { AxiosError } from "axios";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { TextField } from "@/ui/components/TextField";
import { ToggleGroup } from "@/ui/components/ToggleGroup";
import {
  FeatherCalendar,
  FeatherChevronRight,
  FeatherCheckCircle,
  FeatherCreditCard,
  FeatherDownload,
  FeatherDollarSign,
  FeatherExternalLink,
  FeatherMapPin,
  FeatherPlus,
  FeatherSearch,
  FeatherTrash,
  FeatherClock,
  FeatherUser,
  FeatherUsers,
  FeatherX,
} from "@subframe/core";
import type { TourPackage, UserProfile } from "@/lib/models";
import { adminCreateBooking, downloadInvoicePdf, getInvoice } from "@/lib/api";
import { tourImageUrl } from "@/lib/imageUtils";

type Step = "user" | "tour" | "travelers" | "payment" | "confirmed";
type PaymentMethod = "CREDIT_CARD" | "CASH";
interface TravelerForm { firstName: string; lastName: string; age: string; }

const emptyTraveler = (): TravelerForm => ({ firstName: "", lastName: "", age: "" });

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function fmtDisplay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  users: UserProfile[];
  tours: TourPackage[];
  onClose: () => void;
  onCreated: () => void;
}

export default function AdminCreateBookingModal({ users, tours, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>("user");
  const [userQuery, setUserQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [tourQuery, setTourQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [travelStart, setTravelStart] = useState("");
  const [travelers, setTravelers] = useState<TravelerForm[]>([emptyTraveler()]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CREDIT_CARD");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmedRef, setConfirmedRef] = useState("");
  const [confirmedId, setConfirmedId] = useState<number | null>(null);
  const [confirmedInvoiceNum, setConfirmedInvoiceNum] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) ?? null, [users, selectedUserId]);
  const selectedTour = useMemo(() => tours.find((t) => t.id === selectedTourId) ?? null, [tours, selectedTourId]);
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q)
    );
  }, [users, userQuery]);
  const filteredTours = useMemo(() => {
    const q = tourQuery.trim().toLowerCase();
    if (!q) return tours;
    return tours.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.destinationName.toLowerCase().includes(q)
    );
  }, [tours, tourQuery]);

  const travelEnd = useMemo(() => {
    if (!selectedTour || !travelStart) return "";
    return addDays(travelStart, selectedTour.durationDays - 1);
  }, [selectedTour, travelStart]);

  const todayIso = toISO(new Date());
  const minStartDate = selectedTour?.startDate
    ? (selectedTour.startDate > todayIso ? selectedTour.startDate : todayIso)
    : todayIso;
  const maxStartDate = selectedTour?.endDate ? addDays(selectedTour.endDate, -(selectedTour.durationDays - 1)) : "";
  const totalAmount = useMemo(() => (selectedTour ? selectedTour.price * travelers.length : 0), [selectedTour, travelers.length]);

  const updateTraveler = (i: number, field: keyof TravelerForm, val: string) =>
    setTravelers((prev) => prev.map((t, j) => (j === i ? { ...t, [field]: val } : t)));

  const handleContinueFromUser = () => {
    if (!selectedUser) { setError("Please select a valid user."); return; }
    setError("");
    setStep("tour");
  };

  const handleContinueFromTour = () => {
    if (!selectedTour) { setError("Please select a valid tour package."); return; }
    if (!travelStart) { setError("Please select travel start date."); return; }
    if (maxStartDate && travelStart > maxStartDate) {
      setError(`Start date too late. Trip must complete by ${fmtDisplay(selectedTour.endDate!)}.`);
      return;
    }
    setError("");
    setStep("travelers");
  };

  const handleContinuePayment = () => {
    if (!selectedTour) return;
    for (const t of travelers) {
      if (!t.firstName.trim() || !t.lastName.trim() || !t.age) {
        setError("Please fill in all traveler details."); return;
      }
      if (Number(t.age) < 1 || Number(t.age) > 120) {
        setError("Please enter valid traveler ages."); return;
      }
    }
    setError("");
    setStep("payment");
  };

  const handleCreateBooking = async () => {
    if (!selectedTour || !selectedUser || !travelStart || !travelEnd) return;
    if (paymentMethod === "CREDIT_CARD" && (!cardNumber.trim() || !expiry.trim() || !cvv.trim() || !cardHolder.trim())) {
      setError("Please fill in all card details."); return;
    }
    setSaving(true);
    setError("");
    try {
      const booking = await adminCreateBooking({
        userId: selectedUser.id,
        tourPackageId: selectedTour.id,
        startDate: travelStart,
        endDate: travelEnd,
        totalAmount,
        paymentMethod,
        mockPaymentSuccess: true,
        customerEmail: selectedUser.email,
        customerName: selectedUser.fullName,
        tourTitle: selectedTour.title,
        destinationName: selectedTour.destinationName,
        durationDays: selectedTour.durationDays,
        pricePerPerson: selectedTour.price,
        travelers: travelers.map((t) => ({
          firstName: t.firstName.trim(),
          lastName: t.lastName.trim(),
          age: Number(t.age),
        })),
      });
      setConfirmedRef(booking.bookingReference);
      setConfirmedId(booking.id);
      try {
        const inv = await getInvoice(booking.id);
        setConfirmedInvoiceNum(inv.invoiceNumber ?? "");
      } catch {}
      setStep("confirmed");
      onCreated();
    } catch (err) {
      setError((err as AxiosError<{ message?: string }>).response?.data?.message || "Failed to create booking.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!confirmedId || !selectedUser || !selectedTour) return;
    setInvoiceLoading(true);
    try {
      let invoiceNum = confirmedInvoiceNum;
      if (!invoiceNum) {
        try {
          const inv = await getInvoice(confirmedId);
          invoiceNum = inv.invoiceNumber ?? "";
        } catch {}
      }
      const blob = await downloadInvoicePdf({
        recipientEmail: selectedUser.email,
        customerName: selectedUser.fullName,
        bookingReference: confirmedRef,
        invoiceNumber: invoiceNum,
        tourTitle: selectedTour.title,
        destinationName: selectedTour.destinationName,
        travelStartDate: travelStart,
        travelEndDate: travelEnd,
        durationDays: selectedTour.durationDays,
        numberOfTravelers: travelers.length,
        pricePerPerson: selectedTour.price,
        totalAmount,
        paymentMethod,
        bookingDate: new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoiceNum || confirmedRef}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    finally { setInvoiceLoading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex w-full max-w-2xl flex-col bg-neutral-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh]">
        <div className="flex w-full items-center gap-3 border-b border-solid border-neutral-border bg-neutral-50 px-6 py-4 flex-none">
          <span className="grow text-heading-2 font-heading-2 text-default-font">
            {step === "confirmed" ? "Booking Created" : "Add New Booking"}
          </span>
          <IconButton variant="neutral-secondary" icon={<FeatherX />} onClick={onClose} />
        </div>

        <div className="flex w-full flex-col items-start gap-5 overflow-y-auto px-6 py-6">
          {step === "user" && (
            <>
              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-body-bold font-body-bold text-default-font">Select User *</span>
                <TextField className="w-full" variant="outline" icon={<FeatherUser />}>
                  <TextField.Input
                    placeholder="Search and select user..."
                    value={userQuery}
                    onFocus={() => setUserDropdownOpen(true)}
                    onChange={(e) => { setUserQuery(e.target.value); setUserDropdownOpen(true); }}
                  />
                </TextField>
                {userDropdownOpen && (
                  <div
                    className="w-full max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-solid border-neutral-border bg-neutral-50"
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const el = e.currentTarget;
                      el.scrollTop += e.deltaY;
                    }}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    {filteredUsers.length === 0 ? (
                      <div className="px-4 py-4 text-body font-body text-subtext-color">No users found.</div>
                    ) : filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left border-b border-solid border-neutral-border last:border-b-0 hover:bg-brand-50 ${selectedUserId === u.id ? "bg-brand-50" : ""}`}
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setUserQuery(`${u.fullName} (${u.email})`);
                          setUserDropdownOpen(false);
                          setError("");
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-body-bold font-body-bold text-default-font">{u.fullName}</span>
                          <span className="text-caption font-caption text-subtext-color">{u.email}</span>
                        </div>
                        {selectedUserId === u.id && <FeatherCheckCircle className="text-body font-body text-success-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex w-full items-center gap-3">
                <Button variant="neutral-secondary" onClick={onClose}>Cancel</Button>
                <Button className="grow h-10" size="large" onClick={handleContinueFromUser}>Continue</Button>
              </div>
            </>
          )}

          {step === "tour" && (
            <>
              <div className="flex w-full items-center gap-2 rounded-lg border border-solid border-brand-200 bg-brand-50 px-4 py-3">
                <FeatherUser className="text-body font-body text-brand-600" />
                <span className="text-body font-body text-default-font">
                  Booking for: <strong>{selectedUser?.fullName}</strong> ({selectedUser?.email})
                </span>
              </div>

              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-body-bold font-body-bold text-default-font">Select Tour *</span>
                <TextField className="w-full" variant="outline" icon={<FeatherSearch />}>
                  <TextField.Input
                    placeholder="Search tours by title or destination..."
                    value={tourQuery}
                    onChange={(e) => setTourQuery(e.target.value)}
                  />
                </TextField>
                <div className="w-full max-h-72 overflow-y-auto rounded-xl border border-solid border-neutral-border bg-neutral-50 p-3">
                  {filteredTours.length === 0 ? (
                    <div className="px-2 py-2 text-body font-body text-subtext-color">No tours found.</div>
                  ) : (
                    <div className="flex w-full flex-col gap-3">
                      {filteredTours.map((t) => (
                        <div
                          key={t.id}
                          className={`flex w-full items-center gap-3 rounded-lg border border-solid px-3 py-3 cursor-pointer transition-colors ${
                            selectedTourId === t.id ? "border-brand-600 bg-brand-50" : "border-neutral-border bg-neutral-0 hover:border-brand-400"
                          }`}
                          onClick={() => { setSelectedTourId(t.id); setError(""); }}
                        >
                          <img
                            className="h-16 w-24 flex-none rounded-md object-cover"
                            src={t.imageUrl || tourImageUrl(t.title, t.title, "300x200")}
                            alt={t.title}
                          />
                          <div className="flex grow flex-col gap-1 min-w-0">
                            <span className="text-body-bold font-body-bold text-default-font truncate">{t.title}</span>
                            <div className="flex items-center gap-3 text-caption font-caption text-subtext-color">
                              <span className="inline-flex items-center gap-1"><FeatherMapPin className="text-caption font-caption" /> {t.title}</span>
                              <span className="inline-flex items-center gap-1"><FeatherClock className="text-caption font-caption" /> {t.durationDays}d</span>
                              <span>${Number(t.price).toFixed(2)}</span>
                            </div>
                          </div>
                          <a
                            href={`/explore/tours/${t.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-solid border-neutral-border px-2 py-1 text-caption font-caption text-default-font hover:bg-neutral-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open <FeatherExternalLink className="text-caption font-caption" />
                          </a>
                          {selectedTourId === t.id && <FeatherCheckCircle className="text-body font-body text-success-600 flex-none" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedTour && (
                <div className="flex w-full flex-col items-start gap-3">
                  <span className="text-body-bold font-body-bold text-default-font">Select Travel Start Date *</span>
                  <div className="w-full flex justify-center rounded-xl border border-solid border-neutral-border bg-neutral-50 py-2 rdp-custom">
                    <DayPicker
                      mode="single"
                      selected={travelStart ? new Date(travelStart + "T00:00:00") : undefined}
                      onSelect={(day) => { if (day) setTravelStart(toISO(day)); }}
                      disabled={[
                        { before: new Date(minStartDate + "T00:00:00") },
                        ...(maxStartDate ? [{ after: new Date(maxStartDate + "T00:00:00") }] : []),
                      ]}
                      defaultMonth={new Date(minStartDate + "T00:00:00")}
                      showOutsideDays={false}
                    />
                  </div>
                  {travelStart && (
                    <span className="text-caption font-caption text-subtext-color">
                      Travel dates: {fmtDisplay(travelStart)} - {fmtDisplay(travelEnd)}
                    </span>
                  )}
                </div>
              )}

              <div className="flex w-full items-center gap-3">
                <Button variant="neutral-secondary" onClick={() => setStep("user")}>Back</Button>
                <Button className="grow h-10" size="large" onClick={handleContinueFromTour}>
                  Continue <FeatherChevronRight className="text-body font-body" />
                </Button>
              </div>
            </>
          )}

          {step === "travelers" && (
            <>
              <span className="text-body-bold font-body-bold text-default-font">Traveler Information</span>
              {travelers.map((t, i) => (
                <div key={i} className="flex w-full items-start gap-3 mobile:flex-col rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                  <TextField className="grow" variant="outline" label="First Name">
                    <TextField.Input value={t.firstName} onChange={(e) => updateTraveler(i, "firstName", e.target.value)} />
                  </TextField>
                  <TextField className="grow" variant="outline" label="Last Name">
                    <TextField.Input value={t.lastName} onChange={(e) => updateTraveler(i, "lastName", e.target.value)} />
                  </TextField>
                  <TextField className="w-24 flex-none mobile:w-full" variant="outline" label="Age">
                    <TextField.Input type="number" value={t.age} onChange={(e) => updateTraveler(i, "age", e.target.value)} />
                  </TextField>
                  {travelers.length > 1 && (
                    <IconButton variant="destructive-secondary" icon={<FeatherTrash />} onClick={() => setTravelers((prev) => prev.filter((_, idx) => idx !== i))} />
                  )}
                </div>
              ))}
              {travelers.length < 6 && (
                <Button variant="neutral-secondary" icon={<FeatherPlus />} onClick={() => setTravelers((prev) => [...prev, emptyTraveler()])}>
                  Add Traveler
                </Button>
              )}
              <div className="flex w-full items-center gap-3 rounded-lg bg-neutral-100 px-5 py-4">
                <FeatherUsers className="text-body font-body text-subtext-color" />
                <span className="grow text-body font-body text-subtext-color">Total</span>
                <span className="text-body-bold font-body-bold text-default-font">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex w-full items-center gap-3">
                <Button variant="neutral-secondary" onClick={() => setStep("tour")}>Back</Button>
                <Button className="grow h-10" size="large" onClick={handleContinuePayment}>Continue to Payment</Button>
              </div>
            </>
          )}

          {step === "payment" && (
            <>
              <span className="text-body-bold font-body-bold text-default-font">Payment</span>
              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-caption-bold font-caption-bold text-subtext-color">Payment Method</span>
                <ToggleGroup className="h-8 px-1" value={paymentMethod} onValueChange={(v) => setPaymentMethod((v || "CREDIT_CARD") as PaymentMethod)}>
                  <ToggleGroup.Item className="h-7 px-4" value="CREDIT_CARD" icon={<FeatherCreditCard />}>Pay with Card</ToggleGroup.Item>
                  <ToggleGroup.Item className="h-7 px-4" value="CASH" icon={<FeatherDollarSign />}>Pay with Cash</ToggleGroup.Item>
                </ToggleGroup>
              </div>
              {paymentMethod === "CREDIT_CARD" && (
                <>
                  <TextField className="w-full" variant="outline" label="Card Number">
                    <TextField.Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                  </TextField>
                  <div className="flex w-full items-start gap-3 mobile:flex-col">
                    <TextField className="grow" variant="outline" label="Expiry">
                      <TextField.Input value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                    </TextField>
                    <TextField className="grow" variant="outline" label="CVV">
                      <TextField.Input value={cvv} onChange={(e) => setCvv(e.target.value)} />
                    </TextField>
                  </div>
                  <TextField className="w-full" variant="outline" label="Cardholder Name">
                    <TextField.Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} />
                  </TextField>
                </>
              )}
              <div className="flex w-full items-center gap-2 rounded-lg bg-neutral-100 px-5 py-4">
                <span className="grow text-body font-body text-subtext-color">Total Amount</span>
                <span className="text-heading-3 font-heading-3 text-default-font">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex w-full items-center gap-3">
                <Button variant="neutral-secondary" onClick={() => setStep("travelers")}>Back</Button>
                <Button className="grow h-10" size="large" loading={saving} onClick={() => void handleCreateBooking()}>
                  Create Booking
                </Button>
              </div>
            </>
          )}

          {step === "confirmed" && (
            <>
              <div className="flex w-full flex-col items-center gap-3 py-4">
                <FeatherCheckCircle className="text-heading-1 font-heading-1 text-success-600" />
                <span className="text-heading-2 font-heading-2 text-default-font">Booking Created Successfully</span>
                <span className="text-body font-body text-subtext-color text-center">
                  Booking reference: <strong>{confirmedRef}</strong>
                </span>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3">
                <Button size="large" variant="brand-secondary" icon={<FeatherDownload />} loading={invoiceLoading} onClick={() => void handleDownloadInvoice()}>
                  Download Payment Invoice ({confirmedInvoiceNum || confirmedRef})
                </Button>
                <Button size="large" onClick={onClose}>Close</Button>
              </div>
            </>
          )}

          {error && <span className="text-caption font-caption text-error-700">{error}</span>}
        </div>
      </div>
    </div>
  );
}

