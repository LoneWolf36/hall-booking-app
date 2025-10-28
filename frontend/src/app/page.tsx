import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDaysIcon, 
  CheckCircle2Icon,
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
  PhoneIcon,
  MailIcon
} from "lucide-react";

export default function HomePage() {
  // This would come from venue configuration in production
  const venueInfo = {
    name: "Grand Celebration Hall",
    tagline: "Your Perfect Event Destination",
    location: "Parbhani, Maharashtra",
    capacity: "500 Guests",
    features: [
      "Spacious Event Halls",
      "Premium Sound System",
      "LED Lighting",
      "Catering Services",
      "Free Parking",
      "AC Halls"
    ]
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section - Elegant & Professional */}
      <section className="relative px-4 sm:px-6 py-20 sm:py-24 md:py-32 overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/3" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container relative mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-5 sm:space-y-6">
            <Badge variant="secondary" className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 bg-card/80 backdrop-blur-md border-border/60 font-medium shadow-sm">
              <MapPinIcon className="h-3 sm:h-3.5 w-3 sm:w-3.5 mr-2" />
              {venueInfo.location}
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight text-foreground">
              {venueInfo.name}
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
              {venueInfo.tagline}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 sm:pt-4 text-sm sm:text-base text-muted-foreground">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-primary" />
                <span>{venueInfo.capacity}</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-primary" />
                <span>Full Day Events</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-6 sm:pt-8 px-4">
              <Link href="/booking" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 font-medium rounded-xl">
                  <CalendarDaysIcon className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
                  Book Your Event
                  <ArrowRightIcon className="ml-2 h-3 sm:h-4 w-3 sm:w-4" />
                </Button>
              </Link>
              <Link href="#features" className="w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 bg-background/80 backdrop-blur-md border-2 hover:bg-muted/60 hover:border-primary/30 transition-all duration-300 font-medium rounded-xl"
                >
                  View Amenities
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-b from-muted/40 via-muted/20 to-background border-b border-border/60">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10 sm:mb-14 px-4">
            <Badge variant="outline" className="mb-4 border-primary/20 bg-primary/5 text-primary font-medium">Features</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 tracking-tight">Our Amenities</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">Everything you need for a perfect event</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {venueInfo.features.map((feature, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-5 rounded-xl bg-card/90 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm sm:text-base font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Book */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-b from-background via-primary/[0.02] to-background border-b border-border/60">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10 sm:mb-14 space-y-3 sm:space-y-4 px-4">
            <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary font-medium">Process</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Simple Booking Process</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">Get your event confirmed in minutes</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {[
              { step: "1", title: "Select Dates", desc: "Choose your event dates" },
              { step: "2", title: "Event Details", desc: "Tell us about your event" },
              { step: "3", title: "Login", desc: "Quick phone verification" },
              { step: "4", title: "Confirm", desc: "Complete & confirm booking" }
            ].map((item) => (
              <div key={item.step} className="text-center px-2 group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-5 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 flex items-center justify-center text-primary text-xl sm:text-2xl font-bold shadow-sm group-hover:shadow-md group-hover:scale-105 group-hover:border-primary/40 transition-all duration-300">
                  {item.step}
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-1 sm:mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-14 px-4">
            <Link href="/booking" className="inline-block w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 font-medium rounded-xl">
                Start Booking Now
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-br from-muted/30 via-background to-muted/20 border-b border-border/50">
        <div className="container mx-auto max-w-3xl text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-5 tracking-tight">Have Questions?</h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8 sm:mb-10">
            Our team is here to help you plan your perfect event
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button variant="outline" size="lg" className="gap-2 bg-background/80 backdrop-blur-md border-2 hover:bg-muted/60 hover:border-primary/30 transition-all duration-300 font-medium py-6 rounded-xl">
              <PhoneIcon className="h-5 w-5" />
              Call Us
            </Button>
            <Button variant="outline" size="lg" className="gap-2 bg-background/80 backdrop-blur-md border-2 hover:bg-muted/60 hover:border-primary/30 transition-all duration-300 font-medium py-6 rounded-xl">
              <MailIcon className="h-5 w-5" />
              Email Us
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-4 bg-muted/20">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {venueInfo.name}. All rights reserved.</p>
          <p className="mt-2">Powered by Hall Booking System</p>
        </div>
      </footer>
    </div>
  );
}
