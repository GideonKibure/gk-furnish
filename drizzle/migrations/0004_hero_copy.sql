-- Update the home hero so live CMS copy matches the new audience wording.
UPDATE public.page_sections
SET
  content_en = 'Furniture built for the way you work, rest and live',
  content_sw = 'Samani zilizojengwa kwa ajili ya kufanya kazi, kupumzika na kuishi'
WHERE page_key = 'home' AND section_key = 'hero_title';

UPDATE public.page_sections
SET
  content_en = 'Modern, durable and affordable furniture made by hand for offices, schools and homes across Tanzania.',
  content_sw = 'Samani za kisasa, imara na nafuu zilizotengenezwa kwa mikono kwa ofisi, shule na nyumba nchini Tanzania.'
WHERE page_key = 'home' AND section_key = 'hero_subtitle';
