import React from "react";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";

interface AddToCartButtonProps {
  isLoading: boolean;
  selectedVariant: unknown | null;
  handleAddToCart: () => void;
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  isLoading,
  selectedVariant,
  handleAddToCart,
}) => {
  const isDisabled = isLoading || !selectedVariant;

  const buttonText = isLoading ? (
    <span className="flex items-center justify-center">
      <MiniSpinner size={18} />
    </span>
  ) : selectedVariant ? (
    "Add to Cart"
  ) : (
    "Select a Variant"
  );

  return (
    <button
      disabled={isDisabled}
      onClick={handleAddToCart}
      className={[
        "w-full py-4 text-base font-semibold rounded-xl transition-all duration-300",
        "border-2 border-indigo-600 text-indigo-600",
        isDisabled
          ? "cursor-not-allowed opacity-60"
          : "hover:bg-indigo-600 hover:text-white",
      ].join(" ")}
    >
      {buttonText}
    </button>
  );
};

export default AddToCartButton;
