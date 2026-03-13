import { ROLE } from "@prisma/client";

export type RegistrationPurpose = "USER_PORTAL" | "DEALER_PORTAL";

export interface RequestRegistrationOtpParams {
  email: string;
  phone: string;
  purpose?: RegistrationPurpose;
  requestDealerAccess?: boolean;
}

export interface RegisterUserParams {
  name: string;
  email: string;
  phone: string;
  password: string;
  emailOtpCode: string;
  phoneOtpCode?: string;
  requestDealerAccess?: boolean;
  businessName?: string;
  contactPhone?: string;
}

export interface ApplyDealerAccessParams {
  userId: string;
  businessName?: string;
  contactPhone?: string;
}

export interface SignInParams {
  email: string;
  password: string;
  portal?: RegistrationPurpose;
}

export interface AuthResponse {
  user: {
    id: string;
    accountReference: string;
    name: string;
    email: string;
    phone: string | null;
    role: ROLE;
    effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
    avatar: string | null;
    isDealer?: boolean;
    dealerStatus?: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED" | null;
    dealerBusinessName?: string | null;
    dealerContactPhone?: string | null;
  };
  accessToken?: string;
  refreshToken?: string;
  requiresApproval?: boolean;
}
