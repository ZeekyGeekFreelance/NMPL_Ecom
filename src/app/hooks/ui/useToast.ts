import { addToast, removeToast, Toast } from "@/app/store/slices/ToastSlice";
import { useAppDispatch } from "../state/useRedux";

const useToast = () => {
  const dispatch = useAppDispatch();

  const showToast = (
    message: string | undefined,
    type: Toast["type"],
    options?: Pick<Toast, "title" | "duration">
  ) => {
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) {
      return;
    }

    dispatch(addToast({ message: normalizedMessage, type, ...options }));
  };

  const dismissToast = (id: string) => {
    dispatch(removeToast(id));
  };

  return { showToast, dismissToast };
};

export default useToast;
