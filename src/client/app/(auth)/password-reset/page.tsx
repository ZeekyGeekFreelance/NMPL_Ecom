"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/app/components/atoms/Button";
import MainLayout from "@/app/components/templates/MainLayout";
import { useForgotPasswordMutation } from "@/app/store/apis/AuthApi";

const PasswordReset = () => {
  const [email, setEmail] = useState("");
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRequestLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Email is required.");
      setSuccessMessage("");
      return;
    }

    try {
      const response = await forgotPassword({ email: normalizedEmail }).unwrap();
      setSuccessMessage(
        response?.message ||
          "If an account exists for this email, a password reset link has been sent."
      );
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(
        error?.data?.message || "Unable to send password reset link right now."
      );
      setSuccessMessage("");
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-lg">
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-center text-green-700 w-full px-4 py-4 rounded mb-4">
              <span className="block">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-center text-red-700 w-full px-4 py-4 rounded mb-4">
              <span className="block">{errorMessage}</span>
            </div>
          )}

          <h2 className="text-lg font-medium mb-3">Reset Password</h2>
          <p className="text-sm text-gray-700 mb-4">
            Enter your registered email address. We will send a password reset link.
          </p>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            placeholder="you@example.com"
          />

          <Button
            type="button"
            className="bg-primary text-white w-full py-[12px] rounded"
            disabled={isLoading}
            onClick={handleRequestLink}
          >
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>

          <Link className="mt-4 inline-block hover:underline text-sm" href="/sign-in">
            Back to sign in
          </Link>
        </div>
      </div>
    </MainLayout>
  );
};

export default PasswordReset;
