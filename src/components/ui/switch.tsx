"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/** Switch — overridden from shadcn default to comply with the project's
 *  "zero border-radius" design system and monochrome palette.
 *
 *  OFF (unchecked): transparent track + thin white/20 border, dim white/60 thumb.
 *  ON  (checked):   solid white track + white border, black thumb.
 *  This ensures the thumb is visually distinct from the track in both states
 *  (the original shadcn defaults used bg-input track + bg-background thumb,
 *  which blended together on the dark sidebar background). */
 function Switch({
   className,
   ...props
 }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
   return (
     <SwitchPrimitive.Root
       data-slot="switch"
       className={cn(
         "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-0 bg-zinc-400 p-[2px] outline-none",
         "disabled:cursor-not-allowed disabled:opacity-50",
         "focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
         className
       )}
       {...props}
     >
       <SwitchPrimitive.Thumb
         data-slot="switch-thumb"
         className={cn(
           "group pointer-events-none flex size-4 items-center justify-center rounded-0 bg-black",
           "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
           "data-[state=checked]:translate-x-full data-[state=unchecked]:translate-x-0"
         )}
       >
         <span
           className={cn(
             "block size-0.5 rounded-full bg-white",
             "transition-all duration-300 ease-out",
             "scale-0 opacity-0",
             "group-data-[state=checked]:scale-100 group-data-[state=checked]:opacity-100"
           )}
         />
       </SwitchPrimitive.Thumb>
     </SwitchPrimitive.Root>
   );
 }

export { Switch }
