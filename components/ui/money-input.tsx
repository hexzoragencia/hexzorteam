"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | "";
  onValueChange: (v: number | "") => void;
  currency?: string;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, className, currency = "$", placeholder = "0", ...props }, ref) => {
    const display = value === "" || value === 0 ? "" : value.toLocaleString("es-CO");
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
          {currency}
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw === "") return onValueChange("");
            onValueChange(parseInt(raw, 10));
          }}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-base font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 tabular-nums",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
