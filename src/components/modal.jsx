import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export const modalMotion = {
  initial: { opacity: 0, y: 16, scale: 0.965 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.965 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
};

export const modalContentVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  exit: {}
};

export const modalSectionVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.12 } }
};

export function useModalScrollLock() {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);
}

export function ModalPortal({ children }) {
  return createPortal(children, document.body);
}
