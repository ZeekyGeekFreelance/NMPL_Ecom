export interface User {
  id: string;
  accountReference?: string;
  name: string;
  role: string;
  avatar: string | null;
  email: string;
  isDealer?: boolean;
  dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
  user?: {
    id: string;
    accountReference?: string;
    name: string;
    role: string;
    avatar: string | null;
    email: string;
    isDealer?: boolean;
    dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
    dealerBusinessName?: string | null;
    dealerContactPhone?: string | null;
  };
}

