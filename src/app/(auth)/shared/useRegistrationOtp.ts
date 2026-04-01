"use client";

import { useEffect, useState } from "react";
import { useRequestRegistrationOtpMutation } from "@/app/store/apis/AuthApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import {
  normalizeEmailValue,
  normalizePhoneDigits,
  validateEmailValue,
  validateTenDigitPhone,
} from "@/app/lib/validators/common";

const DEFAULT_OTP_COOLDOWN_SECONDS = 60;

type RegistrationOtpPurpose = "USER_PORTAL" | "DEALER_PORTAL";

type OtpFeedback = {
  type: "success" | "error";
  message: string;
};

type UseRegistrationOtpOptions = {
  purpose?: RegistrationOtpPurpose;
  requestDealerAccess?: boolean;
};

const toRetryAfterSeconds = (message: string): number => {
  const match = message.match(/(\d+)\s*second/i);
  if (!match) {
    return 0;
  }

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
};

export const useRegistrationOtp = ({
  purpose,
  requestDealerAccess,
}: UseRegistrationOtpOptions = {}) => {
  const [requestRegistrationOtp, { isLoading }] =
    useRequestRegistrationOtpMutation();
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [feedback, setFeedback] = useState<OtpFeedback | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((previousValue) => Math.max(previousValue - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownSeconds]);

  const sendOtp = async (emailValue: string, phoneValue: string): Promise<boolean> => {
    const email = normalizeEmailValue(emailValue);
    const normalizedPhone = normalizePhoneDigits(phoneValue, 10);

    if (!email) {
      setFeedback({
        type: "error",
        message: "Enter your email first to receive an OTP.",
      });
      return false;
    }

    if (validateEmailValue(email) !== true) {
      setFeedback({
        type: "error",
        message: "Enter a valid email address before requesting OTP.",
      });
      return false;
    }

    if (!normalizedPhone) {
      setFeedback({
        type: "error",
        message: "Enter your phone number first to continue registration.",
      });
      return false;
    }

    if (validateTenDigitPhone(normalizedPhone) !== true) {
      setFeedback({
        type: "error",
        message: "Phone number must be exactly 10 digits before requesting OTP.",
      });
      return false;
    }

    try {
      const response = await requestRegistrationOtp({
        email,
        phone: normalizedPhone,
        purpose,
        requestDealerAccess,
      }).unwrap();

      const nextCooldown =
        Number(response.resendAvailableInSeconds) > 0
          ? Number(response.resendAvailableInSeconds)
          : DEFAULT_OTP_COOLDOWN_SECONDS;

      setCooldownSeconds(nextCooldown);
      setFeedback({
        type: "success",
        message:
          response.message ||
          "Email OTP sent. Please check your inbox and enter the 6-digit code.",
      });
      return true;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Failed to send OTP. Please try again."
      );
      const retryAfterSeconds = toRetryAfterSeconds(message);

      if (retryAfterSeconds > 0) {
        setCooldownSeconds(retryAfterSeconds);
      }

      setFeedback({
        type: "error",
        message,
      });
      return false;
    }
  };

  return {
    sendOtp,
    isSendingOtp: isLoading,
    cooldownSeconds,
    feedback,
    canSendOtp: !isLoading && cooldownSeconds === 0,
  };
};
