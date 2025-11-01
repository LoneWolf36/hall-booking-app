'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookingProgress } from '@/components/booking/ProgressIndicator';
import { useBookingStore } from '@/stores';
import { toast } from 'sonner';
import {
  UtensilsCrossedIcon,
  SparklesIcon,
  CameraIcon,
  MusicIcon,
  PlusIcon,
  MinusIcon,
  InfoIcon,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddonItem {
  id: string;
  name: string;
  description: string;
  pricePerUnit: number;
  category: 'catering' | 'decoration' | 'equipment' | 'entertainment';
  icon: React.ReactNode;
}

interface SelectedAddon {
  addonId: string;
  quantity: number;
}

const ADDONS: AddonItem[] = [
  {
    id: 'catering-vegetarian',
    name: 'Vegetarian Meal',
    description: 'Per person - includes main course, sides, and dessert',
    pricePerUnit: 450,
    category: 'catering',
    icon: <UtensilsCrossedIcon className="h-5 w-5" />,
  },
  {
    id: 'catering-non-veg',
    name: 'Non-Vegetarian Meal',
    description: 'Per person - mixed meat options with sides and dessert',
    pricePerUnit: 550,
    category: 'catering',
    icon: <UtensilsCrossedIcon className="h-5 w-5" />,
  },
  {
    id: 'decoration-theme',
    name: 'Theme Decoration',
    description: 'Complete venue decoration based on your selected theme',
    pricePerUnit: 15000,
    category: 'decoration',
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    id: 'decoration-flowers',
    name: 'Flower Arrangements',
    description: 'Fresh flower arrangements for stage and tables',
    pricePerUnit: 8000,
    category: 'decoration',
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    id: 'equipment-projector',
    name: 'Projector & Screen',
    description: 'Full HD projector with screen for presentations',
    pricePerUnit: 5000,
    category: 'equipment',
    icon: <MusicIcon className="h-5 w-5" />,
  },
  {
    id: 'equipment-microphone',
    name: 'Premium Sound System',
    description: 'Professional microphones, speakers, and mixing console',
    pricePerUnit: 8000,
    category: 'equipment',
    icon: <MusicIcon className="h-5 w-5" />,
  },
  {
    id: 'entertainment-photographer',
    name: 'Professional Photography',
    description: 'Full event coverage with professional photographer',
    pricePerUnit: 12000,
    category: 'entertainment',
    icon: <CameraIcon className="h-5 w-5" />,
  },
  {
    id: 'entertainment-videography',
    name: 'Videography Service',
    description: 'Professional video coverage with editing and highlights',
    pricePerUnit: 18000,
    category: 'entertainment',
    icon: <CameraIcon className="h-5 w-5" />,
  },
];

const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  catering: {
    label: 'Catering Services',
    description: 'Meals and beverage options for your guests',
  },
  decoration: {
    label: 'Decoration & Ambiance',
    description: 'Transform your venue with elegant decorations',
  },
  equipment: {
    label: 'Audio/Visual Equipment',
    description: 'Professional sound and projection systems',
  },
  entertainment: {
    label: 'Photography & Videography',
    description: 'Capture your special moments professionally',
  },
};

export default function AddonsPage() {
  const router = useRouter();
  const { selectedVenue, eventType, guestCount, setCurrentStep } = useBookingStore();
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);

  useEffect(() => {
    if (!selectedVenue || !eventType) {
      toast.error('Please complete previous steps first');
      router.push('/event-details');
    } else {
      setCurrentStep('addons');
    }
  }, [selectedVenue, eventType, setCurrentStep, router]);

  const handleAddonToggle = (addonId: string, checked: boolean) => {
    if (checked) {
      setSelectedAddons([...selectedAddons, { addonId, quantity: 1 }]);
    } else {
      setSelectedAddons(selectedAddons.filter((addon) => addon.addonId !== addonId));
    }
  };

  const handleQuantityChange = (addonId: string, quantity: number) => {
    if (quantity <= 0) {
      handleAddonToggle(addonId, false);
      return;
    }
    setSelectedAddons(
      selectedAddons.map((addon) =>
        addon.addonId === addonId ? { ...addon, quantity } : addon
      )
    );
  };

  const calculateTotal = () => {
    return selectedAddons.reduce((total, selectedAddon) => {
      const addon = ADDONS.find((a) => a.id === selectedAddon.addonId);
      return total + (addon?.pricePerUnit || 0) * selectedAddon.quantity;
    }, 0);
  };

  const handleContinue = () => {
    // Save selected add-ons to store (if needed)
    toast.success('Add-ons selections saved');
    router.push('/payment');
  };

  const handleSkip = () => {
    // Skip add-ons and go to payment
    toast.success('Skipping add-ons');
    router.push('/payment');
  };

  const handleBack = () => {
    router.push('/event-details');
  };

  if (!selectedVenue || !eventType) {
    return null;
  }

  const addonTotal = calculateTotal();
  const groupedAddons = ADDONS.reduce(
    (acc, addon) => {
      if (!acc[addon.category]) acc[addon.category] = [];
      acc[addon.category].push(addon);
      return acc;
    },
    {} as Record<string, AddonItem[]>
  );

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4 pb-24 lg:pb-8 overflow-x-hidden">
      <div className="container max-w-5xl mx-auto space-y-8">
        {/* Progress Indicator */}
        <BookingProgress variant="horizontal" className="mb-8" />

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Event Add-ons</h1>
          <p className="text-muted-foreground">Enhance your event with optional services (all optional)</p>
        </div>

        {/* Info Alert */}
        <Alert className="border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20">
          <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            All add-ons are optional. You can skip this step and proceed directly to payment.
          </AlertDescription>
        </Alert>

        {/* Add-ons by Category */}
        <div className="space-y-8">
          {Object.entries(groupedAddons).map(([category, addons]) => (
            <div key={category} className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {CATEGORY_INFO[category].label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {CATEGORY_INFO[category].description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addons.map((addon) => {
                  const isSelected = selectedAddons.some(
                    (selected) => selected.addonId === addon.id
                  );
                  const selectedAddon = selectedAddons.find(
                    (selected) => selected.addonId === addon.id
                  );
                  const quantity = selectedAddon?.quantity || 0;

                  return (
                    <Card
                      key={addon.id}
                      onClick={() => handleAddonToggle(addon.id, !isSelected)}
                      className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        isSelected
                          ? 'bg-gradient-to-br from-card/70 to-card/50 border-primary/40 shadow-lg'
                          : 'bg-gradient-to-br from-card/50 to-card/30 border-border/50 hover:border-primary/20'
                      }`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                              {addon.icon}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-base">{addon.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {addon.description}
                              </CardDescription>
                            </div>
                          </div>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleAddonToggle(addon.id, checked as boolean)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                        </div>
                      </CardHeader>

                      {isSelected && (
                        <>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg">
                              <span className="font-semibold text-sm">
                                ₹{addon.pricePerUnit.toLocaleString()}{' '}
                                <span className="text-muted-foreground font-normal">
                                  {addon.category === 'catering' ? '/ person' : '/ item'}
                                </span>
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuantityChange(addon.id, quantity - 1);
                                  }}
                                >
                                  <MinusIcon className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-semibold">
                                  {quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuantityChange(addon.id, quantity + 1);
                                  }}
                                >
                                  <PlusIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-foreground/5 rounded-lg">
                              <span className="text-sm font-medium">Subtotal</span>
                              <span className="font-bold text-primary">
                                ₹{(addon.pricePerUnit * quantity).toLocaleString()}
                              </span>
                            </div>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Card */}
        {selectedAddons.length > 0 && (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-lg sticky bottom-24 lg:bottom-auto lg:sticky lg:top-20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Selected Add-ons</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    ₹{addonTotal.toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/40">
                  {selectedAddons.length} item{selectedAddons.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Desktop: Sticky Action Bar */}
        <div className="lg:block hidden sticky bottom-4 z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-lg p-4">
            <div className="flex gap-3">
              <Button
                onClick={handleBack}
                variant="outline"
                size="lg"
                className="flex-1 h-12 border-2 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl"
              >
                Back
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                size="lg"
                className="flex-1 h-12 border-2 hover:border-muted-foreground/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl"
              >
                Skip Add-ons
              </Button>
              <Button
                onClick={handleContinue}
                disabled={selectedAddons.length === 0}
                size="lg"
                className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg transition-all duration-300 font-medium rounded-xl disabled:opacity-50"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile: Sticky Floating Action Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-border/60 z-50 shadow-2xl">
          <div className="flex gap-2">
            <Button
              onClick={handleBack}
              variant="outline"
              size="lg"
              className="flex-1 h-12 border-2 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl text-sm"
            >
              Back
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              size="lg"
              className="flex-1 h-12 border-2 hover:border-muted-foreground/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl text-sm"
            >
              Skip
            </Button>
            <Button
              onClick={handleContinue}
              disabled={selectedAddons.length === 0}
              size="lg"
              className="flex-1 h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg transition-all duration-300 font-medium rounded-xl text-sm disabled:opacity-50"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
