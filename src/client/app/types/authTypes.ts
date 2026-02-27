export interface User {
  id: string;
  accountReference?: string;
  name: string;
  role: string;
  effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
  avatar: string | null;
  email: string;
  phone?: string | null;
  isDealer?: boolean;
  dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
  user?: {
    id: string;
    accountReference?: string;
    name: string;
    role: string;
    effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
    avatar: string | null;
    email: string;
    phone?: string | null;
    isDealer?: boolean;
    dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
    dealerBusinessName?: string | null;
    dealerContactPhone?: string | null;
  };
}

