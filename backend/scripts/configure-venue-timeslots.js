/**
 * Venue Timeslot Configuration Script
 * 
 * This script configures venues with timeslot support settings.
 * Run this to enable/disable timeslot functionality for specific venues.
 * 
 * Usage:
 *   node scripts/configure-venue-timeslots.js
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Venue timeslot configurations
const VENUE_CONFIGURATIONS = [
  {
    // Large venues with flexible pricing should support timeslots
    criteria: { capacity: { gte: 200 } },
    settings: {
      timeslotSupport: {
        enabled: true,
        allowedSlots: ['morning', 'afternoon', 'evening', 'full_day'],
        defaultSlot: 'evening',
        description: 'Large venue with flexible timing options'
      }
    }
  },
  {
    // Venues with existing flexible pricing
    criteria: {
      settings: {
        path: ['pricing', 'weekendMultiplier'],
        not: null
      }
    },
    settings: {
      timeslotSupport: {
        enabled: true,
        allowedSlots: ['morning', 'afternoon', 'evening', 'full_day'],
        defaultSlot: 'full_day',
        description: 'Venue with pricing flexibility supports timeslots'
      }
    }
  },
  {
    // Small/traditional venues - full day only
    criteria: { capacity: { lt: 100 } },
    settings: {
      timeslotSupport: {
        enabled: false,
        allowedSlots: ['full_day'],
        defaultSlot: 'full_day',
        description: 'Traditional full-day venue booking'
      }
    }
  }
];

// Specific venue overrides (by name or ID)
const VENUE_OVERRIDES = {
  // Example: Force specific venues to support timeslots
  'Faisal Function Hall': {
    timeslotSupport: {
      enabled: true,
      allowedSlots: ['afternoon', 'evening', 'full_day'],
      defaultSlot: 'evening',
      description: 'Premium venue with flexible timing'
    }
  },
  // Example: Force a venue to full-day only
  'Traditional Banquet Hall': {
    timeslotSupport: {
      enabled: false,
      allowedSlots: ['full_day'],
      defaultSlot: 'full_day',
      description: 'Classic full-day venue experience'
    }
  }
};

async function configureVenueTimeslots() {
  console.log('🕐 Configuring venue timeslot settings...');
  
  try {
    // Get all venues
    const venues = await prisma.venue.findMany({
      select: {
        id: true,
        name: true,
        capacity: true,
        settings: true,
      }
    });
    
    console.log(`Found ${venues.length} venues to configure`);
    
    for (const venue of venues) {
      console.log(`\n📍 Configuring: ${venue.name}`);
      
      let newSettings = { ...venue.settings };
      
      // Check for specific venue override
      if (VENUE_OVERRIDES[venue.name]) {
        console.log(`  Using specific override for ${venue.name}`);
        newSettings = {
          ...newSettings,
          ...VENUE_OVERRIDES[venue.name]
        };
      } else {
        // Apply configuration based on criteria
        let applied = false;
        
        for (const config of VENUE_CONFIGURATIONS) {
          if (matchesCriteria(venue, config.criteria)) {
            console.log(`  Applying config: ${config.settings.timeslotSupport.description}`);
            newSettings = {
              ...newSettings,
              ...config.settings
            };
            applied = true;
            break;
          }
        }
        
        if (!applied) {
          console.log(`  No matching criteria, applying default (full-day only)`);
          newSettings = {
            ...newSettings,
            timeslotSupport: {
              enabled: false,
              allowedSlots: ['full_day'],
              defaultSlot: 'full_day',
              description: 'Default full-day venue booking'
            }
          };
        }
      }
      
      // Update venue settings
      await prisma.venue.update({
        where: { id: venue.id },
        data: { settings: newSettings }
      });
      
      const support = newSettings.timeslotSupport;
      console.log(`  ✅ Updated: ${support.enabled ? 'Supports timeslots' : 'Full-day only'} (${support.allowedSlots.join(', ')})`);
    }
    
    console.log('\n🎉 Venue timeslot configuration complete!');
    
  } catch (error) {
    console.error('❌ Error configuring venue timeslots:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Check if venue matches configuration criteria
 */
function matchesCriteria(venue, criteria) {
  for (const [key, condition] of Object.entries(criteria)) {
    const venueValue = venue[key];
    
    if (typeof condition === 'object' && condition !== null) {
      if (condition.gte !== undefined && venueValue < condition.gte) return false;
      if (condition.lte !== undefined && venueValue > condition.lte) return false;
      if (condition.lt !== undefined && venueValue >= condition.lt) return false;
      if (condition.gt !== undefined && venueValue <= condition.gt) return false;
      
      // Handle nested path checking (for JSON fields)
      if (condition.path && condition.not !== undefined) {
        const nestedValue = getNestedValue(venueValue, condition.path);
        if (condition.not === null && nestedValue !== null) return false;
        if (condition.not !== null && nestedValue === condition.not) return false;
      }
    } else {
      if (venueValue !== condition) return false;
    }
  }
  
  return true;
}

/**
 * Get nested value from object using path array
 */
function getNestedValue(obj, path) {
  return path.reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Manual configuration function for specific venues
 */
async function configureSpecificVenue(venueName, timeslotConfig) {
  try {
    const venue = await prisma.venue.findFirst({
      where: { name: venueName }
    });
    
    if (!venue) {
      console.log(`❌ Venue '${venueName}' not found`);
      return;
    }
    
    const newSettings = {
      ...venue.settings,
      timeslotSupport: timeslotConfig
    };
    
    await prisma.venue.update({
      where: { id: venue.id },
      data: { settings: newSettings }
    });
    
    console.log(`✅ Updated '${venueName}' with timeslot config:`, timeslotConfig);
    
  } catch (error) {
    console.error(`❌ Error configuring ${venueName}:`, error);
  }
}

// Run the configuration
if (require.main === module) {
  configureVenueTimeslots()
    .then(() => {
      console.log('\n📋 Configuration Summary:');
      console.log('- Venues with capacity ≥200: Timeslot support enabled');
      console.log('- Venues with flexible pricing: Timeslot support enabled');
      console.log('- Small venues (<100 capacity): Full-day only');
      console.log('- Manual overrides applied for specific venues');
      console.log('\n💡 Frontend will automatically detect these settings!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Configuration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  configureVenueTimeslots,
  configureSpecificVenue,
  VENUE_CONFIGURATIONS,
  VENUE_OVERRIDES
};