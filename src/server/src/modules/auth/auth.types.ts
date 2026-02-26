import { ROLE } from "@prisma/client";

export type RegistrationPurpose = "USER_PORTAL" | "DEALER_PORTAL";

export interface RequestRegistrationOtpParams {
  email: string;
  purpose?: RegistrationPurpose;
  requestDealerAccess?: boolean;
}

export interface RegisterUserParams {
  name: string;
  email: string;
  password: string;
  otpCode: string;
  requestDealerAccess?: boolean;
  businessName?: string;
  contactPhone?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    accountReference: string;
    name: string;
    email: string;
    role: ROLE;
    avatar: string | null;
    isDealer?: boolean;
    dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
    dealerBusinessName?: string | null;
    dealerContactPhone?: string | null;
  };
  accessToken?: string;
  refreshToken?: string;
  requiresApproval?: boolean;
}
