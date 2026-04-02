"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { Avatar } from "@/ui/components/Avatar";
import { Button } from "@/ui/components/Button";
import { Tabs } from "@/ui/components/Tabs";
import { TextField } from "@/ui/components/TextField";
import {
  FeatherArrowRight, FeatherCheckCircle, FeatherCompass, FeatherKey, FeatherLock, FeatherLogIn,
  FeatherMail, FeatherShield, FeatherStar,
} from "@subframe/core";
import type { Session } from "@/lib/models";
import {
  loginUser,
  registerUser,
  resetPasswordWithCode,
  sendForgotPasswordCode,
  verifyForgotPasswordCode,
} from "@/lib/api";

interface Props {
  session: Session | null;
  onLogin: (s: Session) => void;
}

export default function LandingPage({ session, onLogin }: Props) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccessMessage, setLoginSuccessMessage] = useState("");
  const [forgotStep, setForgotStep] = useState<"none" | "request" | "verify" | "reset">("none");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    fullName: "", email: "", phone: "", password: "", confirmPassword: "",
  });

  const isAdmin = useMemo(
    () => !!session?.roles?.some((r) => r === "ADMIN" || r === "TRAVEL_MANAGER" || r === "STAFF"),
    [session]
  );

  useEffect(() => {
    if (session) navigate(isAdmin ? "/admin" : "/explore", { replace: true });
  }, [session, isAdmin, navigate]);

  const apiError = (fallback: string, err: unknown) => {
    const e = err as AxiosError<{ message?: string; error?: string }>;
    if (!e.response) return "Cannot reach backend. Make sure api-gateway is running on port 8080.";
    return e.response.data?.message || e.response.data?.error || fallback;
  };

  const handleLogin = async () => {
    setError("");
    setLoginSuccessMessage("");
    if (!loginForm.email || !loginForm.password) { setError("Please enter email and password."); return; }
    try {
      setIsSubmitting(true);
      const s = await loginUser({ email: loginForm.email.trim(), password: loginForm.password });
      onLogin(s);
      navigate(s.roles.some((r) => r === "ADMIN" || r === "TRAVEL_MANAGER" || r === "STAFF") ? "/admin" : "/explore", { replace: true });
    } catch (e) { setError(apiError("Login failed. Check your credentials.", e)); }
    finally { setIsSubmitting(false); }
  };

  const handleSignup = async () => {
    setError("");
    setLoginSuccessMessage("");
    if (!signupForm.fullName || !signupForm.email || !signupForm.password || !signupForm.confirmPassword) {
      setError("Please fill all required fields."); return;
    }
    if (signupForm.password !== signupForm.confirmPassword) { setError("Passwords do not match."); return; }
    try {
      setIsSubmitting(true);
      await registerUser({ fullName: signupForm.fullName.trim(), email: signupForm.email.trim(), phone: signupForm.phone.trim() || undefined, password: signupForm.password });
      const s = await loginUser({ email: signupForm.email.trim(), password: signupForm.password });
      onLogin(s);
      navigate("/explore", { replace: true });
    } catch (e) { setError(apiError("Sign up failed. Please verify your details.", e)); }
    finally { setIsSubmitting(false); }
  };

  const startForgotPassword = () => {
    setError("");
    setLoginSuccessMessage("");
    setForgotMessage("");
    setForgotError("");
    setForgotEmail(loginForm.email.trim());
    setForgotCode("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotStep("request");
  };

  const handleSendResetCode = async () => {
    setForgotError("");
    setForgotMessage("");
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email.");
      return;
    }
    try {
      setForgotSubmitting(true);
      await sendForgotPasswordCode({ email: forgotEmail.trim() });
      setForgotMessage("A verification code has been sent to your email.");
      setForgotStep("verify");
    } catch (e) {
      setForgotError(apiError("Could not send reset code. Please try again.", e));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleVerifyResetCode = async () => {
    setForgotError("");
    setForgotMessage("");
    if (!forgotCode.trim()) {
      setForgotError("Please enter the passcode sent to your email.");
      return;
    }
    try {
      setForgotSubmitting(true);
      const res = await verifyForgotPasswordCode({ email: forgotEmail.trim(), code: forgotCode.trim() });
      setForgotMessage(res.message || "Passcode verified.");
      setForgotStep("reset");
    } catch (e) {
      setForgotError(apiError("Invalid or expired passcode.", e));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setForgotError("");
    setForgotMessage("");
    if (!forgotNewPassword || !forgotConfirmPassword) {
      setForgotError("Please fill both password fields.");
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError("New password must be at least 6 characters.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    try {
      setForgotSubmitting(true);
      const res = await resetPasswordWithCode({
        email: forgotEmail.trim(),
        code: forgotCode.trim(),
        newPassword: forgotNewPassword,
      });
      const successText = res.message || "Password reset successful.";
      setForgotMessage(successText);
      setLoginForm((prev) => ({ ...prev, email: forgotEmail.trim(), password: "" }));
      setForgotStep("none");
      setActiveTab("login");
      setError("");
      setForgotError("");
      setLoginSuccessMessage(successText + " Please sign in with your new password.");
    } catch (e) {
      setForgotError(apiError("Could not reset password.", e));
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="flex w-full items-start overflow-hidden bg-default-background h-screen">
      {/* Left hero panel */}
      <div className="flex flex-col items-start justify-center self-stretch w-[55%] relative mobile:hidden">
        <img className="min-h-[0px] w-full grow shrink-0 basis-0 object-cover absolute inset-0" src="https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80" />
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start bg-gradient-to-r from-[rgba(10,10,10,0.9)] to-[rgba(10,10,10,0.3)] absolute inset-0" />
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start justify-end gap-6 px-12 py-16 z-10">
          <div className="flex w-full max-w-[448px] flex-col items-start gap-8">
            <span className="text-caption-bold font-caption-bold text-brand-600">EXPLORE THE WORLD</span>
            <span className="w-full text-heading-1 font-heading-1 text-default-font">Discover breathtaking destinations and create unforgettable memories</span>
            <span className="w-full text-body font-body text-neutral-400">Join over 50,000 travelers who have embarked on extraordinary journeys with us. Your next adventure awaits.</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-brand-600">500+</span>
              <span className="text-caption font-caption text-neutral-400">Curated Tours</span>
            </div>
            <div className="flex h-12 w-px flex-none flex-col items-center gap-2 bg-neutral-200" />
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-brand-600">50K+</span>
              <span className="text-caption font-caption text-neutral-400">Happy Travelers</span>
            </div>
            <div className="flex h-12 w-px flex-none flex-col items-center gap-2 bg-neutral-200" />
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-brand-600">98%</span>
              <span className="text-caption font-caption text-neutral-400">Satisfaction Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex flex-col items-center justify-center self-stretch bg-neutral-50 px-12 py-12 w-[45%] relative overflow-y-auto mobile:h-auto mobile:grow mobile:shrink-0 mobile:basis-0 mobile:self-stretch mobile:px-6 mobile:py-8 mobile:w-full">
        <img className="min-h-[0px] w-full grow shrink-0 basis-0 object-cover absolute inset-0" src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80" />
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-center bg-gradient-to-b from-[rgba(10,10,10,0.7)] to-[rgba(10,10,10,0.85)] absolute inset-0" />
        <div className="flex w-full max-w-[384px] flex-col items-center gap-8 relative z-10">
          <div className="flex w-full flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <FeatherCompass className="text-heading-2 font-heading-2 text-brand-600" />
              <span className="text-heading-1 font-heading-1 text-default-font">Wanderlust</span>
            </div>
            <span className="text-body font-body text-subtext-color text-center">Your gateway to extraordinary adventures</span>
          </div>

          <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-neutral-0 px-6 py-6 shadow-lg relative">
            <img className="min-h-[0px] w-full grow shrink-0 basis-0 rounded-lg object-cover absolute inset-0 opacity-5" src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80" />
            <div className="flex w-full flex-col items-start gap-6 relative z-10">
              {forgotStep === "none" ? (
                <Tabs>
                  <Tabs.Item active={activeTab === "login"} onClick={() => { setError(""); setForgotError(""); setForgotMessage(""); setActiveTab("login"); }}>
                    <span className="text-[18px] font-semibold">Login</span>
                  </Tabs.Item>
                  <Tabs.Item active={activeTab === "signup"} onClick={() => { setError(""); setLoginSuccessMessage(""); setForgotStep("none"); setForgotError(""); setForgotMessage(""); setActiveTab("signup"); }}>
                    <span className="text-[18px] font-semibold">Sign Up</span>
                  </Tabs.Item>
                </Tabs>
              ) : (
                <div className="flex w-full items-end border-b border-solid border-neutral-border pb-2">
                  <span className="text-heading-3 font-heading-3 text-default-font">Password Recovery</span>
                </div>
              )}

              {activeTab === "login" ? (
                forgotStep === "none" ? (
                  <form className="flex w-full flex-col items-start gap-6" onSubmit={(e) => { e.preventDefault(); void handleLogin(); }}>
                    <div className="flex w-full flex-col items-start gap-4">
                      <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Email Address</span>} helpText="We'll never share your email with anyone" icon={<FeatherMail />}>
                        <TextField.Input className="text-[16px] placeholder:text-[16px]" type="email" placeholder="you@example.com" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} />
                      </TextField>
                      <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Password</span>} helpText="" icon={<FeatherLock />}>
                        <TextField.Input className="text-[16px] placeholder:text-[16px]" type="password" placeholder="Enter your password" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
                      </TextField>
                    </div>
                    <button
                      type="button"
                      className="text-caption-bold font-caption-bold text-brand-600 hover:text-brand-700"
                      onClick={startForgotPassword}
                    >
                      Forgot password?
                    </button>
                    <Button className="h-10 w-full flex-none" variant="brand-primary" size="large" icon={<FeatherLogIn />} loading={isSubmitting} type="submit">Sign In</Button>
                  </form>
                ) : (
                  <div className="flex w-full flex-col items-start gap-5">
                    {forgotStep === "request" && (
                      <>
                        <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Email Address</span>} helpText="We will send a passcode to this email" icon={<FeatherMail />}>
                          <TextField.Input className="text-[16px] placeholder:text-[16px]" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                        </TextField>
                        <div className="flex w-full items-center gap-3">
                          <Button variant="neutral-secondary" onClick={() => setForgotStep("none")}>Back</Button>
                          <Button className="grow" icon={<FeatherArrowRight />} loading={forgotSubmitting} onClick={() => void handleSendResetCode()}>
                            Send Passcode
                          </Button>
                        </div>
                      </>
                    )}

                    {forgotStep === "verify" && (
                      <>
                        <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Passcode</span>} helpText={`Enter the code sent to ${forgotEmail}`} icon={<FeatherKey />}>
                          <TextField.Input className="text-[16px] placeholder:text-[16px]" placeholder="6-digit code" value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} />
                        </TextField>
                        <div className="flex w-full items-center gap-3">
                          <Button variant="neutral-secondary" loading={forgotSubmitting} onClick={() => void handleSendResetCode()}>
                            Resend
                          </Button>
                          <Button className="grow" icon={<FeatherCheckCircle />} loading={forgotSubmitting} onClick={() => void handleVerifyResetCode()}>
                            Verify Code
                          </Button>
                        </div>
                      </>
                    )}

                    {forgotStep === "reset" && (
                      <>
                        <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">New Password</span>} icon={<FeatherLock />}>
                          <TextField.Input className="text-[16px] placeholder:text-[16px]" type="password" placeholder="Minimum 6 characters" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} />
                        </TextField>
                        <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Confirm New Password</span>} icon={<FeatherLock />}>
                          <TextField.Input className="text-[16px] placeholder:text-[16px]" type="password" placeholder="Re-enter password" value={forgotConfirmPassword} onChange={(e) => setForgotConfirmPassword(e.target.value)} />
                        </TextField>
                        <div className="flex w-full items-center gap-3">
                          <Button variant="neutral-secondary" onClick={() => setForgotStep("verify")}>Back</Button>
                          <Button className="grow" icon={<FeatherCheckCircle />} loading={forgotSubmitting} onClick={() => void handleResetPassword()}>
                            Set New Password
                          </Button>
                        </div>
                      </>
                    )}

                    {forgotMessage && (
                      <div className="w-full rounded-md border border-solid border-success-200 bg-success-50 px-3 py-2">
                        <span className="text-caption font-caption text-success-700">{forgotMessage}</span>
                      </div>
                    )}
                    {forgotError && (
                      <div className="w-full rounded-md border border-solid border-error-200 bg-error-50 px-3 py-2">
                        <span className="text-caption font-caption text-error-700">{forgotError}</span>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <form className="flex w-full flex-col items-start gap-6" onSubmit={(e) => { e.preventDefault(); void handleSignup(); }}>
                  <div className="flex w-full flex-col items-start gap-4">
                    <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Full Name</span>} icon={<FeatherCompass />}>
                      <TextField.Input className="text-[16px] placeholder:text-[16px]" placeholder="Your full name" value={signupForm.fullName} onChange={(e) => setSignupForm((p) => ({ ...p, fullName: e.target.value }))} />
                    </TextField>
                    <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Email Address</span>} icon={<FeatherMail />}>
                      <TextField.Input className="text-[16px] placeholder:text-[16px]" type="email" placeholder="you@example.com" value={signupForm.email} onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))} />
                    </TextField>
                    <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Phone (optional)</span>}>
                      <TextField.Input className="text-[16px] placeholder:text-[16px]" type="tel" placeholder="+1 555 000 1234" value={signupForm.phone} onChange={(e) => setSignupForm((p) => ({ ...p, phone: e.target.value }))} />
                    </TextField>
                    <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Password</span>} icon={<FeatherLock />}>
                      <TextField.Input className="text-[16px] placeholder:text-[16px]" type="password" placeholder="Create password" value={signupForm.password} onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))} />
                    </TextField>
                    <TextField className="h-auto w-full flex-none" variant="outline" label={<span className="text-[15px] font-semibold">Confirm Password</span>} icon={<FeatherLock />}>
                      <TextField.Input className="text-[16px] placeholder:text-[16px]" type="password" placeholder="Confirm password" value={signupForm.confirmPassword} onChange={(e) => setSignupForm((p) => ({ ...p, confirmPassword: e.target.value }))} />
                    </TextField>
                  </div>
                  <Button className="h-10 w-full flex-none" variant="brand-primary" size="large" icon={<FeatherLogIn />} loading={isSubmitting} type="submit">Create Account</Button>
                </form>
              )}

              {activeTab === "login" && forgotStep === "none" && loginSuccessMessage && (
                <div className="w-full rounded-md border border-solid border-success-200 bg-success-50 px-3 py-2">
                  <span className="text-caption font-caption text-success-700">{loginSuccessMessage}</span>
                </div>
              )}
              {error && <span className="text-caption font-caption text-error-700">{error}</span>}

              <div className="flex w-full flex-col items-center gap-3 pt-2">
                <div className="flex w-full items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <FeatherShield className="text-body font-body text-success-600" />
                    <span className="text-caption font-caption text-neutral-400">SSL Encrypted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FeatherLock className="text-body font-body text-success-600" />
                    <span className="text-caption font-caption text-neutral-400">Secure Payments</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Avatar size="small" image="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80">A</Avatar>
                <Avatar className="-ml-2" size="small" image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80">B</Avatar>
                <Avatar className="-ml-2" size="small" image="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80">C</Avatar>
                <Avatar className="-ml-2" size="small" image="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80">D</Avatar>
              </div>
              <span className="text-caption font-caption text-subtext-color">Join 50,000+ travelers today</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((i) => <FeatherStar key={i} className="text-body font-body text-warning-600" />)}
              <span className="text-caption font-caption text-subtext-color">4.9/5 from 12,000+ reviews</span>
            </div>
          </div>
          <span className="text-caption font-caption text-neutral-400 text-center">By continuing, you agree to our Terms of Service and Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}
