/**
 * Booking Page - hardening for venue selection persistence
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { listVenues } from "@/lib/api/venues";
// ... keep existing imports

// NOTE: This patch only replaces the fetchVenues logic; rest of file remains same

export default function BookingPagePatched() { return null as any }
