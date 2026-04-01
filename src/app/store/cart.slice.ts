import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface CartState { count: number }

const cartSlice = createSlice({
  name: "cart",
  initialState: { count: 0 } as CartState,
  reducers: {
    setCartCount(state, action: PayloadAction<number>) {
      state.count = action.payload;
    },
  },
});

export const { setCartCount } = cartSlice.actions;
export default cartSlice.reducer;
