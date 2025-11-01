"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { MoonIcon, SunIcon, CalendarIcon, PhoneIcon } from "lucide-react"

export function Navigation() {
  const { setTheme, theme } = useTheme()

  // Venue info (would come from configuration)
  const venueName = "Faisal Function Hall";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 shadow-sm overflow-hidden">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 flex h-14 sm:h-16 items-center justify-between max-w-full">
        {/* Logo/Brand */}
        <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group transition-all min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300 flex-shrink-0">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline-block font-semibold text-base md:text-lg bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text truncate max-w-[150px] md:max-w-none">
            {venueName}
          </span>
        </Link>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Contact Button */}
          <Link href="tel:+919876543210" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm" className="gap-2 hover:bg-primary/10 transition-all duration-300 font-medium rounded-lg">
              <PhoneIcon className="h-4 w-4" />
              Contact
            </Button>
          </Link>

          {/* Book Now Button */}
          <Link href="/booking" className="flex-shrink-0">
            <Button size="sm" className="gap-1.5 sm:gap-2 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 font-medium px-3 sm:px-5 rounded-lg text-xs sm:text-sm h-8 sm:h-9">
              <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Book Now</span>
              <span className="sm:hidden">Book</span>
            </Button>
          </Link>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-lg sm:rounded-xl hover:bg-primary/10 transition-colors h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
          >
            <SunIcon className="h-4 w-4 sm:h-5 sm:w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute h-4 w-4 sm:h-5 sm:w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
