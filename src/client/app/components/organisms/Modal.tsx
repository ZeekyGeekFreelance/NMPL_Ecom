"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  contentClassName = "",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const baseContentLayoutClassName =
    "h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full min-h-0";
  const resolvedContentLayoutClassName =
    contentClassName.trim().length > 0
      ? contentClassName
      : "max-w-2xl overflow-y-auto p-6";

  useEffect(() => {
    if (!open) {
      return;
    }

    const body = document.body;
    const dashboardScrollContainer = document.querySelector(
      '[data-dashboard-scroll-container="true"]'
    ) as HTMLElement | null;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    const previousDashboardOverflow = dashboardScrollContainer?.style.overflow;
    const previousDashboardTouchAction =
      dashboardScrollContainer?.style.touchAction;
    const currentCount = Number(body.dataset.modalOpenCount || "0");
    const nextCount = currentCount + 1;

    body.dataset.modalOpenCount = String(nextCount);
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    if (dashboardScrollContainer) {
      dashboardScrollContainer.style.overflow = "hidden";
      dashboardScrollContainer.style.touchAction = "none";
    }

    return () => {
      const latestCount = Number(body.dataset.modalOpenCount || "1");
      const decrementedCount = Math.max(0, latestCount - 1);

      if (decrementedCount === 0) {
        delete body.dataset.modalOpenCount;
        body.style.overflow = previousOverflow;
        body.style.touchAction = previousTouchAction;
        if (dashboardScrollContainer) {
          dashboardScrollContainer.style.overflow = previousDashboardOverflow || "";
          dashboardScrollContainer.style.touchAction =
            previousDashboardTouchAction || "";
        }
        return;
      }

      body.dataset.modalOpenCount = String(decrementedCount);
    };
  }, [open]);

  // Animation variants for the backdrop
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  // Animation variants for the modal content
  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-contain bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            ref={modalRef}
            className={`relative flex min-h-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl ${baseContentLayoutClassName} ${resolvedContentLayoutClassName}`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Close button with hover animation */}
            <motion.button
              onClick={onClose}
              className="absolute right-4 top-4 z-20 rounded-full bg-[var(--color-surface-alt)] p-2 text-[var(--color-text-muted)] transition-all duration-200 group hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X
                size={20}
                className="group-hover:rotate-90 transition-transform duration-300"
              />
            </motion.button>

            {/* Content container */}
            <div className="relative z-10 min-h-0 flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
