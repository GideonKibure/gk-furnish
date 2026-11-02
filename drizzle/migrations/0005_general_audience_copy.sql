-- Broaden live catalogue and CMS copy from students only to every kind of customer.
UPDATE public.categories
SET
  description = 'Dining, office, classroom and lounge chairs built to last through long days.',
  description_sw = 'Viti vya chakula, ofisi, darasa na sebule vilivyotengenezwa kudumu.'
WHERE slug = 'chairs';

UPDATE public.categories
SET
  description = 'Dining tables, office desks, study tables and reception counters made to measure.',
  description_sw = 'Meza za chakula, madawati ya ofisi, meza za kusomea na meza za mapokezi kwa vipimo vyako.'
WHERE slug = 'tables';

UPDATE public.categories
SET
  description = 'Handmade wooden lamps for homes, offices and hotel rooms.',
  description_sw = 'Taa za mbao zilizotengenezwa kwa mikono kwa nyumba, ofisi na vyumba vya hoteli.'
WHERE slug = 'table-lamps';

UPDATE public.page_sections
SET
  content_en = 'GK furnish started with a simple goal: furniture that is strong enough to last and priced fairly. So we build beds, sofas, tables and chairs for homes, schools, offices, hotels and organizations.',
  content_sw = 'GK furnish ilianza na lengo rahisi: samani imara zinazodumu kwa bei ya haki. Tunatengeneza vitanda, sofa, meza na viti kwa nyumba, shule, ofisi, hoteli na taasisi.'
WHERE page_key = 'about' AND section_key = 'story';

UPDATE public.page_sections
SET
  content_en = 'To make durable, well-made furniture that homes, businesses and institutions in Tanzania can genuinely afford.',
  content_sw = 'Kutengeneza samani imara na za ubora ambazo nyumba, biashara na taasisi Tanzania zinaweza kuzimudu kweli.'
WHERE page_key = 'about' AND section_key = 'mission';
