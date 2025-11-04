import cssText from "data-text:~style.css";
import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

// Create shadow root container for dialog portal
const getDialogShadowRoot = (): ShadowRoot => {
  const containerId = "scam-detector-dialog-shadow-container";
  let container = document.getElementById(containerId) as HTMLElement | null;

  if (!container) {
    // Create container attached to body
    container = document.createElement("div");
    container.id = containerId;
    container.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483647;";
    document.body.appendChild(container);
  }

  // Create or get shadow root
  if (!container.shadowRoot) {
    const shadowRoot = container.attachShadow({ mode: "open" });

    // Process CSS for shadow DOM (same as linkedin-job-badge.tsx)
    const baseFontSize = 16;
    let updatedCssText = cssText.replaceAll(":root", ":host");

    // Convert rem to px for consistency
    const remRegex = /([\d.]+)rem/g;
    updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
      const pixelsValue = parseFloat(remValue) * baseFontSize;
      return `${pixelsValue}px`;
    });

    // Inject styles into shadow root
    const style = document.createElement("style");
    style.textContent = updatedCssText;
    shadowRoot.appendChild(style);

    return shadowRoot;
  }

  return container.shadowRoot;
};

// Custom Dialog Root - manages open/close state
interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
  undefined
);

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

const useDialogContext = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within Dialog");
  }
  return context;
};

// Dialog Trigger (for opening dialog)
interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  DialogTriggerProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, asChild, onClick, ...props }, ref) => {
  const { onOpenChange } = useDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(true);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      ref,
      ...props,
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button ref={ref} onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
DialogTrigger.displayName = "DialogTrigger";

// Dialog Close (for closing dialog)
interface DialogCloseProps {
  children?: React.ReactNode;
  asChild?: boolean;
}

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  DialogCloseProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, asChild, onClick, ...props }, ref) => {
  const { onOpenChange } = useDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(false);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      ref,
      ...props,
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button ref={ref} onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
DialogClose.displayName = "DialogClose";

// Dialog Overlay
type DialogOverlayProps = React.HTMLAttributes<HTMLDivElement>;

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange, open } = useDialogContext();
    const [mounted, setMounted] = React.useState(false);
    const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);

    React.useEffect(() => {
      setMounted(true);
      if (open) {
        const root = getDialogShadowRoot();
        setShadowRoot(root);
      }
    }, [open]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Close dialog when clicking overlay
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
      onClick?.(e);
    };

    if (!open || !mounted || !shadowRoot) return null;

    const overlay = (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 bg-black/80",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        data-state={open ? "open" : "closed"}
        onClick={handleClick}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          pointerEvents: "auto",
        }}
        {...props}
      />
    );

    // Portal to shadow root instead of document.body
    return createPortal(overlay, shadowRoot);
  }
);
DialogOverlay.displayName = "DialogOverlay";

// Dialog Content
type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useDialogContext();
    const [mounted, setMounted] = React.useState(false);
    const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);

    React.useEffect(() => {
      setMounted(true);
      if (open) {
        const root = getDialogShadowRoot();
        setShadowRoot(root);
      }
    }, [open]);

    if (!open || !mounted || !shadowRoot) return null;

    const content = (
      <>
        <DialogOverlay />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            "fixed top-[50%] left-[50%]",
            "grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
            "bg-background gap-4 border p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "duration-200 sm:rounded-lg",
            className
          )}
          data-state={open ? "open" : "closed"}
          style={{
            zIndex: 100,
            position: "fixed",
            backgroundColor: "white",
            color: "#1f2937",
            display: "grid",
            visibility: "visible",
            opacity: 1,
            pointerEvents: "auto",
          }}
          {...props}
        >
          {children}
          <DialogClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
            <X className="text-muted-foreground h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </>
    );

    // Portal to shadow root instead of document.body
    return createPortal(content, shadowRoot);
  }
);
DialogContent.displayName = "DialogContent";

// Dialog Header
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

// Dialog Footer
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

// Dialog Title
type DialogTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn(
        "text-lg leading-none font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
);
DialogTitle.displayName = "DialogTitle";

// Dialog Description
type DialogDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
