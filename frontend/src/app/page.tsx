import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, CreditCardIcon, ShieldIcon, UsersIcon, SearchIcon } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="px-4 py-16 md:py-24 lg:py-32 bg-gradient-to-r from-background to-muted">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              🚀 Enterprise Grade Hall Booking Platform
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Hall Booking System
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Revolutionary flexible payment system serving all types of venues from cash-only to fully digital
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/availability">
                  <SearchIcon className="mr-2 h-5 w-5" />
                  Check Availability
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/venues">Browse Venues</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Availability Check */}
      <section className="px-4 py-12 border-b">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto">
            <Card className="border-primary/20">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <SearchIcon className="h-5 w-5" />
                  Quick Availability Check
                </CardTitle>
                <CardDescription>
                  Find your perfect time slot instantly - no login required!
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Select venue, date, and time to check real-time availability with zero double-booking guarantee
                </p>
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/availability">
                    Start Your Search →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Our Platform?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for Parbhani hall MVP, designed to scale to 100+ venues as SaaS with payment flexibility for all venue types.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CalendarIcon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Zero Double-Bookings</CardTitle>
                <CardDescription>
                  Database-level exclusion constraints prevent overlapping bookings guaranteed
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <CreditCardIcon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Flexible Payments</CardTitle>
                <CardDescription>
                  Revolutionary payment profiles from 5% cash-only to 15% full marketplace
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <ShieldIcon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  NestJS + TypeScript + Redis caching with production-grade monitoring
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <UsersIcon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Multi-Tenant Ready</CardTitle>
                <CardDescription>
                  Built for scalability with multi-tenant architecture and role-based access
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Payment Profiles Section */}
      <section className="px-4 py-16 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Payment Profiles for Every Venue</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Unlike traditional platforms that exclude 70% of Indian venues, our system serves EVERYONE.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  Cash Only
                  <Badge variant="secondary">5% Commission</Badge>
                </CardTitle>
                <CardDescription>
                  Zero tech barrier, manual confirmation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Perfect for traditional halls and family businesses
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  Hybrid Flexible
                  <Badge variant="secondary">8% Commission</Badge>
                </CardTitle>
                <CardDescription>
                  Customer chooses payment method
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Modern venues serving all customer preferences
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  Full Marketplace
                  <Badge variant="secondary">15% Commission</Badge>
                </CardTitle>
                <CardDescription>
                  Platform handles everything
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Premium full-service venues with instant confirmation
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join the revolution in hall booking with our enterprise-grade platform
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/availability">
                  <SearchIcon className="mr-2 h-5 w-5" />
                  Check Availability Now
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/venues">Explore All Venues</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
