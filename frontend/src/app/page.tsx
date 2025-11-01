import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ArrowRight,
  Clock,
  MapPin,
  Users,
  Phone,
  Mail,
  DoorOpen,
  Volume2,
  Lightbulb,
  ParkingCircle,
  Wind,
  ChefHat,
} from "lucide-react";
import { ReactNode } from "react";

// Icon mapping for amenities - contextual icons
const AMENITY_ICONS: Record<string, ReactNode> = {
  "Spacious Event Halls": <DoorOpen className="h-5 w-5" />,
  "Premium Sound System": <Volume2 className="h-5 w-5" />,
  "LED Lighting": <Lightbulb className="h-5 w-5" />,
  "Catering Services": <ChefHat className="h-5 w-5" />,
  "Free Parking": <ParkingCircle className="h-5 w-5" />,
  "AC Halls": <Wind className="h-5 w-5" />,
};

export default function HomePage() {
  // This would come from venue configuration in production
  const venueInfo = {
    name: "Faisal Function Hall",
    tagline: "Your Perfect Event Destination",
    location: "Parbhani, Maharashtra",
    capacity: "500 Guests",
    features: [
      "Spacious Event Halls",
      "Premium Sound System",
      "LED Lighting",
      "Catering Services",
      "Free Parking",
      "AC Halls",
    ],
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section - Premium Glassmorphism */}
      <section className="relative px-3 sm:px-4 md:px-6 py-16 sm:py-20 md:py-24 lg:py-32 overflow-hidden border-b border-border/30 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4 backdrop-blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 w-56 h-56 sm:w-80 sm:h-80 bg-primary/5 rounded-full blur-3xl opacity-30" />

        <div className="container relative mx-auto max-w-7xl">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-5 md:space-y-6 px-2 sm:px-4">
            <Badge
              variant="secondary"
              className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 bg-primary/10 backdrop-blur-xl border-primary/20 font-medium shadow-sm hover:bg-primary/15 transition-colors duration-300"
            >
              <MapPin className="h-3 sm:h-3.5 w-3 sm:w-3.5 mr-2 text-primary" />
              {venueInfo.location}
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight text-foreground">
              {venueInfo.name}
            </h1>

            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground px-2 sm:px-4">
              {venueInfo.tagline}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 sm:pt-4 text-sm sm:text-base text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>{venueInfo.capacity}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Full Day Events</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6 md:pt-8 px-2 sm:px-4">
              <Link href="/booking" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary/80 font-medium rounded-xl active:scale-95"
                >
                  <CalendarDays className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
                  Book Your Event
                  <ArrowRight className="ml-2 h-3 sm:h-4 w-3 sm:w-4" />
                </Button>
              </Link>
              <Link href="#features" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 bg-card/40 backdrop-blur-xl border-2 border-border/40 hover:bg-card/60 hover:border-primary/40 hover:shadow-lg hover:scale-105 transition-all duration-300 font-medium rounded-xl active:scale-95"
                >
                  View Amenities
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-background via-primary/3 to-background border-b border-border/30"
      >
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8 sm:mb-10 md:mb-14 px-2 sm:px-4">
            <Badge
              variant="outline"
              className="mb-4 border-primary/20 bg-primary/5 text-primary font-medium"
            >
              Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 tracking-tight">
              Our Amenities
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Everything you need for a perfect event
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {venueInfo.features.map((feature, index) => (
              <div
                key={index}
                className="group flex flex-col items-center justify-center gap-4 p-7 rounded-2xl bg-gradient-to-br from-card/50 to-card/20 backdrop-blur-xl border border-border/40 hover:border-primary/50 hover:bg-card/70 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer hover:backdrop-blur-2xl text-center"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-full ring-2 ring-primary/40 ring-offset-2 ring-offset-background flex items-center justify-center bg-transparent group-hover:ring-primary/60 transition-all duration-300 shadow-md text-primary">
                  {AMENITY_ICONS[feature] || (
                    <span className="text-lg font-bold">{feature.charAt(0)}</span>
                  )}
                </div>
                <span className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Book */}
      <section className="px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-background via-primary/[0.02] to-background border-b border-border/60">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8 sm:mb-10 md:mb-14 space-y-3 sm:space-y-4 px-2 sm:px-4">
            <Badge
              variant="outline"
              className="mb-2 border-primary/20 bg-primary/5 text-primary font-medium"
            >
              Process
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Simple Booking Process
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Get your event confirmed in minutes
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {[
              { step: "1", title: "Select Dates", desc: "Choose your event dates" },
              { step: "2", title: "Event Details", desc: "Tell us about your event" },
              { step: "3", title: "Login", desc: "Quick phone verification" },
              { step: "4", title: "Confirm", desc: "Complete & confirm booking" },
            ].map((item) => (
              <div key={item.step} className="text-center px-2 group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-5 rounded-full bg-gradient-to-br from-primary/25 to-primary/5 border-2 border-primary/30 flex items-center justify-center text-primary text-xl sm:text-2xl font-bold shadow-md group-hover:shadow-lg group-hover:scale-110 group-hover:border-primary/60 group-hover:from-primary/35 group-hover:to-primary/15 transition-all duration-300 ring-4 ring-primary/10 group-hover:ring-primary/20">
                  {item.step}
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-1 sm:mb-2 text-foreground">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8 sm:mt-10 md:mt-14 px-2 sm:px-4">
            <Link href="/booking" className="inline-block w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-medium rounded-xl active:scale-95"
              >
                Start Booking Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-br from-primary/5 via-background to-background border-b border-border/30">
        <div className="container mx-auto max-w-3xl text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-5 tracking-tight">
            Have Questions?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8 sm:mb-10">
            Our team is here to help you plan your perfect event
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button className="gap-2 bg-card/40 backdrop-blur-xl border-2 border-border/40 hover:bg-card/70 hover:border-primary/40 hover:shadow-lg hover:scale-105 transition-all duration-300 font-medium py-6 rounded-xl active:scale-95" variant="outline" size="lg">
              <Phone className="h-5 w-5" />
              Call Us
            </Button>
            <Button className="gap-2 bg-card/40 backdrop-blur-xl border-2 border-border/40 hover:bg-card/70 hover:border-primary/40 hover:shadow-lg hover:scale-105 transition-all duration-300 font-medium py-6 rounded-xl active:scale-95" variant="outline" size="lg">
              <Mail className="h-5 w-5" />
              Email Us
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-4 bg-background">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {venueInfo.name}. All rights reserved.</p>
          <p className="mt-2">Powered by Hall Booking System</p>
        </div>
      </footer>
    </div>
  );
}
