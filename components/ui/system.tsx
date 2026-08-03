import * as React from "react";

const join = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "secondary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={join("ds-button", `ds-button-${variant}`, className)} {...props} />;
}

export function Card({ interactive = false, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={join("ds-card", interactive && "ds-card-interactive", className)} {...props} />;
}

export function Badge({ tone, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "success" | "warning" | "danger" | "info" }) {
  return <span className={join("ds-badge", tone && `ds-badge-${tone}`, className)} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={join("ds-input", className)} {...props} />,
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={join("ds-select", className)} {...props} />,
);
Select.displayName = "Select";
