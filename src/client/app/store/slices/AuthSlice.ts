import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface User {
  id: string;
  accountReference?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
  avatar: string | null;
  isDealer?: boolean;
  dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
}

interface AuthState {
  user: User | undefined | null;
  isAuthChecking: boolean;
}

const initialState: AuthState = {
  user: undefined,
  isAuthChecking: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ user: User }>) => {
      state.user = action.payload.user;
      state.isAuthChecking = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthChecking = false;
    },
    setAuthChecking: (state, action: PayloadAction<boolean>) => {
      state.isAuthChecking = action.payload;
    },
  },
});

export const { setUser, logout, setAuthChecking } = authSlice.actions;
export default authSlice.reducer;

