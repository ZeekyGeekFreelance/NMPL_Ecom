import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { logout, setUser } from "./AuthSlice";

export interface GuestCartItem {
  variantId: string;
  name: string;
  sku: string;
  price: number;
  image: string;
  stock: number;
  quantity: number;
}

interface GuestCartState {
  items: GuestCartItem[];
}

const initialState: GuestCartState = {
  items: [],
};

const guestCartSlice = createSlice({
  name: "guestCart",
  initialState,
  reducers: {
    addGuestCartItem: (state, action: PayloadAction<Omit<GuestCartItem, "quantity">>) => {
      const existingItem = state.items.find(
        (item) => item.variantId === action.payload.variantId
      );

      if (existingItem) {
        existingItem.quantity += 1;
        return;
      }

      state.items.push({
        ...action.payload,
        quantity: 1,
      });
    },
    updateGuestCartQuantity: (
      state,
      action: PayloadAction<{ variantId: string; quantity: number }>
    ) => {
      const existingItem = state.items.find(
        (item) => item.variantId === action.payload.variantId
      );
      if (!existingItem) {
        return;
      }

      const safeQuantity = Math.max(1, action.payload.quantity);
      existingItem.quantity = safeQuantity;
    },
    removeGuestCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(
        (item) => item.variantId !== action.payload
      );
    },
    clearGuestCart: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setUser, (state) => {
      state.items = [];
    });
    builder.addCase(logout, (state) => {
      state.items = [];
    });
  },
});

export const {
  addGuestCartItem,
  updateGuestCartQuantity,
  removeGuestCartItem,
  clearGuestCart,
} = guestCartSlice.actions;

export default guestCartSlice.reducer;
