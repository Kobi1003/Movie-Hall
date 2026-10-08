import { supabaseAdmin } from '../src/config/supabase.js';
import { GeoService } from '../src/services/geo.service.js';

async function updateCoordinates() {
  console.log('Fetching cinemas...');
  const { data: cinemas, error } = await supabaseAdmin.from('cinemas').select('*');
  if (error) {
    console.error('Error fetching cinemas:', error);
    process.exit(1);
  }

  console.log(`Found ${cinemas.length} cinemas.`);
  for (const c of cinemas) {
    console.log(`Checking cinema: "${c.cinema_name}" in "${c.city}", address: "${c.address}"`);
    let lat = c.latitude;
    let lng = c.longitude;

    if (lat == null || lng == null) {
      const geocoded = await GeoService.geocode({
        address: c.address,
        city: c.city,
        state: c.state,
        postalCode: c.postal_code
      });

      if (geocoded) {
        lat = geocoded.latitude;
        lng = geocoded.longitude;
        console.log(`  -> Geocoded to: lat=${lat}, lng=${lng} (${geocoded.formattedAddress})`);

        const { error: updateErr } = await supabaseAdmin
          .from('cinemas')
          .update({
            latitude: lat,
            longitude: lng,
            updated_at: new Date().toISOString()
          })
          .eq('id', c.id);

        if (updateErr) {
          console.error(`  -> Failed to update cinema in database:`, updateErr.message);
        } else {
          console.log(`  -> Successfully updated cinema coordinates in DB!`);
        }
      } else {
        console.warn(`  -> Could not geocode cinema.`);
      }
    } else {
      console.log(`  -> Already has coordinates: lat=${lat}, lng=${lng}`);
    }
  }

  console.log('Finished updating cinema coordinates.');
  process.exit(0);
}

updateCoordinates().catch(err => {
  console.error(err);
  process.exit(1);
});
